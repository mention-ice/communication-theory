#!/usr/bin/env python3
"""Build the Communication Theory course website.

    python3 src/build.py            # writes docs/ (served by GitHub Pages)

Inputs, all in src/:
  course.json        course data and the 19 sessions, in teaching order.
                     A session gets its own page once "online": true and "content" is set.
  content/<id>.py    content of one page: summary, files, contents, quiz, exercises
                     (and, for TDs and TPs, links to the interactive pages).
  files/             PDFs and notebooks linked from the pages (copied to docs/files/).
  assets/            style.css, site.js, logos (copied to docs/assets/).

The design follows the site of "Elements of Information Theory"
(https://mention-ice.github.io/information-theory/), in the Mention ICE palette.
docs/ is generated: do not edit it by hand.
"""
import hashlib, heapq, html, json, math, os, random, shutil, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "docs")

MATHJAX_MACROS = {
    "xv": r"\mathbf{x}", "yv": r"\mathbf{y}", "cv": r"\mathbf{c}", "Lv": r"\mathbf{L}",
    "Ccal": r"\mathcal{C}", "Xcal": r"\mathcal{X}", "Ycal": r"\mathcal{Y}",
    "rv": [r"\mathrm{#1}", 1],
}

ICE_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="226 116 444 230" aria-hidden="true">'
           '<circle cx="253.5" cy="142.5" r="22.5" fill="#86144F"/><path d="M253.5 207V315" stroke="#1C1722" stroke-width="42" stroke-linecap="round"/>'
           '<path d="M487.1 161.2A92 92 0 1 0 487.1 302.2" fill="none" stroke="#86144F" stroke-width="36" stroke-linecap="round"/>'
           '<path d="M454.2 198.2A42.5 42.5 0 1 0 454.2 265.2" fill="none" stroke="#706A7F" stroke-width="19" stroke-linecap="round"/>'
           '<circle cx="428" cy="231.7" r="11" fill="#1C1722"/><path d="M573.3 146H645.7M573.3 317.5H645.7" stroke="#1C1722" stroke-width="38.5" stroke-linecap="round"/>'
           '<path d="M573.3 232H608.7" stroke="#706A7F" stroke-width="38.5" stroke-linecap="round"/></svg>')

FAVICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n'
           '<rect width="32" height="32" rx="6" fill="#86144F"/>\n<g fill="#ffffff">'
           + "".join('<circle cx="%g" cy="%g" r="2.3"/>' % (x, y) for x in (7, 12.7, 19.3, 25) for y in (7, 12.7, 19.3, 25) if (x, y) != (25, 25))
           + '</g>\n<circle cx="25" cy="25" r="2.3" fill="#F5A3C7"/>\n</svg>\n')

esc = html.escape


def fnv1a(text):
    h = 0x811C9DC5
    for b in text.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return "%08x" % h


def huffman(text):
    """Huffman code of the letters of text, from their own frequencies (deterministic ties)."""
    freq = Counter(text)
    heap = [(n, i, ch) for i, (ch, n) in enumerate(sorted(freq.items()))]
    heapq.heapify(heap)
    code = {ch: "" for ch in freq}
    groups = {i: [ch] for i, (ch, n) in enumerate(sorted(freq.items()))}
    nxt = len(heap)
    if len(heap) == 1:
        code[heap[0][2]] = "0"
    while len(heap) > 1:
        n0, i0, _ = heapq.heappop(heap)
        n1, i1, _ = heapq.heappop(heap)
        for ch in groups[i0]: code[ch] = "0" + code[ch]
        for ch in groups[i1]: code[ch] = "1" + code[ch]
        groups[nxt] = groups.pop(i0) + groups.pop(i1)
        heapq.heappush(heap, (n0 + n1, nxt, ""))
        nxt += 1
    n = len(text)
    ent = -sum(c / n * math.log2(c / n) for c in freq.values())
    return code, ent


