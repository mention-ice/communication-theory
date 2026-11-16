/* Lecture 1, Section 1.1: the chain message -> encoder -> channel -> decoder, run message by message.
   The code is the one of Example 1.5, C = {00000, 01011, 10101, 11110}; the channel is a BSC(delta);
   the decoder is ML (the codeword nearest to y^n, ties broken at random). The counter estimates P_e.
   Draws into every [data-widget="c1-chain"]. Optional argument: delta=0.1. No libraries. */
(function () {
  "use strict";
  var NAME = "c1-chain";
  var CODE = ["00000", "01011", "10101", "11110"];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function args(node) {
    var out = {};
    (node.getAttribute("data-args") || "").split(/\s+/).forEach(function (kv) {
      var m = kv.match(/^(\w+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    });
    return out;
  }
  function dist(a, b) { var d = 0; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; }
  function decode(y) {
    var best = Infinity, arg = [];
    CODE.forEach(function (c, w) {
      var d = dist(c, y);
      if (d < best) { best = d; arg = [w]; } else if (d === best) arg.push(w);
    });
    return { w: arg[Math.floor(Math.random() * arg.length)], ties: arg.length };
  }
  function bits(str, cls) {
    var b = el("span", "cw-bits");
    for (var i = 0; i < str.length; i++) b.appendChild(el("span", "cw-bit" + (cls && cls[i] ? " " + cls[i] : ""), str[i]));
    return b;
  }

  function build(root) {
    var a = args(root);
    var delta = Math.min(Math.max(parseFloat(a.delta) || 0.1, 0), 0.5);
    var sent = 0, wrong = 0;
    root.innerHTML = "";
    var box = el("div", "cw");
    box.appendChild(el("p", "cw-title", "Try it: send messages through the chain"));

    var ctl = el("div", "cw-controls");
    var lab = el("label", "cw-ctl");
    lab.appendChild(document.createTextNode("BSC: δ ="));
    var rng = el("input"); rng.type = "range"; rng.min = 0; rng.max = 0.5; rng.step = 0.01; rng.value = delta;
    rng.setAttribute("aria-label", "crossover probability delta");
    var val = el("span", "cw-ctl-val", delta.toFixed(2));
    lab.appendChild(rng); lab.appendChild(val);
    var b1 = el("button", "cw-btn cw-primary", "Send a message"); b1.type = "button";
    var b2 = el("button", "cw-btn", "Send 1000"); b2.type = "button";
    var b3 = el("button", "cw-btn", "Reset"); b3.type = "button";
    ctl.appendChild(lab); ctl.appendChild(b1); ctl.appendChild(b2); ctl.appendChild(b3);
    box.appendChild(ctl);

    var chain = el("div", "cw-chain");
    function stage(label, content) {
      var s = el("div", "cw-stage");
      s.appendChild(el("span", "cw-stage-lbl", label));
      var c = el("div", "cw-stage-body"); s.appendChild(c);
      if (content) c.appendChild(content);
      return { node: s, body: c };
    }
    var sW = stage("w"), sX = stage("xⁿ(w)"), sY = stage("yⁿ"), sH = stage("ŵ");
    var arrow = function (t) { var a = el("span", "cw-arrow"); a.innerHTML = '→ <span class="cw-box">' + t + "</span> →"; return a; };
    chain.appendChild(sW.node); chain.appendChild(arrow("encoder"));
    chain.appendChild(sX.node); chain.appendChild(arrow("channel"));
    chain.appendChild(sY.node); chain.appendChild(arrow("decoder"));
    chain.appendChild(sH.node);
    box.appendChild(chain);

    var read = el("p", "cw-readout");
    box.appendChild(read);
    var stats = el("dl", "cw-stats");
    box.appendChild(stats);
    box.appendChild(el("p", "cw-note", "The four messages are sent as the codewords of Example 1.5: 1 → 00000, 2 → 01011, 3 → 10101, 4 → 11110. " +
      "The decoder picks the codeword nearest to yⁿ, which is the best decoder here (Section 1.2). " +
      "Wrong messages divided by messages sent estimates <i>P</i><sub>e</sub>."));
    root.appendChild(box);

    function blank() {
      sW.body.innerHTML = '<span class="cw-msg">?</span>';
      sX.body.innerHTML = ""; sX.body.appendChild(bits("·····"));
      sY.body.innerHTML = ""; sY.body.appendChild(bits("·····"));
      sH.body.innerHTML = '<span class="cw-msg">?</span>';
      read.innerHTML = "Press <b>Send a message</b>: a message is drawn at random, encoded, sent over the channel and decoded.";
    }
    function showStats() {
      var pe = sent ? wrong / sent : 0;
      stats.innerHTML = "<div><dt>messages sent</dt><dd>" + sent + "</dd></div>" +
        "<div><dt>wrong messages</dt><dd>" + wrong + "</dd></div>" +
        "<div><dt>estimate of Pₑ</dt><dd>" + (sent ? pe.toFixed(sent >= 1000 ? 4 : 3) : "–") + "</dd></div>";
    }
    function once() {
      var w = Math.floor(Math.random() * 4), x = CODE[w], y = "", flips = [];
      for (var i = 0; i < 5; i++) {
        var f = Math.random() < delta;
        y += f ? (x[i] === "0" ? "1" : "0") : x[i];
        flips.push(f ? "is-flip" : "");
      }
      var d = decode(y);
      sent++; if (d.w !== w) wrong++;
      return { w: w, x: x, y: y, flips: flips, d: d };
    }
    function show(r) {
      sW.body.innerHTML = '<span class="cw-msg cw-pulse">' + (r.w + 1) + "</span>";
      sX.body.innerHTML = ""; sX.body.appendChild(bits(r.x));
      sY.body.innerHTML = ""; sY.body.appendChild(bits(r.y, r.flips));
      var ok = r.d.w === r.w;
      sH.body.innerHTML = '<span class="cw-msg cw-pulse ' + (ok ? "is-right" : "is-wrong") + '">' + (r.d.w + 1) + "</span>";
      var nf = r.flips.filter(Boolean).length;
      read.innerHTML = (nf === 0 ? "No bit was flipped." : nf + (nf === 1 ? " bit was flipped" : " bits were flipped") + " (in red).") +
        " The nearest codeword is " + CODE[r.d.w] + (r.d.ties > 1 ? " (a tie between " + r.d.ties + " codewords, broken at random)" : "") +
        ": " + (ok ? '<span class="cw-ok">right message</span>.' : '<span class="cw-bad">wrong message</span>.');
      showStats();
    }
    rng.addEventListener("input", function () {
      delta = parseFloat(rng.value); val.textContent = delta.toFixed(2);
      sent = wrong = 0; showStats();
    });
    b1.addEventListener("click", function () { show(once()); });
    b2.addEventListener("click", function () { var r; for (var k = 0; k < 1000; k++) r = once(); show(r); });
    b3.addEventListener("click", function () { sent = wrong = 0; blank(); showStats(); });
    blank(); showStats();
  }

  function init() { document.querySelectorAll('[data-widget="' + NAME + '"]').forEach(build); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
