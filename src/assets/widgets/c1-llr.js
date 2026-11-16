/* Lecture 1, Section 1.2: what one LLR says. The curve is P(X = 0 | Y = y) = 1 / (1 + e^{-L}) for a uniform
   bit; the bars are the two likelihoods p(y|0) and p(y|1), scaled so that the larger one is 1: the
   smaller one is e^{-|L|}. Drag the point, use the slider, or pick L = +inf or -inf.
   Draws into every [data-widget="c1-llr"]. Optional argument: L=2. No libraries. */
(function () {
  "use strict";
  var NAME = "c1-llr", SVGNS = "http://www.w3.org/2000/svg";
  var LMAX = 8;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, cls, anchor) {
    var t = svg("text", { x: x, y: y, "class": cls || "tick", "text-anchor": anchor || "middle" }, parent);
    t.textContent = s;
    return t;
  }
  function post(L) { return L === Infinity ? 1 : L === -Infinity ? 0 : 1 / (1 + Math.exp(-L)); }
  function fmt(L) { return L === Infinity ? "+∞" : L === -Infinity ? "−∞" : (L < 0 ? "−" : L > 0 ? "+" : "") + Math.abs(L).toFixed(1); }

  function build(root) {
    var a = {};
    (root.getAttribute("data-args") || "").split(/\s+/).forEach(function (kv) { var m = kv.match(/^(\w+)=(.*)$/); if (m) a[m[1]] = m[2]; });
    var L = isFinite(parseFloat(a.L)) ? parseFloat(a.L) : 2;
    root.innerHTML = "";
    var box = el("div", "cw");
    box.appendChild(el("p", "cw-title", "Try it: one observation, one number"));
    var ctl = el("div", "cw-controls");
    var lab = el("label", "cw-ctl"); lab.appendChild(document.createTextNode("L ="));
    var rng = el("input"); rng.type = "range"; rng.min = -LMAX; rng.max = LMAX; rng.step = 0.1; rng.value = L;
    rng.setAttribute("aria-label", "log-likelihood ratio L");
    var val = el("span", "cw-ctl-val"); lab.appendChild(rng); lab.appendChild(val);
    var tg = el("span", "cw-toggle");
    var bm = el("button", null, "L = −∞"), bp = el("button", null, "L = +∞");
    bm.type = bp.type = "button"; tg.appendChild(bm); tg.appendChild(bp);
    ctl.appendChild(lab); ctl.appendChild(tg);
    box.appendChild(ctl);

    var fig = el("div", "cw-figure");
    var W = 600, H = 256, x0 = 46, x1 = 392, y0 = 210, y1 = 20;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "posterior probability of 0 as a function of the LLR, and the two likelihoods" });
    fig.appendChild(s); box.appendChild(fig);
    function X(l) { return x0 + (l + LMAX) / (2 * LMAX) * (x1 - x0); }
    function Y(p) { return y0 - p * (y0 - y1); }
    // grid and axes
    [0, 0.5, 1].forEach(function (p) { svg("line", { x1: x0, x2: x1, y1: Y(p), y2: Y(p), "class": "grid" }, s); text(s, x0 - 6, Y(p) + 4, p === 0.5 ? "1/2" : String(p), "tick", "end"); });
    [-8, -4, 0, 4, 8].forEach(function (l) { svg("line", { x1: X(l), x2: X(l), y1: y0, y2: y0 + 4, "class": "ax" }, s); text(s, X(l), y0 + 17, l > 0 ? "+" + l : l < 0 ? "−" + (-l) : "0"); });
    svg("line", { x1: x0, x2: x1, y1: y0, y2: y0, "class": "ax" }, s);
    svg("line", { x1: X(0), x2: X(0), y1: y0, y2: y1, "class": "grid" }, s);
    text(s, X(0) + 6, y0 + 34, "L", "lbl-i", "start");
    text(s, x0 + 4, y1 - 6, "P(X = 0 | Y = y)", "lbl", "start");
    text(s, x0, y0 + 34, "← hard decision ŷ = 1", "tick", "start");
    text(s, x1, y0 + 34, "ŷ = 0 →", "tick", "end");
    var d = "";
    for (var k = 0; k <= 160; k++) { var l = -LMAX + k * 2 * LMAX / 160; d += (k ? "L" : "M") + X(l).toFixed(1) + " " + Y(post(l)).toFixed(1); }
    svg("path", { d: d, "class": "c-sig" }, s);
    var guideV = svg("line", { "class": "c-dash", "stroke-width": 1 }, s), guideH = svg("line", { "class": "c-dash", "stroke-width": 1 }, s);
    var inf = text(s, 0, 0, "", "lbl", "middle");
    var handle = svg("circle", { r: 8, "class": "handle", tabindex: 0, role: "slider", "aria-label": "drag to change L" }, s);
    // likelihood bars
    var bx = 450, bw = 44, bgap = 30, bb = y0, bt = y1 + 16;
    text(s, bx + bw + bgap / 2, y1 - 6, "likelihoods", "lbl", "middle");
    var bar0 = svg("rect", { x: bx, width: bw, "class": "f-sig" }, s), bar1 = svg("rect", { x: bx + bw + bgap, width: bw, "class": "f-noise" }, s);
    svg("line", { x1: bx - 8, x2: bx + 2 * bw + bgap + 8, y1: bb, y2: bb, "class": "ax" }, s);
    text(s, bx + bw / 2, bb + 17, "p(y|0)", "lbl"); text(s, bx + bw + bgap + bw / 2, bb + 17, "p(y|1)", "lbl");
    var v0 = text(s, bx + bw / 2, 0, "", "tick"), v1 = text(s, bx + bw + bgap + bw / 2, 0, "", "tick");

    var read = el("p", "cw-readout"); box.appendChild(read);
    box.appendChild(el("p", "cw-note", "The bars are scaled so that the larger likelihood is 1; the factor that is dropped is the same for both bits, so the decoder does not need it."));
    root.appendChild(box);

    function draw() {
      var Lc = Math.max(-LMAX, Math.min(LMAX, L)), p = post(L);
      var hx = isFinite(L) ? X(Lc) : (L > 0 ? x1 : x0);
      handle.setAttribute("cx", hx); handle.setAttribute("cy", Y(p));
      guideV.setAttribute("x1", hx); guideV.setAttribute("x2", hx); guideV.setAttribute("y1", y0); guideV.setAttribute("y2", Y(p));
      guideH.setAttribute("x1", x0); guideH.setAttribute("x2", hx); guideH.setAttribute("y1", Y(p)); guideH.setAttribute("y2", Y(p));
      inf.textContent = isFinite(L) ? "" : (L > 0 ? "+∞ →" : "← −∞");
      inf.setAttribute("x", L > 0 ? x1 - 22 : x0 + 22); inf.setAttribute("y", Y(p) + (L > 0 ? 22 : -12));
      var l0 = L >= 0 ? 1 : Math.exp(L), l1 = L <= 0 ? 1 : Math.exp(-L);
      [[bar0, l0, v0], [bar1, l1, v1]].forEach(function (b) {
        var h = b[1] * (bb - bt);
        b[0].setAttribute("y", bb - h); b[0].setAttribute("height", Math.max(h, 0));
        b[2].setAttribute("y", bb - h - 5); b[2].textContent = b[1] >= 0.995 ? "1" : b[1] < 0.0005 ? (b[1] === 0 ? "0" : "≈0") : b[1].toFixed(3);
      });
      val.textContent = fmt(L);
      bm.setAttribute("aria-pressed", L === -Infinity ? "true" : "false");
      bp.setAttribute("aria-pressed", L === Infinity ? "true" : "false");
      if (isFinite(L)) rng.value = L;
      handle.setAttribute("aria-valuenow", isFinite(L) ? L.toFixed(1) : (L > 0 ? "infinity" : "minus infinity"));
      var yh = L > 0 ? "0" : "1", r;
      if (L === 0) r = "<b>L = 0</b>: both bits are equally likely, <i>P</i>(X = 0 | Y = <i>y</i>) = 1/2, and the hard decision can be either bit. Contradicting it costs nothing.";
      else if (!isFinite(L)) r = "<b>L = " + fmt(L) + "</b>: the hard decision is <b>ŷ = " + yh + "</b> for sure; the other bit is impossible (its likelihood is 0), and contradicting ŷ costs ∞.";
      else r = "<b>L = " + fmt(L) + "</b>: the hard decision is <b>ŷ = " + yh + "</b>, and <i>P</i>(X = 0 | Y = <i>y</i>) = " + p.toFixed(p > 0.995 || p < 0.005 ? 4 : 2) +
        " for a uniform bit. The other bit is <i>e</i><sup>−|L|</sup> = " + Math.exp(-Math.abs(L)).toFixed(3) + " times as likely: contradicting ŷ costs |<i>L</i>| = " + Math.abs(L).toFixed(1) + ".";
      read.innerHTML = r;
    }
    rng.addEventListener("input", function () { L = parseFloat(rng.value); draw(); });
    bm.addEventListener("click", function () { L = -Infinity; draw(); });
    bp.addEventListener("click", function () { L = Infinity; draw(); });
    function fromEvent(ev) {
      var r = s.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W;
      var l = (x - x0) / (x1 - x0) * 2 * LMAX - LMAX;
      L = Math.round(Math.max(-LMAX, Math.min(LMAX, l)) * 10) / 10; draw();
    }
    var dragging = false;
    handle.addEventListener("pointerdown", function (ev) { dragging = true; handle.setPointerCapture(ev.pointerId); ev.preventDefault(); });
    handle.addEventListener("pointermove", function (ev) { if (dragging) fromEvent(ev); });
    handle.addEventListener("pointerup", function () { dragging = false; });
    s.addEventListener("click", function (ev) { if (ev.target !== handle) fromEvent(ev); });
    handle.addEventListener("keydown", function (ev) {
      var st = ev.shiftKey ? 1 : 0.1;
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { L = Math.min(LMAX, (isFinite(L) ? L : 0) + st); draw(); ev.preventDefault(); }
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { L = Math.max(-LMAX, (isFinite(L) ? L : 0) - st); draw(); ev.preventDefault(); }
    });
    draw();
  }

  function init() { document.querySelectorAll('[data-widget="' + NAME + '"]').forEach(build); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