def kb(path):
    return "%d KB" % max(1, round(os.path.getsize(path) / 1024))


def head(title, desc, math=False, extra=""):
    mj = ""
    if math:
        cfg = {"tex": {"inlineMath": [["\\(", "\\)"]], "displayMath": [["\\[", "\\]"]], "macros": MATHJAX_MACROS},
               "svg": {"fontCache": "global"},
               "options": {"skipHtmlTags": ["script", "noscript", "style", "textarea", "pre", "code"]}}
        mj = ('<script>window.MathJax = %s;</script>\n'
              '<script defer id="MathJax-script" src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js"></script>\n'
              % json.dumps(cfg))
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&amp;family=Space+Mono:ital,wght@0,400;0,700;1,400&amp;family=Bricolage+Grotesque:opsz,wght@12..96,700&amp;display=swap">
<link rel="stylesheet" href="assets/style.css">
{mj}<script defer src="assets/site.js"></script>
{extra}</head>
<body>
<canvas id="bitfield" aria-hidden="true"></canvas>
"""


def logo_bar():
    return ('<div class="logo-bar" data-quiet><div class="wrap">'
            '<a class="ice-lockup" href="https://mention-ice.github.io/" aria-label="Mention Information &amp; Communication Engineering">'
            + ICE_SVG + '<span>Information &amp;<br>Communication Engineering</span></a>'
            '<a href="https://www.centralesupelec.fr/"><img class="cs-logo" src="assets/centralesupelec.png" alt="CentraleSupélec" width="390" height="200"></a>'
            '</div></div>\n')


def footer(C):
    return f"""<footer class="site-footer" data-quiet>
  <div class="wrap footer-grid">
    <p class="footer-who">{esc(C['title'])} &middot; {C['year']}<br><a href="{C['lecturer_url']}">{esc(C['lecturer'])}</a> &middot; {esc(C['school'])} &middot; <a href="mailto:{C['email']}">{C['email']}</a>{''.join(f' &middot; <a href="{r["url"]}">{esc(r["name"])}</a>' for r in C.get('related', []))}<br>{esc(C['copyright'])}</p>
  </div>
</footer>
</div>
</body>
</html>
"""


def binlabel(i):
    return format(i, "05b")


def has_page(s):
    return s.get("online") and s.get("content")


def load_content(s):
    ns = {}
    with open(os.path.join(SRC, s["content"]), encoding="utf-8") as f:
        exec(compile(f.read(), s["content"], "exec"), ns)
    return ns["PAGE"]


def page_links(s, P):
    links = []
    if P.get("summary") or P.get("files"): links.append(("notes", "Notes" if s["kind"] == "lecture" else "Material", None))
    if P.get("quiz"): links.append(("quiz", "Quiz", len(P["quiz"])))
    if P.get("exercises"): links.append(("exercises", "Exercises", len(P["exercises"])))
    return links


# ------------------------------------------------------------------ home page

def qam_svg():
    cx = cy = 112; u = 22
    parts = [f'<svg class="qam-chart" viewBox="0 0 224 224" role="img" aria-label="16QAM constellation: sent points as rings, received points as dots, wrongly decided points marked" data-cx="{cx}" data-cy="{cy}" data-unit="{u}">']
    for k in (-2, 0, 2):
        cls = "axis" if k == 0 else "cell"
        parts.append(f'<line class="{cls}" x1="{cx + k*u}" y1="8" x2="{cx + k*u}" y2="216"/>')
        parts.append(f'<line class="{cls}" x1="8" y1="{cy + k*u}" x2="216" y2="{cy + k*u}"/>')
    parts.append('<g data-cloud></g>')
    for a in (-3, -1, 1, 3):
        for b in (-3, -1, 1, 3):
            parts.append(f'<circle class="tx" cx="{cx + a*u}" cy="{cy - b*u}" r="4.2"/>')
    parts.append('</svg>')
    return "\n".join(parts)


def build_index(C):
    title = C["title"]
    code, ent = huffman(title)
    bits = "".join(code[ch] for ch in title)
    bpc = len(bits) / len(title)
    sessions = C["sessions"]
    items = []
    for i, s in enumerate(sessions, 1):
        part = C["parts"][s["part"]]["name"]
        kind = {"lecture": "Lecture", "td": "TD · tutorial", "tp": "TP · lab"}[s["kind"]]
        if has_page(s):
            P = load_content(s)
            lk = " ".join(f'<a href="{s["id"]}.html#{a}">{t}' + (f' <span class="count">{n}</span>' if n else "") + "</a>" for a, t, n in page_links(s, P))
            items.append(f"""<li class="lec is-online">
  <div class="lec-id"><span class="lec-n">{esc(s['label'])}</span><span class="lec-bin" title="session {i} in binary">{binlabel(i)}</span></div>
  <div class="lec-main">
    <h3><a href="{s['id']}.html">{esc(s['title'])}</a></h3>
    <p class="lec-head"><span class="part-tag part-{s['part']}">{esc(part)}</span><span class="lec-kind">{kind}</span>{(' <span class="lec-date">' + esc(s['date']) + '</span>') if s.get('date') else ''}</p>
    <p class="lec-links">{lk}</p>
  </div>
