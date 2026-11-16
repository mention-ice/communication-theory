/* Lecture 1, Section 1.4: the error probability of ML decoding against the bound (1.8), for the code of
   Example 1.5 (M = 4, d = 3: two neighbours at distance 3, one at distance 4), on three channels with
   the same Bhattacharyya parameter beta: BEC(eps = beta), BSC(delta) with 2 sqrt(delta(1-delta)) = beta,
   and the Gaussian example (beta = e^{-Es/N0}). Log scales: a power beta^d is a line of slope d.
   P_e is exact on the BEC and the BSC (all 32 patterns, ties broken at random); on the Gaussian channel it
   was computed offline by importance sampling (relative accuracy about 0.5 %).
   Draws into every [data-widget="c1-bound"]. Optional argument: beta=0.3. No libraries. */
(function () {
  "use strict";
  var NAME = "c1-bound", SVGNS = "http://www.w3.org/2000/svg";
  var CODE = ["00000", "01011", "10101", "11110"];
  var BMIN = 0.03, PMIN = 1e-7;
  // P_e of the code on the Gaussian channel, as a function of beta = e^{-Es/N0}
  var GAUSS = [[0.03, 4.578e-06], [0.03316, 6.33e-06], [0.03666, 8.564e-06], [0.04052, 1.167e-05], [0.04479, 1.606e-05], [0.04951, 2.213e-05],
    [0.05473, 3.052e-05], [0.06049, 4.141e-05], [0.06687, 5.708e-05], [0.07391, 7.906e-05], [0.0817, 0.0001091], [0.09031, 0.0001497],
    [0.09983, 0.0002078], [0.11035, 0.0002864], [0.12198, 0.0003949], [0.13483, 0.0005443], [0.14904, 0.0007618], [0.16474, 0.001046],
    [0.1821, 0.001465], [0.20129, 0.002023], [0.2225, 0.00282], [0.24595, 0.003937], [0.27187, 0.005541], [0.30052, 0.007716],
    [0.33219, 0.01093], [0.36719, 0.0153], [0.40588, 0.02149], [0.44866, 0.03047], [0.49593, 0.04305], [0.5482, 0.06101],
    [0.60596, 0.08706], [0.66982, 0.1252], [0.7404, 0.1812], [0.81842, 0.267], [0.90467, 0.402], [1.0, 0.75]];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function svg(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function text(parent, x, y, s, cls, anchor) { var t = svg("text", { x: x, y: y, "class": cls || "tick", "text-anchor": anchor || "middle" }, parent); t.textContent = s; return t; }
  function sup(e) { return String(e).replace(/-/g, "⁻").replace(/\d/g, function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]; }); }
  function fmtP(p) {
    if (p >= 0.01) return p.toFixed(3);
    var e = Math.floor(Math.log10(p)), m = p / Math.pow(10, e);
    if (m >= 9.95) { m = 1; e++; }
    return m.toFixed(1) + "·10" + sup(e);
  }

  // per pattern of 5 positions (bit mask): the probability that ML is wrong when 00000 is sent
  var BEC_PAT = [], BSC_PAT = [];
  (function () {
    var cw = CODE.map(function (c) { return parseInt(c, 2); });
    for (var m = 0; m < 32; m++) {
      // BEC: positions in m are erased; codewords whose ones are all erased stay possible
      var cons = cw.filter(function (c) { return (c & ~m) === 0; }).length;
      BEC_PAT.push(1 - 1 / cons);
      // BSC: positions in m are flipped; ML = nearest codeword to m
      var best = 9, arg = [];
      cw.forEach(function (c, k) {
        var x = c ^ m, d = 0; while (x) { d += x & 1; x >>= 1; }
        if (d < best) { best = d; arg = [k]; } else if (d === best) arg.push(k);
      });
      BSC_PAT.push(arg.indexOf(0) >= 0 ? 1 - 1 / arg.length : 1);
    }
  })();
  function wt(m) { var d = 0; while (m) { d += m & 1; m >>= 1; } return d; }
  function exact(pat, p) { var s = 0; for (var m = 0; m < 32; m++) { var w = wt(m); s += pat[m] * Math.pow(p, w) * Math.pow(1 - p, 5 - w); } return s; }
  function deltaOf(b) { return (1 - Math.sqrt(1 - b * b)) / 2; }
  function gauss(b) {
    if (b <= GAUSS[0][0]) return GAUSS[0][1];
    for (var i = 1; i < GAUSS.length; i++) if (b <= GAUSS[i][0]) {
      var a0 = Math.log(GAUSS[i - 1][0]), a1 = Math.log(GAUSS[i][0]), t = (Math.log(b) - a0) / (a1 - a0);
      return Math.exp(Math.log(GAUSS[i - 1][1]) * (1 - t) + Math.log(GAUSS[i][1]) * t);
    }
    return 0.75;
  }
  function bound(b) { return Math.min(1, 2 * b * b * b + b * b * b * b); }
  var CH = [
    { key: "bec", name: "BEC(ε)", cls: "c-ok", dot: "f-ok", pe: function (b) { return exact(BEC_PAT, b); }, par: function (b) { return "ε = " + b.toFixed(3); } },
    { key: "gen", name: "Gaussian", cls: "c-sig", dot: "f-sig", pe: gauss, par: function (b) { var g = -Math.log(b); return "E<sub>s</sub>/N<sub>0</sub> = " + (10 * Math.log10(g)).toFixed(1) + " dB"; } },
    { key: "bsc", name: "BSC(δ)", cls: "c-noise", dot: "f-noise", pe: function (b) { return exact(BSC_PAT, deltaOf(b)); }, par: function (b) { return "δ = " + fmtP(deltaOf(b)); } }
  ];

  function build(root) {
    var a = {};
    (root.getAttribute("data-args") || "").split(/\s+/).forEach(function (kv) { var m = kv.match(/^(\w+)=(.*)$/); if (m) a[m[1]] = m[2]; });
    var beta = Math.min(1, Math.max(BMIN, parseFloat(a.beta) || 0.3));
    var show = { bec: true, gen: true, bsc: true };
    root.innerHTML = "";
    var box = el("div", "cw");
    box.appendChild(el("p", "cw-title", "Try it: the bound against the exact error probability"));
    var ctl = el("div", "cw-controls");
    var lb = el("label", "cw-ctl"); lb.appendChild(el("span", null, "β ="));
    var rb = el("input"); rb.type = "range"; rb.min = Math.log10(BMIN); rb.max = 0; rb.step = 0.01; rb.value = Math.log10(beta); rb.setAttribute("aria-label", "Bhattacharyya parameter beta, log scale");
    var vb = el("span", "cw-ctl-val"); lb.appendChild(rb); lb.appendChild(vb);
    var tg = el("span", "cw-toggle"), tb = {};
    CH.forEach(function (c) { var b = el("button", null, c.name); b.type = "button"; b.addEventListener("click", function () { show[c.key] = !show[c.key]; draw(); }); tg.appendChild(b); tb[c.key] = b; });
    ctl.appendChild(lb); ctl.appendChild(tg); box.appendChild(ctl);

    var fig = el("div", "cw-figure");
    var W = 600, H = 330, x0 = 58, x1 = 580, y0 = 290, y1 = 14;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "error probability against beta, log scales" });
    fig.appendChild(s); box.appendChild(fig);
    var lx0 = Math.log10(BMIN), ly0 = Math.log10(PMIN);
    function X(b) { return x0 + (Math.log10(b) - lx0) / (0 - lx0) * (x1 - x0); }
    function Y(p) { return y0 - (Math.log10(Math.max(p, PMIN)) - ly0) / (0 - ly0) * (y0 - y1); }
    for (var e = -7; e <= 0; e++) { svg("line", { x1: x0, x2: x1, y1: Y(Math.pow(10, e)), y2: Y(Math.pow(10, e)), "class": "grid" }, s); text(s, x0 - 6, Y(Math.pow(10, e)) + 4, e === 0 ? "1" : "10" + sup(e), "tick", "end"); }
    [0.03, 0.1, 0.3, 1].forEach(function (b) { svg("line", { x1: X(b), x2: X(b), y1: y0, y2: y1, "class": "grid" }, s); text(s, X(b), y0 + 16, String(b)); });
    svg("line", { x1: x0, x2: x1, y1: y0, y2: y0, "class": "ax" }, s); svg("line", { x1: x0, x2: x0, y1: y0, y2: y1, "class": "ax" }, s);
    text(s, x1, y0 + 34, "β", "lbl-i", "end"); text(s, x0 + 6, y1 + 12, "Pₑ", "lbl-i", "start");
    function curve(f, cls) {
      var d = "", N = 160;
      for (var i = 0; i <= N; i++) { var b = Math.pow(10, lx0 + (0 - lx0) * i / N); d += (i ? "L" : "M") + X(b).toFixed(1) + " " + Y(f(b)).toFixed(1); }
      return svg("path", { d: d, "class": cls }, s);
    }
    curve(bound, "c-dash");
    text(s, X(0.035), Y(bound(0.1)) - 2, "bound 2β³ + β⁴", "lbl", "start");
    var paths = {}, dots = {};
    var names = {};
    CH.forEach(function (c) {
      paths[c.key] = curve(c.pe, c.cls);
      names[c.key] = text(s, X(0.031), Y(c.pe(0.031)) - 7, c.key === "gen" ? "Gaussian" : c.key.toUpperCase(), "lbl t-" + c.dot.slice(2), "start");
    });
    var cur = svg("line", { y1: y0, y2: y1, "class": "c-dash", "stroke-width": 1 }, s);
    var dB = svg("circle", { r: 4.5, "class": "f-ink" }, s);
    CH.forEach(function (c) { dots[c.key] = svg("circle", { r: 5, "class": c.dot }, s); });
    var tw = el("div", "cw-table-wrap"), table = el("table", "cw-table"); tw.appendChild(table); box.appendChild(tw);
    box.appendChild(el("p", "cw-note", "The three channels are put side by side at the same β. On log scales a power β<sup><i>d</i></sup> is a straight line of slope <i>d</i>: " +
      "the bound has slope 3 for small β, and so has <i>P</i><sub>e</sub> on the BEC and on the Gaussian channel. On the BSC two flips are needed to fool the decoder, and its <i>P</i><sub>e</sub> falls faster. " +
      "On the BEC and the BSC, <i>P</i><sub>e</sub> is computed exactly; on the Gaussian channel it was estimated by simulation."));
    root.appendChild(box);

    function draw() {
      vb.textContent = beta < 0.1 ? beta.toFixed(3) : beta.toFixed(2);
      cur.setAttribute("x1", X(beta)); cur.setAttribute("x2", X(beta));
      dB.setAttribute("cx", X(beta)); dB.setAttribute("cy", Y(bound(beta)));
      var h = "<thead><tr><th>channel</th><th>parameter</th><th>exact Pₑ</th><th>bound</th><th>bound / Pₑ</th></tr></thead><tbody>";
      CH.forEach(function (c) {
        paths[c.key].style.display = dots[c.key].style.display = names[c.key].style.display = show[c.key] ? "" : "none";
        tb[c.key].setAttribute("aria-pressed", show[c.key] ? "true" : "false");
        var p = c.pe(beta);
        dots[c.key].setAttribute("cx", X(beta)); dots[c.key].setAttribute("cy", Y(p));
        if (show[c.key]) h += '<tr><td><span class="cw-sw s-' + c.dot.slice(2) + '"></span>' + c.name + "</td><td>" + c.par(beta) + "</td><td>" + fmtP(p) + "</td><td>" + fmtP(bound(beta)) + "</td><td>" + (bound(beta) / p).toFixed(1) + "</td></tr>";
      });
      table.innerHTML = h + "</tbody>";
    }
    rb.addEventListener("input", function () { beta = Math.pow(10, parseFloat(rb.value)); draw(); });
    function fromEvent(ev) {
      var r = s.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W;
      var lb = lx0 + (x - x0) / (x1 - x0) * (0 - lx0);
      beta = Math.pow(10, Math.max(lx0, Math.min(0, lb))); rb.value = Math.log10(beta); draw();
    }
    var drag = false;
    s.addEventListener("pointerdown", function (ev) { drag = true; s.setPointerCapture(ev.pointerId); fromEvent(ev); });
    s.addEventListener("pointermove", function (ev) { if (drag) fromEvent(ev); });
    s.addEventListener("pointerup", function () { drag = false; });
    s.addEventListener("pointercancel", function () { drag = false; });
    draw();
  }

  function init() { document.querySelectorAll('[data-widget="' + NAME + '"]').forEach(build); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
