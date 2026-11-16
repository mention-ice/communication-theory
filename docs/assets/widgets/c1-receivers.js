/* Lecture 1, Example 1.5: one reception, three receivers. The code is C = {00000, 01011, 10101, 11110}.
   Drag the five LLRs (or draw a random reception in Gaussian noise); the table gives, for each codeword,
   the cost of the soft decoder (sum of |L_i| over the positions where x_i differs from the hard decision),
   the Hamming distance to the hard decisions, and whether it is consistent with the bits kept by the
   receiver that erases |L_i| <= T. The winner of each decoder is marked.
   Draws into every [data-widget="c1-receivers"]. No libraries. */
(function () {
  "use strict";
  var NAME = "c1-receivers", SVGNS = "http://www.w3.org/2000/svg";
  var CODE = ["00000", "01011", "10101", "11110"], LMAX = 8, EX = [4, -1, 3, -1, 6];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function svg(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function text(parent, x, y, s, cls, anchor) { var t = svg("text", { x: x, y: y, "class": cls || "tick", "text-anchor": anchor || "middle" }, parent); t.textContent = s; return t; }
  function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function f1(v) { var r = Math.round(v * 10) / 10; return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(Number.isInteger(r) ? 0 : 1); }
  function fc(v) { var r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); }

  function build(root) {
    var L = EX.slice(), sent = 0, T = 1, snr = 0;
    root.innerHTML = "";
    var box = el("div", "cw");
    box.appendChild(el("p", "cw-title", "Try it: one reception, three receivers"));
    var ctl = el("div", "cw-controls");
    var sl = el("span", "cw-ctl", "sent");
    var tg = el("span", "cw-toggle"), sb = [];
    CODE.forEach(function (c, i) { var b = el("button", null, c); b.type = "button"; b.addEventListener("click", function () { sent = i; draw(); }); tg.appendChild(b); sb.push(b); });
    sl.appendChild(tg);
    var lt = el("label", "cw-ctl"); lt.appendChild(document.createTextNode("erase if |L| ≤"));
    var rt = el("input"); rt.type = "range"; rt.min = 0; rt.max = 4; rt.step = 0.5; rt.value = T; rt.setAttribute("aria-label", "erasure threshold T");
    var vt = el("span", "cw-ctl-val"); lt.appendChild(rt); lt.appendChild(vt);
    ctl.appendChild(sl); ctl.appendChild(lt);
    box.appendChild(ctl);
    var ctl2 = el("div", "cw-controls");
    var bEx = el("button", "cw-btn", "Example 1.5"); bEx.type = "button";
    var bR = el("button", "cw-btn cw-primary", "Random reception"); bR.type = "button";
    var ls = el("label", "cw-ctl"); ls.appendChild(el("span", null, "in noise, E<sub>s</sub>/N<sub>0</sub> ="));
    var rs = el("input"); rs.type = "range"; rs.min = -4; rs.max = 6; rs.step = 0.5; rs.value = snr; rs.setAttribute("aria-label", "Es/N0 in dB");
    var vs = el("span", "cw-ctl-val"); ls.appendChild(rs); ls.appendChild(vs);
    ctl2.appendChild(bEx); ctl2.appendChild(bR); ctl2.appendChild(ls);
    box.appendChild(ctl2);

    var fig = el("div", "cw-figure");
    var W = 600, H = 262, x0 = 70, x1 = 590, yT = 18, yB = 208;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "class": "cw-drag-y", "aria-label": "the five LLRs; drag a bar to change it" });
    fig.appendChild(s); box.appendChild(fig);
    function Y(l) { return yT + (LMAX - l) / (2 * LMAX) * (yB - yT); }
    var colW = (x1 - x0) / 5;
    function CX(i) { return x0 + colW * (i + 0.5); }
    var band = svg("rect", { x: x0, width: x1 - x0, "class": "f-erase" }, s);
    [-8, -4, 0, 4, 8].forEach(function (l) {
      svg("line", { x1: x0, x2: x1, y1: Y(l), y2: Y(l), "class": l === 0 ? "ax" : "grid" }, s);
      text(s, x0 - 8, Y(l) + 4, l > 0 ? "+" + l : l < 0 ? "−" + (-l) : "0", "tick", "end");
    });
    text(s, 4, Y(6), "decide 0", "tick", "start"); text(s, 4, Y(-6), "decide 1", "tick", "start");
    var bars = [], vals = [], heads = [], bitsLbl = [];
    for (var i = 0; i < 5; i++) {
      var hit = svg("rect", { x: CX(i) - colW / 2 + 2, y: yT, width: colW - 4, height: yB - yT, fill: "transparent", style: "cursor:ns-resize" }, s);
      hit.dataset.i = i;
      bars.push(svg("rect", { x: CX(i) - 18, width: 36, rx: 3, style: "cursor:ns-resize" }, s));
      bars[i].dataset.i = i;
      heads.push(svg("rect", { x: CX(i) - 22, width: 44, height: 7, rx: 3.5, "class": "handle", tabindex: 0, role: "slider", "aria-label": "L" + (i + 1) }, s));
      heads[i].dataset.i = i;
      vals.push(text(s, CX(i), 0, "", "lbl"));
      text(s, CX(i), yB + 18, "L" + "₁₂₃₄₅"[i], "lbl-i");
      bitsLbl.push(text(s, CX(i), yB + 38, "", "tick"));
    }
    text(s, 4, yB + 38, "sent / ŷ", "tick", "start");

    var tw = el("div", "cw-table-wrap"), table = el("table", "cw-table");
    tw.appendChild(table); box.appendChild(tw);
    var read = el("p", "cw-readout"); box.appendChild(read);
    root.appendChild(box);

    function draw() {
      vt.textContent = T.toFixed(1); vs.textContent = (snr > 0 ? "+" : "") + snr.toFixed(1) + " dB";
      sb.forEach(function (b, k) { b.setAttribute("aria-pressed", k === sent ? "true" : "false"); });
      band.setAttribute("y", Y(T)); band.setAttribute("height", Math.max(0, Y(-T) - Y(T)));
      var x = CODE[sent], yh = "", kept = [];
      for (var i = 0; i < 5; i++) {
        var l = L[i], top = Math.min(Y(l), Y(0)), h = Math.abs(Y(l) - Y(0));
        var bit = l > 0 ? "0" : l < 0 ? "1" : "0";
        yh += bit;
        var erased = Math.abs(l) <= T;
        kept.push(!erased);
        var wrong = l === 0 ? false : bit !== x[i];
        bars[i].setAttribute("y", top); bars[i].setAttribute("height", Math.max(h, 1));
        bars[i].setAttribute("class", wrong ? "f-noise" : "f-sig");
        bars[i].setAttribute("fill-opacity", erased ? "0.35" : "1");
        heads[i].setAttribute("y", Y(l) - 3.5);
        heads[i].setAttribute("aria-valuenow", l.toFixed(1));
        vals[i].setAttribute("y", l >= 0 ? Y(l) - 10 : Y(l) + 20); vals[i].textContent = f1(l);
        bitsLbl[i].textContent = x[i] + " / " + (erased ? "?" : bit);
      }
      // costs
      var rows = CODE.map(function (c) {
        var soft = 0, hard = 0, cons = true;
        for (var i = 0; i < 5; i++) if (c[i] !== yh[i]) { soft += Math.abs(L[i]); hard++; if (kept[i]) cons = false; }
        return { c: c, soft: soft, hard: hard, cons: cons };
      });
      function winners(key, best) { var b = best(rows.map(function (r) { return r[key]; })); return rows.map(function (r) { return r[key] === b; }); }
      var minS = Math.min.apply(null, rows.map(function (r) { return Math.round(r.soft * 1000); }));
      var wS = rows.map(function (r) { return Math.round(r.soft * 1000) === minS; });
      var wH = winners("hard", function (a) { return Math.min.apply(null, a); });
      var wE = rows.map(function (r) { return r.cons; });
      function verdict(w) {
        var idx = []; w.forEach(function (v, k) { if (v) idx.push(k); });
        if (idx.length === 0) return '<span class="cw-bad">no codeword fits</span>';
        if (idx.length > 1) return (idx.indexOf(sent) >= 0 ? "a guess among " : '<span class="cw-bad">a guess among ') + idx.length + (idx.indexOf(sent) >= 0 ? "" : "</span>");
        return idx[0] === sent ? '<span class="cw-ok">' + CODE[idx[0]] + " ✓</span>" : '<span class="cw-bad">' + CODE[idx[0]] + " ✗</span>";
      }
      var h = "<thead><tr><th>codeword</th><th>soft: Σ|Lᵢ| where xᵢ ≠ ŷᵢ</th><th>hard: distance to ŷⁿ</th><th>erasures: consistent?</th></tr></thead><tbody>";
      rows.forEach(function (r, k) {
        var b = '<span class="cw-bits">';
        for (var i = 0; i < 5; i++) b += '<span class="cw-bit' + (r.c[i] !== yh[i] ? " is-diff" : "") + '">' + r.c[i] + "</span>";
        b += "</span>";
        h += '<tr class="' + (k === sent ? "is-sent" : "") + '"><td>' + b + "</td><td" + (wS[k] ? ' class="is-win"' : "") + ">" + fc(r.soft) + "</td><td" +
          (wH[k] ? ' class="is-win"' : "") + ">" + r.hard + "</td><td" + (wE[k] ? ' class="is-win"' : "") + ">" + (r.cons ? "yes" : "no") + "</td></tr>";
      });
      h += "</tbody><tfoot><tr><td>decision</td><td>" + verdict(wS) + "</td><td>" + verdict(wH) + "</td><td>" + verdict(wE) + "</td></tr></tfoot>";
      table.innerHTML = h;
      var nw = 0; for (var j = 0; j < 5; j++) if (L[j] !== 0 && (L[j] > 0 ? "0" : "1") !== x[j]) nw++;
      var nk = 0; for (j = 0; j < 5; j++) if (kept[j] && (L[j] > 0 ? "0" : "1") !== x[j]) nk++;
      read.innerHTML = "Hard decisions <b>ŷⁿ = " + yh + "</b>: " + (nw === 0 ? "no LLR has the wrong sign." : nw + (nw === 1 ? " LLR has" : " LLRs have") + " the wrong sign (orange bars).") +
        " The orange cells in the table are the positions where a codeword contradicts ŷⁿ; the soft decoder pays |<i>L</i><sub><i>i</i></sub>| for each of them, the hard decoder pays 1." +
        (nk ? ' <span class="cw-bad">The receiver with erasures kept ' + (nk === 1 ? "a wrong bit" : nk + " wrong bits") + "</span>: it is not a BEC, and its decoder can be fooled." : "");
    }
    function setFrom(ev, i) {
      var r = s.getBoundingClientRect(), y = (ev.clientY - r.top) / r.height * H;
      var l = LMAX - (y - yT) / (yB - yT) * 2 * LMAX;
      L[i] = Math.max(-LMAX, Math.min(LMAX, Math.round(l * 2) / 2)); draw();
    }
    var drag = -1;
    s.addEventListener("pointerdown", function (ev) {
      var i = ev.target.dataset ? ev.target.dataset.i : undefined;
      if (i === undefined) return;
      drag = +i; s.setPointerCapture(ev.pointerId); setFrom(ev, drag); ev.preventDefault();
    });
    s.addEventListener("pointermove", function (ev) { if (drag >= 0) setFrom(ev, drag); });
    s.addEventListener("pointerup", function () { drag = -1; });
    s.addEventListener("pointercancel", function () { drag = -1; });
    heads.forEach(function (hd, i) {
      hd.addEventListener("keydown", function (ev) {
        var st = ev.shiftKey ? 2 : 0.5;
        if (ev.key === "ArrowUp" || ev.key === "ArrowRight") { L[i] = Math.min(LMAX, L[i] + st); draw(); ev.preventDefault(); }
        if (ev.key === "ArrowDown" || ev.key === "ArrowLeft") { L[i] = Math.max(-LMAX, L[i] - st); draw(); ev.preventDefault(); }
      });
    });
    rt.addEventListener("input", function () { T = parseFloat(rt.value); draw(); });
    rs.addEventListener("input", function () { snr = parseFloat(rs.value); vs.textContent = (snr > 0 ? "+" : "") + snr.toFixed(1) + " dB"; });
    bEx.addEventListener("click", function () { L = EX.slice(); sent = 0; T = 1; rt.value = 1; draw(); });
    bR.addEventListener("click", function () {
      var g = Math.pow(10, snr / 10), mu = 4 * g, sd = Math.sqrt(8 * g), x = CODE[sent];
      for (var i = 0; i < 5; i++) {
        var l = (x[i] === "0" ? mu : -mu) + sd * gauss();
        L[i] = Math.max(-LMAX, Math.min(LMAX, Math.round(l * 10) / 10));
      }
      draw();
    });
    draw();
  }

  function init() { document.querySelectorAll('[data-widget="' + NAME + '"]').forEach(build); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