</li>""")
        else:
            items.append(f"""<li class="lec is-upcoming">
  <div class="lec-id"><span class="lec-n">{esc(s['label'])}</span><span class="lec-bin" title="session {i} in binary">{binlabel(i)}</span></div>
  <div class="lec-main">
    <h3>{esc(s['title'])}</h3>
    <p class="lec-head"><span class="part-tag part-{s['part']}">{esc(part)}</span><span class="lec-kind">{kind}</span></p>
    <p class="lec-date">Online after the session</p>
  </div>
</li>""")
    pres = C.get("presentation")
    pres_html = ""
    if pres:
        fp = os.path.join(SRC, "files", pres["file"])
        pres_html = f'<div class="files"><a class="file-btn" href="files/{pres["file"]}"><span class="file-kind">PDF</span><span class="file-name">{esc(pres["name"])}</span><span class="file-size">{kb(fp)}</span></a></div>'
    refs = "".join(f"<li>{esc(r)}</li>" for r in C["references"])
    related_html = ""
    if C.get("related"):
        cards = "".join(f'<a class="file-btn" href="{r["url"]}"><span class="file-kind">WEB</span><span class="file-name">{esc(r["name"])}</span><span class="file-size">{esc(r["url"].split("//")[1].rstrip("/"))}</span></a><p class="hint related-note">{esc(r["note"])}</p>' for r in C["related"])
        related_html = f'  <section class="block" id="related" aria-labelledby="related-h"><div class="block-head"><h2 id="related-h">Going further</h2></div><div class="files">{cards}</div></section>'

    key = "".join(f'<span><span class="part-tag part-{k}">{esc(v["name"])}</span></span>' for k, v in C["parts"].items())
    out = head(title, f"{title}: lecture notes, tutorials (TD) with corrections and labs (TP) with solutions. {C['school']}, {C['level']}, {C['year']}.")
    out += '<div class="page page-home">\n' + logo_bar()
    out += f"""
