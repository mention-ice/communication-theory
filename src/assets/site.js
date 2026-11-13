/* Communication Theory: course website scripts (same design as the Elements of
   Information Theory site). 1. the bit field in the background, 2. the 16QAM
   constellation and the noisy channel on the home page, 3. the quizzes. No libraries. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
  }
  function storageRemove(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* storage blocked */ }
  }

  /* ------------------------------------------------------------------
     1. Background: i.i.d. Bernoulli(p) bits, p = 1/2 at the top of the
        page falling to 0 at the bottom. Ones are drawn as "1", zeros as
        dots, so the field calms down as its entropy drops.
     ------------------------------------------------------------------ */
  function bitField() {
    var canvas = document.getElementById("bitfield");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var CW = 14, CH = 18, FADE = 36;
    var dpr = 1, W = 0, H = 0, docH = 1, quiet = [], color = "", queued = false;
    var sprite = null;

    function hash(x, y) {
      var h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35);
      h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
      h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
      h ^= h >>> 15;
      return (h >>> 0) / 4294967296;
    }

    function makeSprite() {
      color = getComputedStyle(document.documentElement).getPropertyValue("--bits").trim() || "rgba(0,0,0,.15)";
      sprite = document.createElement("canvas");
      sprite.width = Math.ceil(CW * dpr);
      sprite.height = Math.ceil(CH * dpr);
      var s = sprite.getContext("2d");
      s.scale(dpr, dpr);
      s.fillStyle = color;
      s.font = "400 11px 'Space Mono', ui-monospace, Menlo, Consolas, monospace";
      s.textAlign = "center";
      s.textBaseline = "middle";
      s.fillText("1", CW / 2, CH / 2 + 0.5);
    }

    function measure() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      docH = Math.max(document.documentElement.scrollHeight, H);
      quiet = [];
      var sy = window.scrollY || window.pageYOffset || 0;
      var sx = window.scrollX || window.pageXOffset || 0;
      var els = document.querySelectorAll("[data-quiet], .sheet, .lecture-box, .h2-widget, .channel, .preview-banner");
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        quiet.push({ x0: r.left + sx, y0: r.top + sy, x1: r.right + sx, y1: r.bottom + sy });
      }
      makeSprite();
    }

    function draw() {
      queued = false;
      var sy = window.scrollY || window.pageYOffset || 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = color;
      var row0 = Math.floor(sy / CH), row1 = Math.ceil((sy + H) / CH);
      var cols = Math.ceil(W / CW);
      var span = Math.max(docH - H * 0.35, 1);
      for (var row = row0; row <= row1; row++) {
        var yDoc = row * CH;
        var t = Math.min(Math.max(yDoc / span, 0), 1);
        var p = 0.5 * Math.pow(1 - t, 1.5);
        var yv = yDoc - sy;
        // quiet rectangles that touch this row
        var near = [];
        for (var k = 0; k < quiet.length; k++) {
          var q = quiet[k];
          if (yDoc + CH > q.y0 - FADE && yDoc < q.y1 + FADE) near.push(q);
        }
        for (var col = 0; col < cols; col++) {
          var xDoc = col * CW;
          var alpha = 1;
          for (var m = 0; m < near.length; m++) {
            var r = near[m];
            var cx = xDoc + CW / 2, cy = yDoc + CH / 2;
            var dx = Math.max(r.x0 - cx, 0, cx - r.x1);
            var dy = Math.max(r.y0 - cy, 0, cy - r.y1);
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d <= 2) { alpha = 0; break; }
            if (d < FADE) alpha = Math.min(alpha, d / FADE);
          }
          if (alpha <= 0.02) continue;
          ctx.globalAlpha = alpha;
          if (hash(col, row) < p) {
            ctx.drawImage(sprite, xDoc, yv, CW, CH);
          } else {
            ctx.globalAlpha = alpha * 0.75;
            ctx.fillRect(xDoc + CW / 2 - 0.75, yv + CH / 2 - 0.75, 1.5, 1.5);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function schedule() {
      if (!queued) {
        queued = true;
        window.requestAnimationFrame(draw);
      }
    }
    function remeasure() { measure(); schedule(); }

    remeasure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    window.addEventListener("load", remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    if (window.ResizeObserver) new ResizeObserver(remeasure).observe(document.body);
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", remeasure);
      else if (mq.addListener) mq.addListener(remeasure);
    }
    if (window.MutationObserver) {
      new MutationObserver(remeasure).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    }
  }

  /* ------------------------------------------------------------------
     2. Home page: a 16QAM constellation seen through Gaussian noise, and
        the course title sent as bits through the binary symmetric channel
        that hard decisions on these symbols make (Gray labels).
     ------------------------------------------------------------------ */
  function qfun(x) {
    // Q(x) = P(N(0,1) > x), via erfc (Abramowitz-Stegun 7.1.26 is too coarse in the tail; use a continued fraction)
    if (x < 0) return 1 - qfun(-x);
    var t = 1 / (1 + 0.5 * x / Math.SQRT2);
    var z = x / Math.SQRT2;
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return r / 2;
  }
  function gauss() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function qamWidget() {
    var box = document.querySelector("[data-qam]");
    var band = document.querySelector("[data-channel]");
    if (!box) return;
    var svg = box.querySelector("svg");
    var input = box.querySelector("input[type=range]");
    var cloud = svg.querySelector("[data-cloud]");
    var cx = +svg.getAttribute("data-cx"), cy = +svg.getAttribute("data-cy"), unit = +svg.getAttribute("data-unit");
    var outS = box.querySelector("[data-out=snr]"), outE = box.querySelector("[data-out=ser]"),
        outB = box.querySelector("[data-out=ber]"), outC = box.querySelector("[data-out=cap]");
    var N = 480, NS = "http://www.w3.org/2000/svg";
    var levels = [-3, -1, 1, 3];
    var pts = [], noise = [], dots = [];
    for (var i = 0; i < N; i++) {
      pts.push([levels[(Math.random() * 4) | 0], levels[(Math.random() * 4) | 0]]);
      noise.push([gauss(), gauss()]);
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("r", "1.9");
      cloud.appendChild(c);
      dots.push(c);
    }
    var pb = 0;
    function decide(v) { return v < -2 ? -3 : v < 0 ? -1 : v < 2 ? 1 : 3; }
    function render() {
      var db = +input.value, snr = Math.pow(10, db / 10);
      // Es = 10 for levels +-1, +-3; noise variance per dimension N0/2 = Es / (2 snr)
      var sigma = Math.sqrt(10 / (2 * snr));
      var errs = 0;
      for (var i = 0; i < N; i++) {
        var x = pts[i][0] + sigma * noise[i][0], y = pts[i][1] + sigma * noise[i][1];
        var bad = decide(x) !== pts[i][0] || decide(y) !== pts[i][1];
        if (bad) errs += 1;
        var px = Math.max(Math.min(cx + unit * x, cx + 4.6 * unit), cx - 4.6 * unit);
        var py = Math.max(Math.min(cy - unit * y, cy + 4.6 * unit), cy - 4.6 * unit);
        dots[i].setAttribute("cx", px.toFixed(1));
        dots[i].setAttribute("cy", py.toFixed(1));
        dots[i].setAttribute("class", bad ? "rx err" : "rx");
      }
      var a = 1 / sigma;
      pb = (3 * qfun(a) + 2 * qfun(3 * a) - qfun(5 * a)) / 4;
      outS.textContent = db.toFixed(1);
      outE.textContent = (errs / N).toFixed(3);
      outB.textContent = pb < 1e-4 ? pb.toExponential(1) : pb.toFixed(4);
      outC.textContent = (Math.log(1 + snr) / Math.LN2).toFixed(2);
    }
    render();
    var channel = band ? makeChannel(band, function () { return pb; }) : null;
    input.addEventListener("input", function () {
      render();
      if (channel) channel.setP(pb);
    });
  }

  function makeChannel(band, getP) {
    var bits = band.getAttribute("data-bits") || "";
    var rowX = band.querySelector("[data-row=x]");
    var rowY = band.querySelector("[data-row=y]");
    var meter = band.querySelector("[data-out=phat]");
    var n = bits.length;
    if (!n || !rowX || !rowY) return null;
    var spansX = [], spansY = [];
    rowX.textContent = ""; rowY.textContent = "";
    for (var i = 0; i < n; i++) {
      var a = document.createElement("span"); a.textContent = bits[i]; rowX.appendChild(a); spansX.push(a);
      var b = document.createElement("span"); b.textContent = bits[i]; rowY.appendChild(b); spansY.push(b);
    }
    var sent = 0, flipped = 0, pos = 0, timer = null, visible = true;
    var STEP = 34, PAUSE = 1400;

    function showMeter() {
      meter.textContent = sent ? "p̂ = " + (flipped / sent).toFixed(3) + " over " + sent.toLocaleString("en") + " bits" : "p̂ = –";
    }
    function sendBit(i) {
      var z = Math.random() < getP();
      var y = z ? (bits[i] === "1" ? "0" : "1") : bits[i];
      var s = spansY[i];
      s.textContent = y;
      s.className = z ? "flip" : "";
      sent += 1; if (z) flipped += 1;
    }
    function sampleAll() {
      for (var i = 0; i < n; i++) sendBit(i);
      showMeter();
    }
    function tick() {
      timer = null;
      if (!visible || document.hidden) return;
      if (pos > 0) spansX[pos - 1].className = "";
      if (pos === 0) for (var k = 0; k < n; k++) if (spansY[k].className !== "flip") spansY[k].className = "pending"; else spansY[k].className = "flip pending";
      if (pos < n) {
        sendBit(pos);
        spansX[pos].className = "head";
        pos += 1;
        showMeter();
        timer = window.setTimeout(tick, STEP);
      } else {
        pos = 0;
        timer = window.setTimeout(tick, PAUSE);
      }
    }
    function start() { if (!reduceMotion && timer === null) timer = window.setTimeout(tick, 400); }
    function stop() { if (timer !== null) { window.clearTimeout(timer); timer = null; } }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(band);
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else if (visible) start(); });

    sampleAll();
    start();
    return {
      setP: function () {
        sent = 0; flipped = 0;
        if (reduceMotion) sampleAll(); else showMeter();
      }
    };
  }

  /* ------------------------------------------------------------------
     3. Quizzes. Each question carries hashes of its correct letters
        (FNV-1a of key + ":" + letter), so the page source does not show
        the answers at a glance. Answers are kept in localStorage only.
     ------------------------------------------------------------------ */
  function fnv1a(text) {
    var bytes = window.TextEncoder ? new TextEncoder().encode(text) : unescape(encodeURIComponent(text)).split("").map(function (c) { return c.charCodeAt(0); });
    var h = 0x811c9dc5;
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    var s = (h >>> 0).toString(16);
    return "00000000".slice(s.length) + s;
  }

  function quizzes() {
    var lists = document.querySelectorAll("ol.quiz");
    for (var i = 0; i < lists.length; i++) setupQuiz(lists[i]);
  }

  function setupQuiz(list) {
    var block = list.closest(".block") || document;
    var page = list.getAttribute("data-quiz") || "quiz";
    var qs = Array.prototype.slice.call(list.querySelectorAll("li.q"));
    var bitsBox = block.querySelector("[data-score-bits]");
    var text = block.querySelector("[data-score-text]");
    var reset = block.querySelector("[data-reset]");
    var cells = [];

    qs.forEach(function (q, idx) {
      var key = q.getAttribute("data-key");
      var checks = (q.getAttribute("data-check") || "").split(",");
      var opts = Array.prototype.slice.call(q.querySelectorAll(".opt"));
      q._state = null;
      q._right = opts.filter(function (o) { return checks.indexOf(fnv1a(key + ":" + o.getAttribute("data-letter"))) >= 0; })
                     .map(function (o) { return o.getAttribute("data-letter"); });
      q._bits = Math.log2(Math.max(opts.length, 2));
      opts.forEach(function (o) {
        o.addEventListener("click", function () {
          if (q._state) return;
          answer(q, o.getAttribute("data-letter"), true);
        });
      });
      if (bitsBox) {
        var a = document.createElement("a");
        a.href = "#" + q.id;
        a.className = "sb";
        a.textContent = "·";
        a.title = "Question " + (idx + 1) + ": not answered";
        bitsBox.appendChild(a);
        cells.push(a);
      }
      var saved = storageGet("ct-quiz:" + page + ":" + key);
      if (saved && opts.some(function (o) { return o.getAttribute("data-letter") === saved; })) answer(q, saved, false);
    });

    function answer(q, letter, save) {
      var good = q._right.indexOf(letter) >= 0;
      q._state = good ? "good" : "bad";
      q.classList.add("answered");
      var opts = q.querySelectorAll(".opt");
      for (var j = 0; j < opts.length; j++) {
        var o = opts[j], l = o.getAttribute("data-letter");
        o.disabled = true;
        if (q._right.indexOf(l) >= 0) o.classList.add("is-key");
        if (l === letter) {
          o.classList.add("is-chosen");
          if (!good) o.classList.add("is-wrong");
          o.setAttribute("aria-pressed", "true");
        }
      }
      var fb = q.querySelector(".q-feedback");
      if (fb) {
        fb.className = "q-feedback " + q._state;
        var keyText = q._right.join(" or ");
        fb.textContent = good ? "Correct." : (q._right.length ? "Not quite. The answer is " + keyText + "." : "Not quite.");
      }
      if (save) storageSet("ct-quiz:" + page + ":" + q.getAttribute("data-key"), letter);
      update();
    }

    function clear(q) {
      q._state = null;
      q.classList.remove("answered");
      var opts = q.querySelectorAll(".opt");
      for (var j = 0; j < opts.length; j++) {
        opts[j].disabled = false;
        opts[j].classList.remove("is-key", "is-chosen", "is-wrong");
        opts[j].removeAttribute("aria-pressed");
      }
      var fb = q.querySelector(".q-feedback");
      if (fb) { fb.className = "q-feedback"; fb.textContent = ""; }
    }

    function update() {
      var answered = 0, right = 0, bits = 0, total = 0;
      qs.forEach(function (q, idx) {
        total += q._bits;
        var c = cells[idx];
        if (q._state) answered += 1;
        if (q._state === "good") { right += 1; bits += q._bits; }
        if (c) {
          c.className = "sb" + (q._state === "good" ? " sb-1" : q._state === "bad" ? " sb-0" : "");
          c.textContent = q._state === "good" ? "1" : q._state === "bad" ? "0" : "·";
          c.title = "Question " + (idx + 1) + ": " + (q._state === "good" ? "correct" : q._state === "bad" ? "wrong" : "not answered");
        }
      });
      if (text) {
        var s = "<b>" + answered + "</b> of " + qs.length + " answered";
        if (answered) s += " · <b>" + right + "</b> correct";
        s += " · <b>" + fmtBits(bits) + "</b> of " + fmtBits(total) + " bits recovered";
        text.innerHTML = s;
        text.title = "A question with k options hides log₂ k bits; a correct answer recovers them.";
      }
      if (reset) reset.disabled = answered === 0;
    }

    function fmtBits(b) {
      return Math.abs(b - Math.round(b)) < 1e-9 ? String(Math.round(b)) : b.toFixed(1);
    }

    if (reset) {
      reset.addEventListener("click", function () {
        qs.forEach(function (q) {
          storageRemove("ct-quiz:" + page + ":" + q.getAttribute("data-key"));
          clear(q);
        });
        update();
      });
    }
    update();
  }

  /* ------------------------------------------------------------------
     4. Inline formulas wider than the column (on phones) get their own
        horizontal scroll instead of widening the page.
     ------------------------------------------------------------------ */
  function wideMath() {
    function blockOf(el) {
      var b = el.parentElement;
      while (b && b !== document.body && getComputedStyle(b).display.indexOf("inline") === 0) b = b.parentElement;
      return b || document.body;
    }
    function mark() {
      var els = document.querySelectorAll("mjx-container:not([display='true'])");
      var i;
      for (i = 0; i < els.length; i++) els[i].classList.remove("wide-inline");
      for (i = 0; i < els.length; i++) {
        var b = blockOf(els[i]);
        if (els[i].getBoundingClientRect().width > b.clientWidth + 1) els[i].classList.add("wide-inline");
      }
    }
    var tries = 0;
    function wait() {
      if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
        window.MathJax.startup.promise.then(function () {
          mark();
          var t = null;
          window.addEventListener("resize", function () {
            if (t) window.clearTimeout(t);
            t = window.setTimeout(mark, 200);
          });
        });
      } else if (document.getElementById("MathJax-script") && tries++ < 100) {
        window.setTimeout(wait, 150);
      }
    }
    wait();
  }

  function init() {
    bitField();
    qamWidget();
    quizzes();
    wideMath();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
