#!/usr/bin/env python3
"""Convert the student part of a lecture-notes source (coursN.tex) into the web version of the notes.

    python3 src/tools/notes2html.py /path/to/cours1.tex 1 [widgets.json]

writes src/content/lecture-1-notes.html (an HTML fragment that build.py puts under the summary of the
Lecture 1 page) and src/figures/lecture-1-*.svg (the TikZ drawings, compiled with pdflatex and
converted by pdftocairo). The .tex sources stay out of this repository: they contain the teacher part.

Only the text before "\\section*{Exercises}" is converted (the exercises are in content/lecture-N.py).
The converter knows the macros and environments of the notes (notes_preamble.tex): sections,
\\paragraph, \\textbf, \\emph, \\newword, \\footnote, \\ref, \\eqref, equation, \\[ \\], center,
tikzpicture, tabular, itemize, blockgraybox, blockwhitebox, proof, example, remark.
Interactive illustrations are placed with lines "%web: <widget> [args]" in the source, or with the
optional widgets.json, a list of {"after": "<text of the source>", "widget": "<name>", "args": "..."}:
the widget goes after the paragraph or block that contains that text.
"""
import hashlib, html, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "src")

TIKZ_PREAMBLE = r"""\documentclass[tikz,border=3pt]{standalone}
\usepackage{amsmath,amssymb}
\usetikzlibrary{arrows.meta,positioning,shadows,calc}
\newcommand{\rv}[1]{{\mathrm{#1}}}
\newcommand{\Xcal}{\mathcal{X}}\newcommand{\Ycal}{\mathcal{Y}}\newcommand{\Ccal}{\mathcal{C}}
\begin{document}
"""


def strip_comments(s):
    out = []
    for line in s.split("\n"):
        m = re.match(r"\s*%web:\s*(\S+)\s*(.*)$", line)
        if m:
            out.append("\n@@WEB{%s|%s}@@\n" % (m.group(1), m.group(2).strip()))
            continue
        k = 0
        while True:
            k = line.find("%", k)
            if k < 0 or line[k - 1:k] != "\\":
                break
            k += 1
        out.append(line if k < 0 else line[:k])
    return "\n".join(out)


def braced(s, i):
    """s[i] == '{': return (content, index after the closing brace)."""
    assert s[i] == "{", s[i:i + 30]
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
    raise ValueError("unbalanced braces")


def find_env_end(s, name, start):
    """Index of the \\end{name} that closes the environment opened before start."""
    depth = 1
    pat = re.compile(r"\\(begin|end)\{%s\}" % re.escape(name))
    for m in pat.finditer(s, start):
        depth += 1 if m.group(1) == "begin" else -1
        if depth == 0:
            return m.start(), m.end()
    raise ValueError("no end for " + name)