<header class="hero">
  <div class="wrap hero-grid">
    <div class="hero-text" data-quiet>
      <p class="eyebrow">{esc(C['school'])} &middot; {esc(C['level'])} &middot; {C['year']}</p>
      <h1>{esc(title)}</h1>
      <p class="byline">Lecturer: <a href="{C['lecturer_url']}">{esc(C['lecturer'])}</a></p>
      <blockquote class="shannon"><p>&ldquo;<em>The fundamental problem of communication is that of reproducing at one point either exactly or approximately a message selected at another point.</em>&rdquo;</p><footer>Claude Shannon, <cite>A mathematical theory of communication</cite>, 1948</footer></blockquote>
    </div>
    <figure class="h2-widget" data-qam>
      {qam_svg()}
      <div class="h2-control">
        <label for="snr">Signal-to-noise ratio <i>E</i><sub>s</sub>/<i>N</i><sub>0</sub></label>
        <input id="snr" type="range" min="0" max="24" step="0.5" value="16">
      </div>
      <figcaption class="h2-read" aria-live="polite">
        <span><i>E</i><sub>s</sub>/<i>N</i><sub>0</sub> = <b data-out="snr">16.0</b> dB</span>
        <span>wrong symbols: <b data-out="ser">–</b></span>
        <span>bit error probability = <b data-out="ber">–</b></span>
        <span>capacity log&#8322;(1 + SNR) = <b data-out="cap">–</b> bits per symbol; 16QAM sends 4</span>
      </figcaption>
    </figure>
  </div>
  <div class="channel" data-channel data-bits="{bits}" data-p="0.01" aria-label="The course title, Huffman-coded, sent through the binary channel made by 16QAM hard decisions">
    <div class="wrap channel-grid">
      <span class="ch-label">X<sup>n</sup></span>
      <div class="ch-row ch-x" data-row="x">{bits}</div>
      <span class="ch-label ch-mid">BSC(<i>p</i>)</span>
      <div class="ch-meter"><span data-out="phat">p&#770; = –</span></div>
      <span class="ch-label">Y<sup>n</sup></span>
      <div class="ch-row ch-y" data-row="y">{bits}</div>
    </div>
    <p class="wrap ch-caption">Above: 16QAM symbols through Gaussian noise; the dashed lines are the decision boundaries and <span class="flip-key">orange dots</span> are wrongly decided. X<sup>n</sup>: the course title, Huffman-coded ({len(bits)} bits, {bpc:.2f} bits per character against an entropy of {ent:.2f}). Y<sup>n</sup>: the same bits after hard decisions on Gray-labelled 16QAM at this SNR, a binary symmetric channel; <span class="flip-key">flipped bits</span> are marked. Drag the SNR above.</p>
  </div>
</header>
<div class="sheet-wrap wrap"><main class="sheet">
  <section class="block" id="sessions" aria-labelledby="sessions-h">
    <div class="block-head"><h2 id="sessions-h">Sessions</h2><p class="block-sub">19 sessions of 1 h 30, in teaching order. Each page goes online after its session.</p></div>
    <div class="parts-key">{key}</div>
    <ol class="lectures">
{chr(10).join(items)}
    </ol>
  </section>
  <section class="block" id="how" aria-labelledby="how-h">
    <div class="block-head"><h2 id="how-h">How the course works</h2></div>
    <ul class="how">
      <li><h3>Lectures</h3><p>Theory on the blackboard: definitions, proofs, examples. The lecture notes are posted here, lecture by lecture. Take your own notes.</p></li>
      <li><h3>TD (tutorials)</h3><p>One exam-style problem on paper, then an interactive web page where you compute and the page checks every step. Bring a laptop, a tablet or a phone. Corrections are posted here.</p></li>
      <li><h3>TP (labs)</h3><p>Python notebooks: you write the decoders and the receiver, on real rooms recorded with a phone. Attendance is mandatory. Solutions are posted here.</p></li>
    </ul>
    <p class="eval"><b>Evaluation.</b> A 2-hour written exam, documents allowed, gives the final score. The four TPs are mandatory: your work is handed in at the end of each session and is evaluated as part of the “compétence”, not in the final score.</p>
    {pres_html}
  </section>
{related_html}
  <section class="block" id="references" aria-labelledby="refs-h"><div class="block-head"><h2 id="refs-h">References</h2></div><ul class="refs">{refs}</ul><p class="hint">Further reading: {esc(C['further_reading'])}</p></section>
