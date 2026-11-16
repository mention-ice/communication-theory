/* Lecture 1, Section 1.4: what the minimum distance guarantees. The code of Example 1.5 (d = 3).
   Click a bit of the received word to flip it, again to erase it, again to restore it. The table follows
   the proof of the proposition "guarantees from d": a codeword other than the sent one can win only if it
   is at least as likely, that is, if it disagrees with the kept bits at most as often as the sent one.
   Draws into every [data-widget="c1-guarantee"]. No libraries. */
(function () {
  "use strict";
  var NAME = "c1-guarantee";
  var CODE = ["00000", "01011", "10101", "11110"], D = 3;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function build(root) {
    var sent = 0, st = [0, 0, 0, 0, 0];   // 0 received, 1 flipped, 2 erased
    root.innerHTML = "";
    var box = el("div", "cw");
    box.appendChild(el("p", "cw-title", "Try it: flip or erase bits of the sent codeword"));
    var ctl = el("div", "cw-controls");
    var sl = el("span", "cw-ctl", "sent");
    var tg = el("span", "cw-toggle"), sb = [];
    CODE.forEach(function (c, i) { var b = el("button", null, c); b.type = "button"; b.addEventListener("click", function () { sent = i; draw(); }); tg.appendChild(b); sb.push(b); });
    sl.appendChild(tg);
    var clr = el("button", "cw-btn", "Clear"); clr.type = "button";
    ctl.appendChild(sl); ctl.appendChild(clr); box.appendChild(ctl);

    var rowR = el("div", "cw-controls");
    rowR.appendChild(el("span", "cw-ctl", "received yⁿ (click a bit)"));
    var cells = el("span", "cw-bits"), btn = [];
    for (var i = 0; i < 5; i++) {
      var b = el("button", "cw-bit"); b.type = "button";
      (function (k) { b.addEventListener("click", function () { st[k] = (st[k] + 1) % 3; draw(); }); })(i);
      cells.appendChild(b); btn.push(b);
    }
    rowR.appendChild(cells);
    var badge = el("span", "cw-ctl"); rowR.appendChild(badge);
    box.appendChild(rowR);
    var tw = el("div", "cw-table-wrap"), table = el("table", "cw-table"); tw.appendChild(table); box.appendChild(tw);
    var read = el("p", "cw-readout"); box.appendChild(read);
    box.appendChild(el("p", "cw-note", "The decoder keeps the codewords that disagree least with the bits that were not erased (this is ML when δ < 1/2). " +
      "With erasures only, it keeps the consistent codewords, as on the BEC; with flips only, it is minimum Hamming distance decoding, as on the BSC."));
    root.appendChild(box);

    function draw() {
      sb.forEach(function (b, k) { b.setAttribute("aria-pressed", k === sent ? "true" : "false"); });
      var x = CODE[sent], y = "", nf = 0, ne = 0;
      for (var i = 0; i < 5; i++) {
        var v = st[i] === 1 ? (x[i] === "0" ? "1" : "0") : st[i] === 2 ? "?" : x[i];
        y += v; if (st[i] === 1) nf++; if (st[i] === 2) ne++;
        btn[i].textContent = v;
        btn[i].className = "cw-bit" + (st[i] === 1 ? " is-flip" : st[i] === 2 ? " is-erased" : "");
        btn[i].setAttribute("aria-label", "bit " + (i + 1) + ": " + ["received", "flipped", "erased"][st[i]] + ". Click to change.");
      }
      badge.innerHTML = nf + (nf === 1 ? " flip, " : " flips, ") + ne + (ne === 1 ? " erasure" : " erasures");
      function dis(c) { var d = 0; for (var i = 0; i < 5; i++) if (y[i] !== "?" && y[i] !== c[i]) d++; return d; }
      var dSent = dis(x), best = Math.min.apply(null, CODE.map(dis));
      var winners = CODE.map(function (c) { return dis(c) === best; });
      var h = "<thead><tr><th>codeword</th><th>differs from the sent one at</th><th>erased there</th><th>flipped there</th><th>disagrees with kept bits</th><th>at least as likely as the sent one?</th></tr></thead><tbody>";
      CODE.forEach(function (c, k) {
        var bits = '<span class="cw-bits">', diff = 0, er = 0, fl = 0;
        for (var i = 0; i < 5; i++) {
          var dd = c[i] !== x[i];
          if (dd) { diff++; if (st[i] === 2) er++; if (st[i] === 1) fl++; }
          bits += '<span class="cw-bit' + (dd ? " is-diff" : "") + '">' + c[i] + "</span>";
        }
        bits += "</span>";
        var dk = dis(c), al = dk <= dSent;
        h += '<tr class="' + (k === sent ? "is-sent" : "") + '"><td>' + bits + "</td>" +
          (k === sent ? '<td colspan="3">the sent codeword</td>' : "<td>" + diff + " positions</td><td>" + er + "</td><td>" + fl + "</td>") +
          "<td" + (winners[k] ? ' class="is-win"' : "") + ">" + dk + "</td><td>" + (k === sent ? "–" : al ? '<span class="cw-bad">yes</span>' : "no") + "</td></tr>";
      });
      table.innerHTML = h + "</tbody>";
      var nwin = winners.filter(Boolean).length, ok = winners[sent] && nwin === 1;
      var res = ok ? '<span class="cw-ok">ML decodes ' + x + ", correctly.</span>" :
        winners[sent] ? '<span class="cw-bad">ML has to guess among ' + nwin + " codewords.</span>" : '<span class="cw-bad">ML picks a wrong codeword.</span>';
      var g;
      if (nf === 0 && ne === 0) g = "Nothing happened to the sent codeword. Click the bits to flip or erase them.";
      else if (nf === 0) g = ne + (ne === 1 ? " erasure" : " erasures") + (ne <= D - 1 ? ": within the guarantee, at most <i>d</i> − 1 = 2 erasures on the BEC. " : ": beyond the guarantee of <i>d</i> − 1 = 2 erasures, so ML may fail. ") +
        "Another codeword is possible only if <b>all</b> the positions where it differs from the sent one are erased, and there are at least <i>d</i> = 3 of them.";
      else if (ne === 0) g = nf + (nf === 1 ? " flip" : " flips") + (nf <= 1 ? ": within the guarantee, at most ⌊(<i>d</i> − 1)/2⌋ = 1 error on the BSC. " : ": beyond the guarantee of ⌊(<i>d</i> − 1)/2⌋ = 1 error, so ML may fail. ") +
        "Another codeword is at least as likely only if <b>at least half</b> of the positions where it differs from the sent one are flipped.";
      else g = "Flips and erasures together: the proposition speaks of each kind alone, but the table still tells which codewords are at least as likely as the sent one.";
      read.innerHTML = g + " " + res;
    }
    clr.addEventListener("click", function () { st = [0, 0, 0, 0, 0]; draw(); });
    draw();
  }

  function init() { document.querySelectorAll('[data-widget="' + NAME + '"]').forEach(build); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