class Converter:
    def __init__(self, lec, figdir, figprefix):
        self.lec = lec
        self.figdir = figdir
        self.figprefix = figprefix
        self.math = []          # protected math, by placeholder index
        self.labels = {}        # label -> (number, anchor)
        self.footnotes = []
        self.sec = 0
        self.eq = 0
        self.thm = 0            # shared counter of examples and remarks
        self.figures = []
        self.tikz_src = []      # TikZ code, protected before the math

    # ---------------------------------------------------------------- pass 1: numbers of labels
    def number_labels(self, s):
        sec = eq = thm = 0
        for m in re.finditer(r"\\section\{|\\begin\{equation\}|\\begin\{(example|remark)\}|\\label\{([^}]*)\}", s):
            t = m.group(0)
            if t.startswith("\\section{"):
                sec += 1; last = ("%d.%d" % (self.lec, sec), "cn-%d-%d" % (self.lec, sec))
            elif t.startswith("\\begin{equation}"):
                eq += 1; last = ("%d.%d" % (self.lec, eq), "eq-%d-%d" % (self.lec, eq))
            elif m.group(1):
                thm += 1; last = ("%d.%d" % (self.lec, thm), "%s-%d-%d" % (m.group(1), self.lec, thm))
            else:
                self.labels[m.group(2)] = last

    # ---------------------------------------------------------------- math
    def protect(self, tex, display=False, tag=None, anchor=None):
        tex = tex.strip()
        if display:
            if tag:
                tex = tex + r" \tag{%s}" % tag
            h = '<div class="math-display"%s>\\[%s\\]</div>' % (' id="%s"' % anchor if anchor else "", html.escape(tex, quote=False))
        else:
            h = "\\(%s\\)" % html.escape(tex, quote=False)
        self.math.append(h)
        return "@@M%d@@" % (len(self.math) - 1)

    def protect_tikz(self, s):
        def f(m):
            self.tikz_src.append(m.group(1))
            return "@@T%d@@" % (len(self.tikz_src) - 1)
        return re.sub(r"\\begin\{tikzpicture\}(.*?)\\end\{tikzpicture\}", f, s, flags=re.S)

    def protect_all_math(self, s):
        def eqn(m):
            body = m.group(1)
            lab = re.search(r"\\label\{([^}]*)\}", body)
            body = re.sub(r"\\label\{[^}]*\}", "", body)
            self.eq += 1
            num = "%d.%d" % (self.lec, self.eq)
            return "\n@@D" + self.protect(body, True, num, "eq-%d-%d" % (self.lec, self.eq)) + "\n"
        s = re.sub(r"\\begin\{equation\}(.*?)\\end\{equation\}", eqn, s, flags=re.S)
        s = re.sub(r"\\\[(.*?)\\\]", lambda m: "\n@@D" + self.protect(m.group(1), True) + "\n", s, flags=re.S)
        s = re.sub(r"(?<!\\)\$(.+?)(?<!\\)\$", lambda m: self.protect(m.group(1)), s, flags=re.S)
        return s

    # ---------------------------------------------------------------- figures
    def tikz(self, body):
        code = "\\begin{tikzpicture}" + body + "\\end{tikzpicture}"
        h = hashlib.sha1(code.encode()).hexdigest()[:20]
        name = "%s-%s.svg" % (self.figprefix, h)
        out = os.path.join(self.figdir, name)
        if not os.path.exists(out):
            with tempfile.TemporaryDirectory() as d:
                with open(os.path.join(d, "f.tex"), "w") as f:
                    f.write(TIKZ_PREAMBLE + code + "\n\\end{document}\n")
                r = subprocess.run(["pdflatex", "-interaction=nonstopmode", "-halt-on-error", "f.tex"], cwd=d,
                                   capture_output=True, text=True)
                if r.returncode:
                    sys.exit("TikZ figure failed:\n" + r.stdout[-2500:])
                subprocess.run(["pdftocairo", "-svg", "f.pdf", "f.svg"], cwd=d, check=True)
                shutil.copy(os.path.join(d, "f.svg"), out)
        self.figures.append(name)
        with open(out) as f:
            head = f.read(600)
        m = re.search(r'width="([\d.]+)(pt)?"', head)
        w = round(float(m.group(1)) * 1.33) if m else 400
        n = len(self.figures)
        return ('<div class="tex-center"><figure class="tikz"><img src="figures/%s" alt="Drawing %d of the notes" '
                'style="width:%dpx"></figure></div>' % (name, n, w))

    # ---------------------------------------------------------------- inline text
    def inline(self, s):
        s = s.strip()
        # commands with one argument, innermost first
        changed = True
        while changed:
            changed = False
            for cmd, fmt in (("textbf", "<strong>%s</strong>"), ("emph", "<em>%s</em>"),
                             ("newword", '<strong class="newword">%s</strong>'), ("footnote", None),
                             ("paragraph", "<strong>%s</strong>")):
                k = s.find("\\" + cmd + "{")
                if k >= 0:
                    arg, e = braced(s, k + len(cmd) + 1)
                    if cmd == "footnote":
                        self.footnotes.append(self.inline(arg))
                        n = len(self.footnotes)
                        rep = '<sup class="fn-ref"><a href="#fn-%d-%d" id="fnr-%d-%d">%d</a></sup>' % (self.lec, n, self.lec, n, n)
                    else:
                        rep = fmt % self.inline(arg)
                    s = s[:k] + rep + s[e:]
                    changed = True
        s = re.sub(r"\\eqref\{([^}]*)\}", lambda m: '<a href="#%s">(%s)</a>' % (self.labels[m.group(1)][1], self.labels[m.group(1)][0]), s)
        s = re.sub(r"\\ref\{([^}]*)\}", lambda m: '<a href="#%s">%s</a>' % (self.labels[m.group(1)][1], self.labels[m.group(1)][0]), s)
        s = re.sub(r"\b[Ee]xercise %d\.(\d+)" % self.lec, lambda m: '<a href="#p%s">%s</a>' % (m.group(1), m.group(0)), s)
        s = re.sub(r"\\label\{[^}]*\}", "", s)
        s = re.sub(r"\\needspace\{[^}]*\}", "", s)
        s = s.replace("``", "\u201c").replace("''", "\u201d").replace("---", "\u2014").replace("--", "\u2013")
        s = re.sub(r"(?<=\w)'", "\u2019", s)
        s = s.replace("~", "\u00a0").replace("\\,", "\u2009").replace("\\ ", " ").replace("\\&", "&amp;")
        s = re.sub(r"\s+", " ", s)
        if "\\" in re.sub(r"@@M\d+@@", "", s):
            sys.exit("unconverted command in: " + s[:200])
        return s

    # ---------------------------------------------------------------- blocks
    def para(self, chunk):
        out = []
        # a paragraph can hold display math: split it around @@D markers
        parts = re.split(r"\n?@@D(@@M\d+@@)\n?", chunk)
        for k, p in enumerate(parts):
            if k % 2:
                out.append(p)
            else:
                t = self.inline(p)
                if t:
                    out.append("<p>%s</p>" % t)
        return "\n".join(out)

    def blocks(self, s):
        out = []
        pos = 0
        pat = re.compile(r"\\begin\{(\w+)\}|\\section\{|\\section\*\{|@@WEB\{([^|}]*)\|([^}]*)\}@@")
        while True:
            m = pat.search(s, pos)
            text = s[pos:m.start() if m else len(s)]
            for chunk in re.split(r"\n\s*\n", text):
                if chunk.strip():
                    out.append(self.para(chunk))
            if not m:
                break
            if m.group(2) is not None:
                out.append('<div class="widget" data-widget="%s" data-args="%s"><noscript><p class="hint">Turn on JavaScript to see this illustration.</p></noscript></div>'
                           % (m.group(2), html.escape(m.group(3))))
                pos = m.end()
                continue
            if m.group(0).startswith("\\section"):
                title, e = braced(s, m.end() - 1)
                title = re.sub(r"\\label\{[^}]*\}", "", title)
                if m.group(0).startswith("\\section*"):
                    out.append('<h3 class="cn-h cn-l1">%s</h3>' % self.inline(title))
                else:
                    self.sec += 1
                    out.append('<h3 class="cn-h cn-l1" id="cn-%d-%d"><span class="cn-num">%d.%d</span> %s</h3>'
                               % (self.lec, self.sec, self.lec, self.sec, self.inline(title)))
                lab = re.match(r"\s*\\label\{[^}]*\}", s[e:])
                pos = e + (lab.end() if lab else 0)
                continue
            env = m.group(1)
            b, e = find_env_end(s, env, m.end())
            body = s[m.end():b]
            pos = e
            if env == "center":
                inner = body.strip()
                mt = re.fullmatch(r"@@T(\d+)@@", inner)
                if mt:
                    out.append(self.tikz(self.tikz_src[int(mt.group(1))]))
                else:
                    out.append('<div class="tex-center">%s</div>' % self.blocks(inner))
            elif env == "tabular":
                out.append(self.tabular(body))
            elif env in ("blockgraybox", "blockwhitebox"):
                out.append('<div class="cn-box%s"><div class="tex-block">%s</div></div>'
                           % (" cn-box-plain" if env == "blockwhitebox" else "", self.blocks(body)))
            elif env == "proof":
                out.append('<div class="tex-proof"><em>Proof.</em> %s</div>' % self.blocks(body))
            elif env in ("example", "remark"):
                title = ""
                if body.lstrip().startswith("["):
                    body = body.lstrip()
                    depth = 0
                    for j, ch in enumerate(body):
                        if ch == "[": depth += 1
                        elif ch == "]":
                            depth -= 1
                            if depth == 0: break
                    title, body = body[1:j], body[j + 1:]
                self.thm += 1
                lab = "%d.%d" % (self.lec, self.thm)
                anchor = "%s-%d-%d" % (env, self.lec, self.thm)
                body = re.sub(r"^\s*\\label\{[^}]*\}", "", body)
                inner = self.blocks(body)
                head = '<strong>%s %s</strong>%s' % (env.capitalize(), lab, " (%s)." % self.inline(title) if title else ".")
                inner = inner.replace("<p>", "<p>" + head + " ", 1) if inner.startswith("<p>") else "<p>" + head + "</p>" + inner
                out.append('<div class="tex-block tex-%s" id="%s">%s</div>' % (env, anchor, inner))
            elif env in ("itemize", "enumerate"):
                items = [x for x in re.split(r"\\item\b", body)[1:]]
                tag = "ul" if env == "itemize" else "ol"
                out.append('<%s class="tex-list">%s</%s>' % (tag, "".join("<li>%s</li>" % self.inline(x) for x in items), tag))
            else:
                sys.exit("unknown environment " + env)
        return "\n".join(x for x in out if x)

    def tabular(self, body):
        spec, e = braced(body, body.index("{"))
        rest = body[e:]
        cols = [c for c in spec if c in "lcr"]
        bars = []
        k = 0
        for ch in spec:
            if ch in "lcr":
                bars.append(False); k += 1
            elif ch == "|" and bars:
                bars[-1] = True
        rows = []
        pending_top = False
        for raw in re.split(r"\\\\", rest):
            r = raw.strip()
            top = False
            while r.startswith("\\hline"):
                top = True; r = r[len("\\hline"):].strip()
            if not r:
                if top and rows: rows[-1][1] = True
                pending_top = pending_top or top
                continue
            cells = [self.inline(c) for c in r.split("&")]
            tds = "".join('<td class="al-%s%s">%s</td>' % ({"l": "left", "c": "center", "r": "right"}[cols[i]],
                                                          " br" if bars[i] and i < len(cols) - 1 else "", c) for i, c in enumerate(cells))
            rows.append([tds, False, top or pending_top])
            pending_top = False
        h = []
        for tds, bottom, top in rows:
            cls = " ".join(x for x in ("ht" if top else "", "hb" if bottom else "") if x)
            h.append('<tr%s>%s</tr>' % (' class="%s"' % cls if cls else "", tds))
        return '<div class="table-wrap"><table class="tex-table">%s</table></div>' % "".join(h)

    def restore(self, h):
        return re.sub(r"@@M(\d+)@@", lambda m: self.math[int(m.group(1))], h)