</main></div>
"""
    out += footer(C)
    return out


# ------------------------------------------------------------------ session pages

def build_session(C, s, prev, nxt):
    P = load_content(s)
    title = C["title"]
    code, ent = huffman(s["title"])
    cws = []
    for k, ch in enumerate(s["title"]):
        name = "space" if ch == " " else esc(ch)
        cws.append(f'<span class="cw cw{k % 2}" title="{name} &rarr; {code[ch]}">{code[ch]}</span>')
    nbits = sum(len(code[ch]) for ch in s["title"])
    links = page_links(s, P)
    jump = "".join(f'<a href="#{a}">{t}' + (f' <span class="count">{n}</span>' if n else "") + "</a>" for a, t, n in links)
    o = head(f"{s['label']}: {s['title']} · {title}", f"{s['label']} of {title}: " + ", ".join(t.lower() for _, t, _ in links) + ".", math=True)
    o += '<div class="page page-lecture">\n' + logo_bar()
    o += f"""
<header class="lec-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">&larr; {esc(title)}</a></nav>
    <div class="lecture-box">
      <div class="lb-top"><span>{esc(title)}</span><span>{C['year']}</span></div>
      <h1><span class="lb-n">{esc(s['label'])}:</span> {esc(s['title'])}</h1>
      <div class="lb-bottom"><span class="lb-lect">Lecturer: <a href="{C['lecturer_url']}">{esc(C['lecturer'])}</a></span><span>{esc(s.get('date') or C['parts'][s['part']]['name'])}</span></div>
    </div>
    <div class="huff" data-quiet>
  <p class="huff-bits" aria-hidden="true">{''.join(cws)}</p>
  <p class="huff-cap">The title above, Huffman-coded from its own letter frequencies: {nbits} bits, {nbits/len(s['title']):.2f} bits per character (entropy {ent:.2f}). Alternate shading separates the codewords.</p>
</div>
    <nav class="jump" aria-label="On this page" data-quiet>{jump}</nav>
  </div>
</header>
<div class="sheet-wrap wrap"><main class="sheet">
"""
    if P.get("summary") or P.get("files"):
        o += '<section class="block" id="notes" aria-labelledby="notes-h">\n'
        o += f'  <div class="block-head"><h2 id="notes-h">{"Lecture notes" if s["kind"] == "lecture" else "Material"}</h2></div>\n'
        if P.get("summary"):
            o += '  <div class="summary cn-summary"><h3 class="minor">Summary</h3><ul class="tex-list">' + "".join(f"<li>{x}</li>" for x in P["summary"]) + "</ul></div>\n"
        if P.get("files"):
            btns = []
            for f in P["files"]:
                fp = os.path.join(SRC, f["path"])
                ext = os.path.splitext(fp)[1].lstrip(".").upper()
                kind = {"IPYNB": "NB"}.get(ext, ext)
                btns.append(f'<a class="file-btn" href="{f["path"]}"><span class="file-kind">{kind}</span><span class="file-name">{esc(f["name"])}</span><span class="file-size">{kb(fp)}</span></a>')
            for l in P.get("links", []):
                btns.append(f'<a class="file-btn" href="{l["url"]}"><span class="file-kind">WEB</span><span class="file-name">{esc(l["name"])}</span><span class="file-size">page</span></a>')
            o += '  <div class="files">' + "".join(btns) + "</div>\n"
        if P.get("contents"):
            o += '  <h3 class="minor">Contents</h3><ol class="outline">' + "".join(f'<li class="o-l1"><span class="o-num">{n}</span> {t}</li>' for n, t in P["contents"]) + "</ol>\n"
        o += "</section>\n"
    if P.get("quiz"):
        Q = P["quiz"]; n = len(Q)
        o += f"""<section class="block" id="quiz" aria-labelledby="quiz-h">
  <div class="block-head"><h2 id="quiz-h">Quiz</h2><p class="block-sub">{n} questions &middot; one correct answer each</p></div>
  <p class="hint">Pick an answer to check it. Your answers are kept in this browser only.</p>
  <noscript><p class="hint">Turn on JavaScript to check your answers.</p></noscript>
  <div class="scoreboard" data-board>
    <div class="score-bits" data-score-bits></div>
    <p class="score-text" data-score-text>0 of {n} answered</p>
    <button type="button" class="btn-quiet" data-reset>Start again</button>
  </div>
  <ol class="quiz" data-quiz="{s['id']}">
