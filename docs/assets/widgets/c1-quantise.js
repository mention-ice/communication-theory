/* Lecture 1, Problem 7 of the page: three levels on the Gaussian channel (Sections 1.3 and 1.4 of the notes).
   It sits in the exercises, not in the text, because three levels never give a BEC (Sheng, 16 Nov 2026).
   The bit is sent as the level (-1)^x sqrt(Es) in Gaussian noise of variance N0/2, so L = 4 sqrt(Es) y / N0
   is Gaussian with mean +-4 Es/N0 and variance 8 Es/N0. The receiver passes on L (general channel), its sign
   (two levels: a BSC(delta)), or its sign and an erasure when |L| <= T (three levels: erased with probability
   eps, kept but wrong with probability rho, and rho > 0 for every T). The bars compare the Bhattacharyya
   parameter beta of what the decoder sees (the smaller, the better).
   Draws into every [data-widget="c1-quantise"]. Optional arguments: snr=0 (Es/N0 in dB), T=2, mode=two.
   No libraries. */
(function () {
  "use strict";
  var NAME = "c1-quantise", SVGNS = "http://www.w3.org/2000/svg";

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function svg(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function text(parent, x, y, s, cls, anchor) { var t = svg("text", { x: x, y: y, "class": cls || "tick", "text-anchor": anchor || "middle" }, parent); t.textContent = s; return t; }
  function erfc(x) {
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function Phi(x) { return 0.5 * erfc(-x / Math.SQRT2); }
  function fmtP(p) {
    if (p === 0) return "0";
    if (p >= 0.01) return p.toFixed(3);
    var e = Math.floor(Math.log10(p)), m = p / Math.pow(10, e);
    return m.toFixed(1) + "·10" + String(e).replace(/-/g, "⁻").replace(/\d/g, function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]; });
  }
  function fmtL(v) { return (v < 0 ? "−" : "") + Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0); }

  function build(root) {
    var a = {};
    (root.getAttribute("data-args") || "").split(/\s+/).forEach(function (kv) { var m = kv.match(/^(\w+)=(.*)$/); if (m) a[m[1]] = m[2]; });
    var snr = isFinite(parseFloat(a.snr)) ? parseFloat(a.snr) : 0;
    var T = isFinite(parseFloat(a.T)) ? parseFloat(a.T) : 2;
    var mode = a.mode || "two";
    root.innerHTML = "";
    var box = el("div", "cw");
    box.appendChild(el("p", "cw-title", "Try it: what the receiver keeps"));
    var ctl = el("div", "cw-controls");
    var tg = el("span", "cw-toggle"), modes = [["soft", "keep L"], ["two", "two levels"], ["three", "three levels"]], mb = {};
    modes.forEach(function (m) { var b = el("button", null, m[1]); b.type = "button"; b.addEventListener("click", function () { mode = m[0]; draw(); }); tg.appendChild(b); mb[m[0]] = b; });
    var l1 = el("label", "cw-ctl"); l1.appendChild(el("span", null, "E<sub>s</sub>/N<sub>0</sub> ="));
    var r1 = el("input"); r1.type = "range"; r1.min = -4; r1.max = 8; r1.step = 0.5; r1.value = snr; r1.setAttribute("aria-label", "Es/N0 in dB");
    var v1 = el("span", "cw-ctl-val"); l1.appendChild(r1); l1.appendChild(v1);
    var l2 = el("label", "cw-ctl"); l2.appendChild(document.createTextNode("T ="));
    var r2 = el("input"); r2.type = "range"; r2.min = 0; r2.step = 0.1; r2.setAttribute("aria-label", "erasure threshold T");
    var v2 = el("span", "cw-ctl-val"); l2.appendChild(r2); l2.appendChild(v2);
    ctl.appendChild(tg); ctl.appendChild(l1); ctl.appendChild(l2);
    box.appendChild(ctl);

    var fig = el("div", "cw-figure");
    var W = 600, H = 330, x0 = 20, x1 = 580, y0 = 186, y1 = 30;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "densities of the LLR given each bit, and the decision zones" });
    fig.appendChild(s); box.appendChild(fig);
    var gShade = svg("g", {}, s), gCurves = svg("g", {}, s), gAxis = svg("g", {}, s), gZones = svg("g", {}, s), gBeta = svg("g", {}, s);
    var read = el("p", "cw-readout"); box.appendChild(read);
    box.appendChild(el("p", "cw-note", "The bit is sent as the level ±√E<sub>s</sub> in Gaussian noise (the example of Section 1.2), so the LLR is Gaussian given each bit. " +
      "The bars at the bottom compare the Bhattacharyya parameter β of what the decoder is given (Section 1.4): the smaller β, the better."));
    root.appendChild(box);

    function draw() {
      var g = Math.pow(10, snr / 10), mu = 4 * g, sd = Math.sqrt(8 * g);
      var R = mu + 3.6 * sd, Tmax = Math.max(1, Math.round((mu + 1.5 * sd) * 10) / 10);
      r2.max = Tmax; if (T > Tmax) T = Tmax; r2.value = T;
      v1.textContent = (snr > 0 ? "+" : "") + snr.toFixed(1) + " dB"; v2.textContent = T.toFixed(1);
      l2.style.display = mode === "three" ? "" : "none";
      for (var k in mb) mb[k].setAttribute("aria-pressed", k === mode ? "true" : "false");
      function X(l) { return x0 + (l + R) / (2 * R) * (x1 - x0); }
      var pk = 1 / (sd * Math.sqrt(2 * Math.PI));
      function Y(p) { return y0 - p / pk * (y0 - y1); }
      function dens(l, m) { return pk * Math.exp(-(l - m) * (l - m) / (2 * sd * sd)); }
      function path(m, a, b) { var d = "", N = 200; for (var i = 0; i <= N; i++) { var l = a + (b - a) * i / N; d += (i ? "L" : "M") + X(l).toFixed(1) + " " + Y(dens(l, m)).toFixed(1); } return d; }
      function area(m, a, b, cls) {
        a = Math.max(a, -R); b = Math.min(b, R); if (b <= a) return;
        svg("path", { d: path(m, a, b) + "L" + X(b).toFixed(1) + " " + y0 + "L" + X(a).toFixed(1) + " " + y0 + "Z", "class": cls }, gShade);
      }
      gShade.innerHTML = gCurves.innerHTML = gAxis.innerHTML = gZones.innerHTML = gBeta.innerHTML = "";
      // shading: what goes wrong when 0 is sent
      var delta = Phi(-mu / sd), eps = Phi((T - mu) / sd) - Phi((-T - mu) / sd), rho = Phi((-T - mu) / sd);
      if (mode === "two") area(mu, -R, 0, "f-bad");
      if (mode === "three") { area(mu, -T, T, "f-erase"); area(mu, -R, -T, "f-bad"); }
      svg("path", { d: path(-mu, -R, R), "class": "c-ink" }, gCurves);
      svg("path", { d: path(mu, -R, R), "class": "c-sig" }, gCurves);
      text(gCurves, X(mu), Y(pk) - 8, "L given x = 0", "lbl");
      text(gCurves, X(-mu), Y(pk) - 8, "L given x = 1", "lbl");
      // axis with ticks
      svg("line", { x1: x0, x2: x1, y1: y0, y2: y0, "class": "ax" }, gAxis);
      var step = R > 60 ? 20 : R > 30 ? 10 : R > 12 ? 5 : 2;
      for (var t = -Math.floor(R / step) * step; t <= R; t += step) {
        svg("line", { x1: X(t), x2: X(t), y1: y0, y2: y0 + 4, "class": "ax" }, gAxis);
        text(gAxis, X(t), y0 + 16, t === 0 ? "0" : fmtL(t));
      }
      text(gAxis, x1, y0 + 16, "L", "lbl-i", "end");
      // decision zones under the axis
      var zy = y0 + 40;
      function zone(a, b, label, cls) {
        a = Math.max(a, -R); b = Math.min(b, R);
        svg("rect", { x: X(a) + 1, y: zy - 10, width: Math.max(0, X(b) - X(a) - 2), height: 16, rx: 3, "class": cls }, gZones);
        if (X(b) - X(a) > 60) text(gZones, (X(a) + X(b)) / 2, zy + 2, label, "tick");
      }
      if (mode === "soft") zone(-R, R, "the value of L is passed on", "f-sig-soft");
      if (mode === "two") { zone(-R, 0, "decide 1", "f-sig-soft"); zone(0, R, "decide 0", "f-sig-soft"); }
      if (mode === "three") {
        zone(-R, -T, "decide 1", "f-sig-soft"); zone(-T, T, "erase", "f-erase"); zone(T, R, "decide 0", "f-sig-soft");
        [-T, T].forEach(function (v) { svg("line", { x1: X(v), x2: X(v), y1: y1, y2: y0, "class": "c-dash", "stroke-width": 1 }, gZones); });
      }
      // beta bars
      var bS = Math.exp(-g), b2 = 2 * Math.sqrt(delta * (1 - delta)), b3 = eps + 2 * Math.sqrt(Math.max(rho * (1 - eps - rho), 0));
      var rows = [["keep L", bS, "soft"], ["two levels", b2, "two"], ["three levels", b3, "three"]];
      var by = 284, bx = 130, bw = 380;
      text(gBeta, x0, by - 14, "β of what the decoder sees", "lbl", "start");
      rows.forEach(function (r, i) {
        var yy = by + i * 17;
        text(gBeta, bx - 8, yy + 4, r[0], "tick", "end");
        svg("rect", { x: bx, y: yy - 6, width: bw, height: 11, rx: 2, "class": "f-sig-soft" }, gBeta);
        svg("rect", { x: bx, y: yy - 6, width: Math.max(1, bw * Math.min(r[1], 1)), height: 11, rx: 2, "class": r[2] === mode ? "f-sig" : "f-erase" }, gBeta);
        text(gBeta, bx + bw + 8, yy + 4, r[1].toFixed(3), "tick", "start");
      });
      var r;
      if (mode === "soft") r = "The receiver passes on <b>L</b> itself: each bit comes with its own confidence. Nothing is lost, and β = <i>e</i><sup>−E<sub>s</sub>/N<sub>0</sub></sup> = " + bS.toFixed(3) + ".";
      else if (mode === "two") r = "The receiver keeps the sign of <i>L</i>. When 0 is sent, the decision is wrong with probability <b>δ = " + fmtP(delta) + "</b> (red area), and the same holds for 1: the decoder sees a <b>BSC(δ)</b>.";
      else r = "When 0 is sent, the bit is <b>erased</b> with probability ε = " + fmtP(eps) + " (grey area), and it is <b>kept but wrong</b> with probability ρ = " + fmtP(rho) +
        " (red area); the same holds when 1 is sent. A kept bit can still be wrong." +
        (b3 < b2 ? " With this threshold, three levels beat two." : " With this threshold, three levels do worse than two: try another T.");
      read.innerHTML = r;
    }
    r1.addEventListener("input", function () { snr = parseFloat(r1.value); draw(); });
    r2.addEventListener("input", function () { T = parseFloat(r2.value); draw(); });
    draw();
  }

  function init() { document.querySelectorAll('[data-widget="' + NAME + '"]').forEach(build); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