def main():
    tex_path, lec = sys.argv[1], int(sys.argv[2])
    widgets = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else []
    raw = open(tex_path, encoding="latin1").read()
    for w in widgets:
        k = raw.find(w["after"])
        if k < 0:
            sys.exit("widget anchor not found: " + w["after"])
        # after the end of the paragraph, or of the environment, that contains the anchor
        end = w.get("end")
        if end:
            k = raw.index(end, k) + len(end)
        else:
            k = raw.find("\n\n", k)
        raw = raw[:k] + "\n%%web: %s %s\n" % (w["widget"], w.get("args", "")) + raw[k:]
    s = strip_comments(raw)
    s = s[s.index("\\begin{document}") + len("\\begin{document}"):]
    stop = s.find("\\section*{Exercises}")
    s = s[:stop] if stop >= 0 else s[:s.index("\\end{document}")]
    s = re.sub(r"\\ifteacher.*?\\fi\b", "", s, flags=re.S)
    s = re.sub(r"\\renewcommand\{\\frame\}\{\}|\\providecommand\{\\frametitle\}\{\}", "", s)
    s = re.sub(r"\\lecture\{[^}]*\}\{[^}]*\}\{[^}]*\}", "", s)
    s = re.sub(r"\{\\let\\thefootnote\\relax\\footnotetext\{.*?\}\}", "", s)
    s = re.sub(r"\\needspace\{[^}]*\}", "", s)
    s = re.sub(r"\\renewcommand\{\\arraystretch\}\{[^}]*\}", "", s)
    figdir = os.path.join(SRC, "figures")
    os.makedirs(figdir, exist_ok=True)
    prefix = "lecture-%d" % lec
    for f in os.listdir(figdir):
        if f.startswith(prefix + "-"):
            os.remove(os.path.join(figdir, f))
    c = Converter(lec, figdir, prefix)
    c.number_labels(s)
    s = c.protect_tikz(s)
    s = c.protect_all_math(s)
    h = c.blocks(s)
    if c.footnotes:
        h += '\n<ol class="cn-footnotes">' + "".join('<li id="fn-%d-%d">%s <a href="#fnr-%d-%d" aria-label="Back to the text">&#8617;</a></li>'
                                                    % (lec, k, t, lec, k) for k, t in enumerate(c.footnotes, 1)) + "</ol>"
    h = c.restore(h)
    out = os.path.join(SRC, "content", "lecture-%d-notes.html" % lec)
    with open(out, "w", encoding="utf-8") as f:
        f.write("<!-- Generated by src/tools/notes2html.py from the notes of Lecture %d; do not edit by hand. -->\n" % lec + h + "\n")
    print("wrote", os.path.relpath(out, ROOT), "with", c.sec, "sections,", c.eq, "equations,", len(c.figures), "figures")


if __name__ == "__main__":
    main()