"""
        for k, q in enumerate(Q, 1):
            key = hashlib.sha1(f"{s['id']}:{q['q']}".encode()).hexdigest()[:8]
            check = ",".join(fnv1a(f"{key}:{L}") for L in q["key"])
            opts = "".join(f'<button type="button" class="opt" data-letter="{L}"><span class="opt-letter">{L}</span><span class="opt-text">{t}</span></button>'
                           for L, t in zip("ABCDEFGH", q["opts"]))
            o += f"""<li class="q" id="q{k}" data-key="{key}" data-check="{check}">
  <div class="q-num" aria-hidden="true">Q{k}</div>
  <div class="q-body">
    <div class="q-stem"><p>{q['q']}</p></div>
    <div class="q-opts" role="group" aria-label="Answers to question {k}">{opts}</div>
    <p class="q-feedback" aria-live="polite"></p>
  </div>
</li>
"""
        o += "  </ol>\n</section>\n"
    if P.get("exercises"):
        E = P["exercises"]
        o += f'<section class="block" id="exercises" aria-labelledby="exo-h">\n  <div class="block-head"><h2 id="exo-h">Exercises</h2><p class="block-sub">{len(E)} problems</p></div>\n  <ol class="problems">\n'
        for k, e in enumerate(E, 1):
            sol = ""
            if e.get("solution"):
                sol = f'\n  <details class="solution"><summary>Solution</summary><div class="solution-body">{e["solution"]}</div></details>'
            o += f"""<li class="problem" id="p{k}">
  <h3 class="p-head"><span class="p-num">Problem {k}</span> <span class="p-title">{e['title']}</span></h3>
  <div class="p-body">{e['body']}</div>{sol}
</li>
"""
        o += "  </ol>\n</section>\n"
    pv = f'<a href="{prev["id"]}.html"><span class="dir">&larr; {esc(prev["label"])}</span><span class="ttl">{esc(prev["title"])}</span></a>' if prev else "<span></span>"
    nx = f'<a class="next" href="{nxt["id"]}.html"><span class="dir">{esc(nxt["label"])} &rarr;</span><span class="ttl">{esc(nxt["title"])}</span></a>' if nxt else ""
    if prev or nxt:
        o += f'<nav class="pager" aria-label="Other sessions">{pv}{nx}</nav>\n'
    o += "</main></div>\n" + footer(C)
    return o


def main():
    with open(os.path.join(SRC, "course.json"), encoding="utf-8") as f:
        C = json.load(f)
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "assets"))
    for name in os.listdir(os.path.join(SRC, "assets")):
        shutil.copy2(os.path.join(SRC, "assets", name), os.path.join(OUT, "assets", name))
    with open(os.path.join(OUT, "assets", "favicon.svg"), "w") as f:
        f.write(FAVICON)
    if os.path.isdir(os.path.join(SRC, "files")):
        shutil.copytree(os.path.join(SRC, "files"), os.path.join(OUT, "files"))
    open(os.path.join(OUT, ".nojekyll"), "w").close()
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(build_index(C))
    online = [s for s in C["sessions"] if has_page(s)]
    for i, s in enumerate(online):
        prev = online[i - 1] if i > 0 else None
        nxt = online[i + 1] if i + 1 < len(online) else None
        with open(os.path.join(OUT, s["id"] + ".html"), "w", encoding="utf-8") as f:
            f.write(build_session(C, s, prev, nxt))
    print("built docs/: index.html +", ", ".join(s["id"] + ".html" for s in online) or "no session page")


if __name__ == "__main__":
    main()
