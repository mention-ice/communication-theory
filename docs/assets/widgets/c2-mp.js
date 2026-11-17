/* Lecture 2, Section 2.7: message passing on the graph of the (7,4) Hamming code of Section 2.4.
   Bits (circles) and checks (squares) exchange LLRs, LLR = ln p(y|0)/p(y|1): a positive value points to 0.
   - Bits to checks: each bit sends to each of its checks its channel LLR plus what its OTHER checks said.
   - Checks to bits: each check sends to each of its bits the product of the signs and the smallest magnitude
     of what its OTHER bits said (min rule), or 2 artanh of the product of tanh(m/2) (exact rule).
   On the BEC the LLRs are +inf, -inf or 0, and message passing is peeling (example of Section 2.6).
   Colours use the sent codeword 1011010, which the decoder does not know.
   Draws into every [data-widget="c2-mp"]. No libraries. */
(function () {
  "use strict";
  var NAME = "c2-mp", SVGNS = "http://www.w3.org/2000/svg";
  var CHK = [[0, 1, 3, 4], [0, 2, 3, 5], [1, 2, 3, 6]];   // the three rows of H
  var SENT = [1, 0, 1, 1, 0, 1, 0];
  var BCH = [[], [], [], [], [], [], []];                  // the checks of each bit
  CHK.forEach(function (c, j) { c.forEach(function (i) { BCH[i].push(j); }); });
  var EXAMPLES = {
    one: [-2.0, 1.6, -1.8, -2.4, -0.6, -1.9, 2.2],          // bit 5 wrong
    two: [-2.2, -0.3, -1.9, -2.5, 1.7, -2.0, -0.3]          // bits 2 and 7 wrong
  };
  var BEC0 = [true, false, false, true, false, true, false]; // the example of Section 2.6
  var MAXIT = 10;
  var NOTML = "Message passing is not ML: this graph has cycles, so messages come back to where they started, and the decoder can be fooled.";
  var WIDE = { W: 760, XC: [240, 400, 560], XB: [100, 200, 300, 400, 500, 600, 700], YC: 46, CS: 40,
    YCC: 84, YCB: 206, CW: 34, CH: 28, YB: 270, RB: 20, YN: 312, YV: 333, YT: 354, H: 372, R: 5 };
  var NARROW = { W: 644, XC: [174, 312, 450], XB: [36, 128, 220, 312, 404, 496, 588], YC: 40, CS: 56,
    YB: 300, RB: 28, YN: 360, YV: 394, YT: 430, H: 448, R: 9 };
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function svg(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function txt(parent, x, y, s, cls) { var t = svg("text", { x: x, y: y, "class": cls, "text-anchor": "middle" }, parent); t.textContent = s; return t; }
  function sub(parent, x, y, base, idx, cls) {   // x_1 with a lowered index
    var t = svg("text", { x: x, y: y, "class": cls, "text-anchor": "middle" }, parent);
    svg("tspan", {}, t).textContent = base;
    svg("tspan", { dy: "0.28em", "font-size": "72%" }, t).textContent = idx;
    return t;
  }
  function fmt(v) {
    if (v === Infinity) return "+∞";
    if (v === -Infinity) return "−∞";
    if (v !== v || Math.abs(v) < 0.05) return "0";
    return (v > 0 ? "+" : "−") + Math.abs(v).toFixed(1);
  }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function checkRule(vals, rule) {
    if (rule === "min") {
      var s = 1, m = Infinity;
      vals.forEach(function (v) { s *= sgn(v); m = Math.min(m, Math.abs(v)); });
      return s === 0 ? 0 : s * m;
    }
    var p = 1;
    vals.forEach(function (v) { p *= v === Infinity ? 1 : v === -Infinity ? -1 : Math.tanh(v / 2); });
    if (p >= 1) return Infinity;
    if (p <= -1) return -Infinity;
    return Math.log((1 + p) / (1 - p));   // 2 artanh(p)
  }
  function word(d) { return d.map(function (b) { return b === null ? "?" : String(b); }).join(""); }
  function list(a) { return a.length === 1 ? String(a[0]) : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function plural(a, one, many) { return a.length > 1 ? many : one; }
  function syndromeDecode(h) {   // the decoder of Section 2.5: flip the bit whose column is the syndrome
    var s = CHK.map(function (c) { return c.reduce(function (a, i) { return a ^ h[i]; }, 0); });
    var w = s[0] + s[1] + s[2], out = h.slice();
    if (w) for (var i = 0; i < 7; i++) if (BCH[i].length === w && BCH[i].every(function (j) { return s[j] === 1; })) out[i] ^= 1;
    return out;
  }
  function tone(v, i) { return v !== v || Math.abs(v) < 0.05 ? "is-zero" : (v > 0 ? 0 : 1) === SENT[i] ? "is-ok" : "is-bad"; }

  function build(root) {
    var S = { mode: "noise", ex: "two", rule: "min", snr: 0, L: EXAMPLES.two.slice(), erased: BEC0.slice(),
      Lc: null, step: 0, b2c: {}, c2b: {}, done: false, known: 0, prevD: null, news: "",
      sel: { t: "c", i: 0 }, playing: false, busy: false, narrow: false, timer: 0 };
    root.innerHTML = "";
    var box = el("div", "cw mp");
    box.appendChild(el("p", "cw-title", "Try it: message passing on the (7,4) Hamming code"));
    box.appendChild(el("p", "cw-readout mp-lead", "The graph of the Hamming code of Section 2.4: a square for each check (row of <i>H</i>), " +
      "a circle for each bit, an edge when the check involves the bit. This <i>H</i> is too small to be called sparse, but the graph shows every step of the decoder. " +
      "A step moves messages along all the edges at once: from the bits to the checks, then back."));

    function toggle(label, items, get, set) {
      var wrap = el("span", "cw-ctl", label), tg = el("span", "cw-toggle"), bs = [];
      tg.setAttribute("role", "group"); tg.setAttribute("aria-label", label);
      items.forEach(function (it) {
        var b = el("button", null, it[1]); b.type = "button";
        b.addEventListener("click", function () { set(it[0]); });
        tg.appendChild(b); bs.push([it[0], b]);
      });
      wrap.appendChild(tg);
      wrap.sync = function () { bs.forEach(function (p) { p[1].setAttribute("aria-pressed", get() === p[0] ? "true" : "false"); }); };
      return wrap;
    }
    var row1 = el("div", "cw-controls");
    var tMode = toggle("channel", [["noise", "general"], ["bec", "BEC"]], function () { return S.mode; },
      function (v) { if (v === S.mode) return; S.mode = v; S.sel = v === "bec" ? { t: "c", i: 2 } : { t: "c", i: 0 }; reset(); });
    var tEx = toggle("example", [["one", "1 wrong"], ["two", "2 wrong"], ["rand", "random"]], function () { return S.ex; },
      function (v) { S.ex = v; if (v === "rand") drawNoise(); else S.L = EXAMPLES[v].slice(); reset(); });
    var tRule = toggle("check rule", [["min", "min"], ["exact", "exact"]], function () { return S.rule; }, function (v) { S.rule = v; reset(); });
    var becReset = el("button", "cw-btn", "Section 2.6 example"); becReset.type = "button";
    becReset.addEventListener("click", function () { S.erased = BEC0.slice(); reset(); });
    [tMode, tEx, tRule, becReset].forEach(function (n) { row1.appendChild(n); });
    box.appendChild(row1);

    var row2 = el("div", "cw-controls");
    var snrWrap = el("label", "cw-ctl", "E<sub>s</sub>/N<sub>0</sub>");
    var snr = el("input"); snr.type = "range"; snr.min = "-3"; snr.max = "6"; snr.step = "0.5"; snr.value = "0";
    var snrVal = el("span", "cw-ctl-val", "0 dB");
    snrWrap.appendChild(snr); snrWrap.appendChild(snrVal);
    var redraw = el("button", "cw-btn", "New noise"); redraw.type = "button";
    row2.appendChild(snrWrap); row2.appendChild(redraw);
    box.appendChild(row2);

    var row3 = el("div", "cw-controls");
    var bStep = el("button", "cw-btn cw-primary", "Step"); bStep.type = "button";
    var bPlay = el("button", "cw-btn", "Play"); bPlay.type = "button";
    var bReset = el("button", "cw-btn", "Reset"); bReset.type = "button";
    var where = el("span", "cw-ctl mp-where", "");
    [bStep, bPlay, bReset, where].forEach(function (n) { row3.appendChild(n); });
    box.appendChild(row3);

    var fig = el("div", "cw-figure mp-fig"); box.appendChild(fig);
    var read = el("p", "cw-readout"); read.setAttribute("aria-live", "polite"); box.appendChild(read);
    var detail = el("div", "mp-detail"); box.appendChild(detail);
    var llrWrap = el("label", "cw-ctl mp-llr");
    var llrName = el("span", null, "");
    var llr = el("input"); llr.type = "range"; llr.min = "-6"; llr.max = "6"; llr.step = "0.1";
    var llrVal = el("span", "cw-ctl-val", "");
    llrWrap.appendChild(llrName); llrWrap.appendChild(llr); llrWrap.appendChild(llrVal);
    var tableBox = el("div", "cw-table-wrap");
    detail.appendChild(llrWrap); detail.appendChild(tableBox);
    box.appendChild(el("p", "cw-note", "The sent codeword is 1011010. A message or an LLR is green when it points to the sent bit, " +
      "red when it points to the other one (✗ marks a wrong decision), dotted when it is 0. The colours are for us: the decoder does not know the sent codeword. " +
      "An orange check is not satisfied by the current decisions. Under each bit: its LLR from the channel, then its total once the checks have spoken. " +
      "Click a check or a bit to see its messages; with the BEC, a click on a bit erases it or restores it."));
    root.appendChild(box);

    // ---- the figure ----
    var G = null;
    function chipX(g, j, i, side) {
      if (side === "c") return g.XC[j] + (CHK[j].indexOf(i) - (CHK[j].length - 1) / 2) * 36;
      return g.XB[i] + (BCH[i].indexOf(j) - (BCH[i].length - 1) / 2) * 36;
    }
    function ends(g, k) {   // [bit end, check end] of the edge k = "j-i"
      var j = +k.split("-")[0], i = +k.split("-")[1];
      if (g === NARROW) return [[g.XB[i], g.YB - g.RB], [g.XC[j], g.YC + g.CS / 2]];
      return [[chipX(g, j, i, "b"), g.YCB], [chipX(g, j, i, "c"), g.YCC + g.CH]];
    }
    function makeChip(parent, g, x, y, base, idx) {
      var c = svg("g", { "class": "mp-chip" }, parent);
      svg("rect", { x: x - g.CW / 2, y: y, width: g.CW, height: g.CH, rx: 5 }, c);
      sub(c, x - 2, y + 10, base, idx, "k");
      c.v = txt(c, x, y + 23, "–", "v");
      return c;
    }
    function buildSvg() {
      var g = S.narrow ? NARROW : WIDE;
      fig.innerHTML = "";
      var s = svg("svg", { viewBox: "0 0 " + g.W + " " + g.H, role: "group",
        "aria-label": "Graph of the (7,4) Hamming code: three checks above, seven bits below, an edge where a check involves a bit." }, fig);
      G = { s: s, g: g, edges: {}, cchips: {}, bchips: {}, bits: [], checks: [], rowC: null, rowB: null };
      var gE = svg("g", {}, s);
      if (g === WIDE) {
        G.rowC = svg("g", { "class": "mp-row" }, s); G.rowB = svg("g", { "class": "mp-row" }, s);
        svg("text", { x: 8, y: g.YV, "class": "mp-cap" }, s).textContent = "channel";
        svg("text", { x: 8, y: g.YT, "class": "mp-cap" }, s).textContent = "total";
      }
      CHK.forEach(function (c, j) {
        c.forEach(function (i) {
          var k = j + "-" + i, e = ends(g, k);
          if (g === WIDE) {
            svg("path", { "class": "mp-stub", d: "M" + g.XC[j] + " " + (g.YC + g.CS / 2) + " L" + e[1][0] + " " + g.YCC }, gE);
            svg("path", { "class": "mp-stub", d: "M" + e[0][0] + " " + (g.YCB + g.CH) + " L" + g.XB[i] + " " + (g.YB - g.RB) }, gE);
            G.cchips[k] = makeChip(G.rowC, g, e[1][0], g.YCC, "x", i + 1);
            G.bchips[k] = makeChip(G.rowB, g, e[0][0], g.YCB, "c", j + 1);
          }
          G.edges[k] = svg("path", { "class": "mp-edge", d: "M" + e[1][0] + " " + e[1][1] + " L" + e[0][0] + " " + e[0][1] }, gE);
        });
      });
      CHK.forEach(function (c, j) {
        var n = svg("g", { "class": "mp-node mp-check", tabindex: "0", role: "button" }, s);
        svg("rect", { "class": "mp-shape", x: g.XC[j] - g.CS / 2, y: g.YC - g.CS / 2, width: g.CS, height: g.CS, rx: 4 }, n);
        sub(n, g.XC[j] - 2, g.YC + g.CS * 0.12, "c", j + 1, "cn");
        hook(n, function () { S.sel = { t: "c", i: j }; draw(); });
        G.checks.push(n);
      });
      SENT.forEach(function (x, i) {
        var n = svg("g", { "class": "mp-node mp-bit", tabindex: "0", role: "button" }, s);
        svg("circle", { "class": "mp-shape", cx: g.XB[i], cy: g.YB, r: g.RB }, n);
        n.d = txt(n, g.XB[i], g.YB + g.RB * 0.3, "", "d");
        n.x = txt(n, g.XB[i] + g.RB + (g === WIDE ? 9 : 10), g.YB - g.RB * 0.45, "✗", "mp-x");
        n.x.setAttribute("aria-hidden", "true");
        sub(s, g.XB[i] - 2, g.YN, "x", i + 1, "mp-name");
        n.val = txt(s, g.XB[i], g.YV, "", "mp-val");
        n.tot = txt(s, g.XB[i], g.YT, "", "mp-tot");
        hook(n, function () {
          S.sel = { t: "b", i: i };
          if (S.mode === "bec") { S.erased[i] = !S.erased[i]; reset(); } else draw();
        });
        G.bits.push(n);
      });
      G.dots = svg("g", { "aria-hidden": "true" }, s);
    }
    function hook(n, f) {
      n.addEventListener("click", f);
      n.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); f(); } });
    }

    // ---- the decoder ----
    function channel() {
      return S.mode === "bec" ? SENT.map(function (x, i) { return S.erased[i] ? 0 : x ? -Infinity : Infinity; }) : S.L.slice();
    }
    function totals() {
      return S.Lc.map(function (l, i) {
        var t = l; BCH[i].forEach(function (j) { t += S.c2b[j + "-" + i]; });
        return t !== t ? 0 : t;
      });
    }
    function decisions(t) { return t.map(function (v) { return v > 0 ? 0 : v < 0 ? 1 : null; }); }
    function checkState(d) {
      return CHK.map(function (c) {
        if (c.some(function (i) { return d[i] === null; })) return null;
        return c.reduce(function (a, i) { return a ^ d[i]; }, 0) === 0;
      });
    }
    function bitToCheck(j, i) {
      var v = S.Lc[i]; BCH[i].forEach(function (k) { if (k !== j) v += S.c2b[k + "-" + i]; });
      return v !== v ? 0 : v;
    }
    function checkToBit(j, i) {
      return checkRule(CHK[j].filter(function (k) { return k !== i; }).map(function (k) { return S.b2c[j + "-" + k]; }), S.rule);
    }
    function reset() {
      stopPlay();
      S.Lc = channel(); S.step = 0; S.done = false; S.b2c = {}; S.c2b = {}; S.news = "";
      CHK.forEach(function (c, j) { c.forEach(function (i) { S.c2b[j + "-" + i] = 0; }); });
      S.known = S.Lc.filter(function (v) { return v !== 0; }).length;
      S.prevD = decisions(S.Lc);
      draw();
    }
    function drawNoise() {   // channel LLRs of BPSK on the Gaussian channel: N(+-mu, 2 mu), mu = 4 Es/N0
      var mu = 4 * Math.pow(10, S.snr / 10);
      S.L = SENT.map(function (x) {
        var g = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
        var l = (x ? -mu : mu) + Math.sqrt(2 * mu) * g;
        return Math.max(-9.9, Math.min(9.9, Math.round(l * 10) / 10));
      });
    }
    function doStep() {
      if (S.done || S.busy) return;
      var phase = S.step % 2 === 0 ? "b2c" : "c2b";
      if (phase === "b2c") {
        CHK.forEach(function (c, j) { c.forEach(function (i) { S.b2c[j + "-" + i] = bitToCheck(j, i); }); });
      } else {
        var nc = {};
        CHK.forEach(function (c, j) { c.forEach(function (i) { nc[j + "-" + i] = checkToBit(j, i); }); });
        S.c2b = nc;
      }
      S.step++;
      if (phase === "c2b") evaluate();
      animate(phase, draw);
    }
    function evaluate() {
      var it = S.step / 2, t = totals(), d = decisions(t), st = checkState(d);
      var idx = function (f) { return d.map(function (b, i) { return f(b, i) ? i + 1 : 0; }).filter(Boolean); };
      if (S.mode === "bec") {
        var now = t.filter(function (v) { return v !== 0; }).length;
        var found = idx(function (b, i) { return b !== null && S.prevD[i] === null; }), left = idx(function (b) { return b === null; });
        if (now === 7) S.news = (found.length ? "Found: " + plural(found, "bit ", "bits ") + list(found) + ". " : "") + "All the bits are known: " + word(d) + ", the sent codeword.";
        else if (now === S.known) S.news = "No new bit: every check that still has erased bits has at least two of them, so it sends 0. " +
          "Peeling stops with " + plural(left, "bit ", "bits ") + list(left) + " still erased. Would ML find " + plural(left, "it", "them") + "? See exercise 2.12.";
        else S.news = "Found: " + plural(found, "bit ", "bits ") + list(found) + ". Still erased: " + plural(left, "bit ", "bits ") + list(left) + ".";
        S.done = now === 7 || now === S.known;
        S.known = now;
      } else {
        var wrong = idx(function (b, i) { return b !== SENT[i]; }), bad = st.map(function (ok, j) { return ok ? 0 : j + 1; }).filter(Boolean);
        var flips = idx(function (b, i) { return b !== S.prevD[i]; });
        var head = flips.length ? plural(flips, "Bit ", "Bits ") + list(flips) + plural(flips, " flips. ", " flip. ") : "No decision changes. ";
        if (!bad.length) {
          S.done = true;
          S.news = head + "All the checks are satisfied, so the decoder stops with " + word(d) + (wrong.length ? ": a codeword, but not the sent one. " + NOTML : ", the sent codeword.");
        } else if (it >= MAXIT) {
          S.done = true;
          S.news = head + "After " + MAXIT + " iterations, " + plural(bad, "check ", "checks ") + list(bad) + plural(bad, " still fails", " still fail") + ": the decoder gives up. " + NOTML;
        } else {
          S.news = head + "Decisions " + word(d) + (wrong.length ? ", " + wrong.length + " wrong" : ", all right") + "; " +
            plural(bad, "check ", "checks ") + list(bad) + plural(bad, " is", " are") + " not satisfied, so one more iteration.";
        }
      }
      S.prevD = d;
    }
    function animate(phase, cb) {
      if (REDUCED || !G) { cb(); return; }
      S.busy = true;
      var g = G.g, dots = [], t0 = null, dur = 520, layer = G.dots;
      Object.keys(G.edges).forEach(function (k) {
        var e = ends(g, k), i = +k.split("-")[1], a = e[0], b = e[1];
        if (phase === "c2b") { a = e[1]; b = e[0]; }
        var v = phase === "b2c" ? S.b2c[k] : S.c2b[k];
        dots.push([svg("circle", { r: g.R, cx: a[0], cy: a[1], "class": "mp-dot " + tone(v, i) }, layer), a, b]);
      });
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var u = Math.min(1, (ts - t0) / dur), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        dots.forEach(function (p) { p[0].setAttribute("cx", p[1][0] + (p[2][0] - p[1][0]) * e); p[0].setAttribute("cy", p[1][1] + (p[2][1] - p[1][1]) * e); });
        if (u < 1) requestAnimationFrame(frame);
        else { layer.innerHTML = ""; S.busy = false; cb(); }
      }
      requestAnimationFrame(frame);
    }

    // ---- play ----
    function stopPlay() { S.playing = false; clearTimeout(S.timer); bPlay.textContent = "Play"; }
    function tick() {
      if (!S.playing) return;
      if (S.done) { stopPlay(); return; }
      if (!S.busy) doStep();
      S.timer = setTimeout(tick, 1150);
    }
    bStep.addEventListener("click", function () { stopPlay(); doStep(); });
    bPlay.addEventListener("click", function () {
      if (S.playing) { stopPlay(); return; }
      if (S.done) reset();
      S.playing = true; bPlay.textContent = "Pause"; tick();
    });
    bReset.addEventListener("click", reset);
    snr.addEventListener("input", function () { S.snr = parseFloat(snr.value); snrVal.textContent = S.snr + " dB"; drawNoise(); reset(); });
    redraw.addEventListener("click", function () { drawNoise(); reset(); });
    llr.addEventListener("input", function () {
      if (S.sel.t !== "b" || S.mode !== "noise") return;
      S.L[S.sel.i] = parseFloat(llr.value);
      if (S.ex !== "rand") S.ex = "edit";
      reset();
    });

    // ---- view ----
    function draw() {
      tMode.sync(); tEx.sync(); tRule.sync();
      var noise = S.mode === "noise";
      tEx.hidden = tRule.hidden = !noise;
      becReset.hidden = noise;
      row2.hidden = !(noise && S.ex === "rand");
      llrWrap.hidden = !(noise && S.sel.t === "b");
      if (!llrWrap.hidden) {
        llrName.innerHTML = "channel LLR of <i>x</i><sub>" + (S.sel.i + 1) + "</sub>";
        llr.value = S.L[S.sel.i]; llrVal.textContent = fmt(S.L[S.sel.i]);
      }
      var it = Math.ceil(S.step / 2);
      where.textContent = S.step === 0 ? "ready" : "iteration " + it + (S.step % 2 ? " · bits → checks" : " · checks → bits") + (S.done ? " · stop" : "");
      bStep.disabled = S.done;

      var showB2C = S.step >= 1, showC2B = S.step >= 2, last = S.step % 2 ? "b2c" : "c2b";
      if (G.rowC) {
        G.rowC.setAttribute("class", "mp-row" + (S.step && last !== "b2c" ? " is-dim" : ""));
        G.rowB.setAttribute("class", "mp-row" + (S.step && last !== "c2b" ? " is-dim" : ""));
      }
      Object.keys(G.edges).forEach(function (k) {
        var i = +k.split("-")[1], vb = S.b2c[k], vc = S.c2b[k];
        if (G.cchips[k]) {
          G.cchips[k].v.textContent = showB2C ? fmt(vb) : "–";
          G.cchips[k].setAttribute("class", "mp-chip" + (showB2C ? " " + tone(vb, i) : ""));
          G.bchips[k].v.textContent = showC2B ? fmt(vc) : "–";
          G.bchips[k].setAttribute("class", "mp-chip" + (showC2B ? " " + tone(vc, i) : ""));
        }
        var v = S.step === 0 ? null : last === "b2c" ? vb : vc;
        var w = v === null ? 1.2 : 1.4 + 2.6 * Math.min(Math.abs(v), 4) / 4;
        if (G.g === NARROW) w *= 1.6;
        G.edges[k].setAttribute("class", "mp-edge" + (v === null ? "" : " " + tone(v, i)));
        G.edges[k].setAttribute("stroke-width", w.toFixed(2));
      });
      var t = showC2B ? totals() : S.Lc.slice(), d = decisions(t), st = checkState(d);
      G.bits.forEach(function (n, i) {
        var state = d[i] === null ? " is-erased" : d[i] === SENT[i] ? " is-ok" : " is-bad";
        n.setAttribute("class", "mp-node mp-bit" + state + (S.sel.t === "b" && S.sel.i === i ? " is-sel" : ""));
        n.d.textContent = d[i] === null ? "?" : d[i];
        n.val.textContent = fmt(S.Lc[i]);
        n.tot.textContent = showC2B ? fmt(t[i]) : "";
        n.tot.setAttribute("class", "mp-tot" + (showC2B ? " " + tone(t[i], i) : ""));
        n.setAttribute("aria-label", "bit " + (i + 1) + ": channel LLR " + fmt(S.Lc[i]) + (showC2B ? ", total " + fmt(t[i]) : "") +
          ", decision " + (d[i] === null ? "erased" : d[i] + (d[i] === SENT[i] ? ", right" : ", wrong")) +
          (S.mode === "bec" ? ". Press to erase or restore it." : ". Press to see its messages."));
      });
      G.checks.forEach(function (n, j) {
        n.setAttribute("class", "mp-node mp-check" + (st[j] === false ? " is-bad" : "") + (S.sel.t === "c" && S.sel.i === j ? " is-sel" : ""));
        n.setAttribute("aria-label", "check " + (j + 1) + " on bits " + list(CHK[j].map(function (i) { return i + 1; })) + ": " +
          (st[j] === null ? "has erased bits" : st[j] ? "satisfied" : "not satisfied") + ". Press to see its messages.");
      });
      read.innerHTML = story(d);
      tableBox.innerHTML = S.sel.t === "c" ? checkTable(S.sel.i) : bitTable(S.sel.i, t);
    }
    function story(d) {
      if (S.step === 0) {
        if (S.mode === "bec") {
          var er = S.erased.map(function (e, i) { return e ? i + 1 : 0; }).filter(Boolean);
          return (er.length ? plural(er, "Bit ", "Bits ") + list(er) + plural(er, " is", " are") + " erased (LLR 0); the others are known for sure (LLR ±∞). " :
            "No bit is erased. ") + "Click a bit to erase it or to restore it. Press <b>Step</b>: each bit sends its LLR to its checks.";
        }
        var wrong = d.map(function (b, i) { return b !== SENT[i] ? i + 1 : 0; }).filter(Boolean);
        var hd = d.map(function (b) { return b === null ? 0 : b; }), sd = syndromeDecode(hd);
        var sok = sd.every(function (b, i) { return b === SENT[i]; });
        return "Hard decisions <b>" + word(d) + "</b>: " + (wrong.length ? plural(wrong, "bit ", "bits ") + list(wrong) + plural(wrong, " is", " are") + " wrong" : "no bit is wrong") +
          ". The syndrome decoder of Section 2.5 would output " + word(sd) + (sok ? ", the sent codeword. " : ", a wrong codeword. ") +
          "Press <b>Step</b>: each bit sends its LLR to its checks.";
      }
      var it = Math.ceil(S.step / 2);
      if (S.step % 2) return "<b>Iteration " + it + ", bits → checks.</b> " + (it === 1 ?
        "Each bit sends to each of its checks its channel LLR plus what its <i>other</i> checks said, which is nothing yet. Next, the checks answer." :
        "Each bit sends to each of its checks its channel LLR plus what its <i>other</i> checks said in iteration " + (it - 1) + ", not what this check said itself.");
      var rule = S.mode === "bec" ? "A check with a single erased bit gives it, as the sum of its other bits: LLR ±∞. This is peeling. A check with two or more erased bits sends them 0." :
        S.rule === "min" ? "The sign is the product of their signs, since the bits of a check add up to 0; the magnitude is the smallest of theirs, since a check is only as sure as its least sure bit." :
        "Exact rule: 2 artanh of the product of the tanh(<i>m</i>/2) of the other bits, a little below the smallest magnitude.";
      return "<b>Iteration " + it + ", checks → bits.</b> " + (it === 1 ? "Each check tells each of its bits what its <i>other</i> bits imply. " + rule + " " : "") + S.news;
    }
    function cell(v, i) { return v === null ? "<td>–</td>" : '<td class="' + tone(v, i) + '">' + fmt(v) + "</td>"; }
    function checkTable(j) {
      var c = CHK[j], bec = S.mode === "bec", have = S.step >= 1;
      var h = '<table class="cw-table mp-table"><caption>check ' + (j + 1) + ": " + c.map(function (i) { return "<i>x</i><sub>" + (i + 1) + "</sub>"; }).join(" + ") + " = 0</caption>" +
        "<thead><tr><th>bit</th><th>it sent</th><th>the other bits</th><th>the check answers</th></tr></thead><tbody>";
      c.forEach(function (i) {
        var vals = c.filter(function (k) { return k !== i; }).map(function (k) { return S.b2c[j + "-" + k]; });
        var how = "–";
        if (have && bec) {
          var ne = vals.filter(function (v) { return v === 0; }).length;
          how = ne ? ne + " erased" : "all known";
        } else if (have) {
          how = vals.map(function (v) { return v > 0 ? "+" : v < 0 ? "−" : "0"; }).join(" ") + ", min " + fmt(Math.min.apply(null, vals.map(Math.abs))).replace("+", "");
        }
        h += "<tr><td><i>x</i><sub>" + (i + 1) + "</sub></td>" + cell(have ? S.b2c[j + "-" + i] : null, i) + "<td>" + how + "</td>" + cell(have ? checkToBit(j, i) : null, i) + "</tr>";
      });
      var foot = bec ? "A check with a single erased bit gives it (LLR ±∞); with two or more erased bits it says nothing (LLR 0)." :
        "The answer to a bit uses only what the <i>other</i> bits sent: the product of their signs, and " +
        (S.rule === "min" ? "the smallest of their magnitudes." : "a magnitude a little below the smallest of theirs (exact rule).");
      if (have && S.step % 2 === 1) foot += " The check sends these answers at the next step.";
      return h + '</tbody><tfoot><tr><td colspan="4">' + foot + "</td></tr></tfoot></table>";
    }
    function bitTable(i, t) {
      var cs = BCH[i], have = S.step >= 2;
      var h = '<table class="cw-table mp-table"><caption>bit <i>x</i><sub>' + (i + 1) + "</sub>, in " + plural(cs, "check ", "checks ") +
        list(cs.map(function (j) { return j + 1; })) + "</caption><thead><tr><th></th><th>LLR</th></tr></thead><tbody>";
      h += "<tr><td>from the channel</td>" + cell(S.Lc[i], i) + "</tr>";
      cs.forEach(function (j) { h += "<tr><td>check " + (j + 1) + " says</td>" + cell(have ? S.c2b[j + "-" + i] : null, i) + "</tr>"; });
      var tot = have ? t[i] : S.Lc[i];
      h += '<tr class="mp-sum"><td>total, decision ' + (tot > 0 ? "0" : tot < 0 ? "1" : "?") + "</td>" + cell(tot, i) + "</tr>";
      cs.forEach(function (j) { h += "<tr><td>sends to check " + (j + 1) + "</td>" + cell(bitToCheck(j, i), i) + "</tr>"; });
      return h + '</tbody><tfoot><tr><td colspan="2">To each check, the bit sends its total minus what that check said: a check never hears its own message back.</td></tr></tfoot></table>';
    }

    function setNarrow() {
      var n = box.clientWidth < 560;
      if (G && n === S.narrow) return;
      S.narrow = n; box.classList.toggle("is-narrow", n); buildSvg();
      if (S.Lc) draw();
    }
    setNarrow();
    if (window.ResizeObserver) new ResizeObserver(setNarrow).observe(box); else window.addEventListener("resize", setNarrow);
    reset();
  }

  function init() { document.querySelectorAll('[data-widget="' + NAME + '"]').forEach(build); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
