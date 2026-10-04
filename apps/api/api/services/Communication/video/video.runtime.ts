/**
 * LE MOTEUR NAVIGATEUR des vidéos motion design.
 *
 * Écrit en JavaScript brut (chaîne) et non en TypeScript compilé : ce code
 * tourne DANS la page rendue par Chromium, et la cible ES2016 de l'API
 * transformerait `async` en assistants qui n'existent pas côté page.
 *
 * Le contrat est unique : `window.__IDEM_VIDEO__.seek(t)` pose la vidéo EXACTEMENT
 * à l'instant t. Toutes les animations sont des tweens GSAP posés sur une ligne
 * de temps en pause, en `fromTo` explicites : quel que soit l'ordre dans lequel
 * on demande les images (rendu parallèle par tronçons), l'image t est toujours
 * la même. Rien ne dépend de l'horloge, de requestAnimationFrame ni du hasard.
 *
 * Le même moteur sert l'APERÇU (lecture en temps réel dans le navigateur de
 * l'utilisateur, musique comprise) et le RENDU (capture image par image) : ce
 * qu'on voit dans l'aperçu est ce qui sera livré.
 */

/** Styles du moteur. Les jetons de surface (`--bg`, `--ink`…) sont posés par le compositeur. */
export const VIDEO_ENGINE_CSS = String.raw`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{overflow:hidden;background:#0b0b0c}
#stage{position:relative;overflow:hidden;font-family:var(--f-body),system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;transform-origin:0 0}
.scene{position:absolute;inset:0;overflow:hidden;visibility:hidden;background:var(--bg);color:var(--ink);will-change:transform}
.safe{position:absolute;left:var(--sx);right:var(--sx);top:var(--st);bottom:var(--sb);display:flex;flex-direction:column;transform-origin:50% 50%}
.display{font-family:var(--f-display),var(--f-body),system-ui,sans-serif;font-weight:800;line-height:1.04;letter-spacing:-0.02em}
.body{font-family:var(--f-body),system-ui,sans-serif;line-height:1.3}
.fit{display:block;width:100%;min-width:0;overflow-wrap:normal;word-break:normal;hyphens:none}
.kicker{font-family:var(--f-body),system-ui,sans-serif;font-size:calc(var(--u)*3.6);font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--hl-text)}
.hl-word{color:var(--hl-text);background-image:linear-gradient(var(--hl-soft),var(--hl-soft));background-repeat:no-repeat;background-position:0 88%;background-size:100% 30%}
.deco{pointer-events:none;will-change:transform}
/* Les masques de SplitText ne doivent pas rogner les accents ni les jambages. */
.wd-mask,.ln-mask,.ch-mask{padding:0.14em 0 0.1em;margin:-0.14em 0 -0.1em}
.media{position:absolute;inset:0;overflow:hidden}
.media img,.card img,.tile img{width:100%;height:100%;object-fit:cover;display:block;will-change:transform}
.scrim{position:absolute;inset:0;background:linear-gradient(to top,color-mix(in srgb,var(--bg) 94%,transparent) 0%,color-mix(in srgb,var(--bg) 70%,transparent) 38%,transparent 72%)}
.card{position:relative;overflow:hidden;border-radius:calc(var(--u)*4);box-shadow:0 calc(var(--u)*3) calc(var(--u)*8) rgba(0,0,0,.18)}
.price-tag{display:inline-block;padding:calc(var(--u)*1.8) calc(var(--u)*4.5);border-radius:999px;background:var(--hl);color:var(--hl-ink);font-size:calc(var(--u)*7);line-height:1.1;transform:rotate(-4deg);white-space:nowrap}
.bracket{position:absolute;top:18%;bottom:18%;width:calc(var(--u)*4);border:calc(var(--u)*1.2) solid var(--hl)}
.bracket-l{left:0;border-right:none}.bracket-r{right:0;border-left:none}
.tick{flex:none;display:flex;align-items:center;justify-content:center;width:calc(var(--u)*12);height:calc(var(--u)*12);border-radius:999px;background:var(--hl);color:var(--hl-ink)}
.tick svg{width:62%;height:62%}
.benefit-card{display:flex;flex-direction:column;gap:calc(var(--u)*1.5);padding:calc(var(--u)*4);border-radius:calc(var(--u)*3);background:color-mix(in srgb,var(--ink) 6%,transparent);border-left:calc(var(--u)*1.2) solid var(--hl)}
.benefit-num{font-size:calc(var(--u)*5);color:var(--hl-text);line-height:1}
.stat-value{font-size:calc(var(--u)*22);line-height:1;letter-spacing:-0.04em;white-space:nowrap}
.badge,.burst{display:flex;align-items:center;justify-content:center;border-radius:999px;background:var(--hl);color:var(--hl-ink);white-space:nowrap}
.badge{width:calc(var(--u)*24);height:calc(var(--u)*24);font-size:calc(var(--u)*7);transform:rotate(-12deg)}
.burst{width:72%;height:72%;font-size:calc(var(--u)*13)}
.old-price{font-size:calc(var(--u)*7);color:var(--muted)}
.strike{position:absolute;left:-6%;right:-6%;top:52%;height:calc(var(--u)*1);background:var(--hl);border-radius:999px;transform:rotate(-8deg);transform-origin:left center}
.quote-mark{width:calc(var(--u)*16);color:var(--hl)}
.event-row{display:flex;align-items:center;gap:calc(var(--u)*3.5)}
.event-icon{flex:none;display:flex;align-items:center;justify-content:center;width:calc(var(--u)*11);height:calc(var(--u)*11);border-radius:calc(var(--u)*2.6);background:var(--hl);color:var(--hl-ink)}
.event-icon svg{width:58%;height:58%}
.gallery{flex:1;display:grid;gap:calc(var(--u)*2.4);min-height:0}
.gallery.g2{grid-template-rows:1fr 1fr}
.gallery.g3{grid-template-rows:1.3fr 1fr;grid-template-columns:1fr 1fr}
.gallery.g3 .tile:first-child{grid-column:1 / span 2}
.gallery.g3-land{grid-template-columns:1.3fr 1fr 1fr}
.tile{position:relative;overflow:hidden;border-radius:calc(var(--u)*3);min-height:0}
.swap-window{position:relative;width:100%;height:calc(var(--u)*20);overflow:hidden}
.swap-word{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.swap-word:last-child{color:var(--hl-text)}
.cta-button{display:inline-flex;align-items:center;gap:calc(var(--u)*3);padding:calc(var(--u)*3.6) calc(var(--u)*7);border-radius:999px;background:var(--hl);color:var(--hl-ink);font-size:calc(var(--u)*6);line-height:1.1;box-shadow:0 calc(var(--u)*2) calc(var(--u)*6) rgba(0,0,0,.18);max-width:100%}
.cta-arrow{display:inline-flex;width:calc(var(--u)*6);height:calc(var(--u)*6)}
.cta-circle{flex:none;display:flex;align-items:center;justify-content:center;width:calc(var(--u)*18);height:calc(var(--u)*18);border-radius:999px;background:var(--hl);color:var(--hl-ink)}
.cta-circle svg{width:52%;height:52%}
.logo-img{width:calc(var(--u)*62);height:calc(var(--u)*30);object-fit:contain;display:block}
.logo-plate .logo-img{width:calc(var(--u)*50);height:calc(var(--u)*24)}
.logo-reveal{display:flex;align-items:center;justify-content:center;width:100%}
.logo-plate{display:flex;align-items:center;justify-content:center;padding:calc(var(--u)*7);border-radius:calc(var(--u)*6);background:#fff;box-shadow:0 calc(var(--u)*3) calc(var(--u)*10) rgba(0,0,0,.14)}
.logo-rings{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.logo-rings span{position:absolute;width:calc(var(--u)*80);aspect-ratio:1;border-radius:999px;border:calc(var(--u)*0.8) solid var(--hl);opacity:0}
#brandmark{position:absolute;z-index:500;top:calc(var(--st) * 0.45);left:var(--sx);height:calc(var(--u)*9);padding:calc(var(--u)*1.6) calc(var(--u)*2.6);border-radius:999px;background:#fff;box-shadow:0 calc(var(--u)*.6) calc(var(--u)*2.4) rgba(0,0,0,.16);visibility:hidden}
#brandmark img{height:100%;width:auto;display:block}
.tr-panel{position:absolute;inset:0;z-index:400;will-change:transform}
.tr-flash{position:absolute;inset:0;z-index:401;opacity:0}
/* Aperçu */
body.preview{display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;background:transparent}
.pv-wrap{position:relative;overflow:hidden;border-radius:12px}
.pv-ui{position:absolute;left:0;right:0;bottom:0;z-index:900;display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(transparent,rgba(0,0,0,.55));font:600 12px system-ui,sans-serif;color:#fff;opacity:0;transition:opacity .2s}
.pv-wrap:hover .pv-ui,.pv-ui.pv-show{opacity:1}
.pv-btn{flex:none;width:34px;height:34px;border-radius:999px;border:0;background:#fff;color:#111;font-size:14px;cursor:pointer}
.pv-bar{flex:1;height:5px;border-radius:9px;background:rgba(255,255,255,.35);cursor:pointer;position:relative}
.pv-fill{position:absolute;left:0;top:0;bottom:0;border-radius:9px;background:#fff;width:0}
.pv-big{position:absolute;inset:0;z-index:950;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.18);cursor:pointer;border:0}
.pv-big span{width:78px;height:78px;border-radius:999px;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 8px 30px rgba(0,0,0,.3)}
`;

/** Le moteur : prépare la page puis expose `window.__IDEM_VIDEO__`. */
export const VIDEO_RUNTIME_JS = String.raw`
(function () {
  'use strict';
  var D = window.__VIDEO_DATA__;
  var stage = document.getElementById('stage');
  var U = Math.min(D.width, D.height) / 100;
  var HORIZONTAL = D.width > D.height;
  gsap.registerPlugin(SplitText);

  var STYLES = {
    energetic: { ease: 'expo.out', inOut: 'expo.inOut', back: 'back.out(2.2)', d: 0.6, st: 0.055, tr: 0.5, drift: 1.2 },
    premium:   { ease: 'power3.out', inOut: 'power3.inOut', back: 'back.out(1.3)', d: 1.0, st: 0.09, tr: 0.8, drift: 0.6 },
    playful:   { ease: 'back.out(1.7)', inOut: 'power2.inOut', back: 'elastic.out(1,0.6)', d: 0.75, st: 0.07, tr: 0.6, drift: 1 },
    corporate: { ease: 'power2.out', inOut: 'power2.inOut', back: 'back.out(1.25)', d: 0.8, st: 0.07, tr: 0.65, drift: 0.7 }
  };
  var P = STYLES[D.style] || STYLES.corporate;
  var COVER = { wipe: 1, split: 1, flash: 1 };

  // ── Outils ──────────────────────────────────────────────────────────────
  function q(el, r) { return el.querySelector('[data-r="' + r + '"]'); }
  function qa(el, r) { return Array.prototype.slice.call(el.querySelectorAll('[data-r="' + r + '"]')); }
  function has(t) { return !!t && (!Array.isArray(t) || t.length > 0); }
  function assign(a, b, c) { return Object.assign({}, a, b || {}, c || {}); }
  /** Entrée : l'état de départ est posé tout de suite (avant le début, l'élément est caché). */
  function E(tl, t, from, to, at) { if (has(t)) tl.fromTo(t, from, assign({ duration: P.d, ease: P.ease }, to, { immediateRender: true }), at); }
  /** Sortie / boucle : n'écrase pas l'état posé par l'entrée. */
  function X(tl, t, from, to, at) { if (has(t)) tl.fromTo(t, from, assign({ duration: P.d * 0.6, ease: 'power2.in' }, to, { immediateRender: false }), at); }
  function draw(tl, path, at, dur) {
    if (!path || !path.getTotalLength) return;
    var L = path.getTotalLength() + 2;
    path.style.strokeDasharray = L + ' ' + L;
    E(tl, path, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur || P.d * 1.2, ease: P.inOut }, at);
  }
  function split(el, type) {
    if (!el) return null;
    try { return new SplitText(el, { type: type, mask: type.indexOf('lines') >= 0 ? 'lines' : 'words', linesClass: 'ln', wordsClass: 'wd', charsClass: 'ch', aria: 'none' }); }
    catch (e) { return null; }
  }
  /** Mots qui montent depuis un masque : la signature du motion design typographique. */
  function words(tl, el, at, opts) {
    if (!el) return;
    var sp = split(el, 'words');
    var targets = sp && sp.words.length ? sp.words : [el];
    E(tl, targets, { yPercent: 115, rotate: (opts && opts.rot) || 0 }, { yPercent: 0, rotate: 0, stagger: P.st, duration: P.d }, at);
    var mark = el.querySelector('.hl-word');
    if (mark) E(tl, mark, { backgroundSize: '0% 30%' }, { backgroundSize: '100% 30%', duration: P.d, ease: P.inOut }, at + P.d * 0.7);
  }
  function lines(tl, el, at) {
    if (!el) return;
    var sp = split(el, 'lines');
    var targets = sp && sp.lines.length ? sp.lines : [el];
    E(tl, targets, { yPercent: 110 }, { yPercent: 0, stagger: P.st * 2, duration: P.d * 1.1 }, at);
  }
  function blurIn(tl, el, at) {
    if (!el) return;
    var sp = split(el, 'words');
    var targets = sp && sp.words.length ? sp.words : [el];
    E(tl, targets, { opacity: 0, filter: 'blur(' + (U * 1.4) + 'px)', y: U * 1.5 }, { opacity: 1, filter: 'blur(0px)', y: 0, stagger: P.st * 0.7, duration: P.d * 1.1 }, at);
  }
  function rise(tl, el, at, dist) { E(tl, el, { y: U * (dist || 4), opacity: 0 }, { y: 0, opacity: 1 }, at); }
  function pop(tl, el, at, rot) { E(tl, el, { scale: 0, rotate: rot || -25, opacity: 0 }, { scale: 1, rotate: el ? (parseFloat(getComputedStyle(el).rotate) || 0) : 0, opacity: 1, ease: P.back, duration: P.d * 0.9 }, at); }

  // ── Ajustement des textes : la plus grande taille qui tient ─────────────
  function fits(el, maxLines, size) {
    if (el.scrollWidth > el.clientWidth + 1) return false;
    var lh = parseFloat(getComputedStyle(el).lineHeight);
    if (!lh || isNaN(lh)) lh = size * 1.15;
    return Math.round(el.scrollHeight / lh) <= maxLines;
  }
  function fitOne(el) {
    var p = (el.getAttribute('data-fit') || '').split(',').map(Number);
    // En paysage la largeur ne limite plus : les titres peuvent grandir.
    var boost = HORIZONTAL ? 1.3 : 1;
    var hi = (p[0] || 10) * U * boost, lo = (p[1] || 4) * U, maxLines = p[2] || 3, best = lo;
    for (var k = 0; k < 14; k++) {
      var mid = (lo + hi) / 2;
      el.style.fontSize = mid + 'px';
      if (fits(el, maxLines, mid)) { best = mid; lo = mid; } else { hi = mid; }
    }
    el.style.fontSize = best + 'px';
  }
  /** Si une scène déborde malgré tout (beaucoup de cases remplies), on réduit l'ensemble. */
  function shrinkScene(scene) {
    var safe = scene.querySelector('.safe');
    if (!safe) return;
    var fitEls = Array.prototype.slice.call(safe.querySelectorAll('[data-fit]'));
    for (var i = 0; i < 10; i++) {
      var kids = Array.prototype.slice.call(safe.children).filter(function (k) { return k.getAttribute('data-r') !== 'flash'; });
      if (!kids.length) return;
      var top = Infinity, bottom = -Infinity;
      kids.forEach(function (k) { var r = k.getBoundingClientRect(); if (r.height) { top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom); } });
      if (bottom - top <= safe.clientHeight * 1.0 + 1) return;
      fitEls.forEach(function (el) { el.style.fontSize = (parseFloat(el.style.fontSize) * 0.9) + 'px'; });
    }
  }

  // ── Nombres qui défilent ─────────────────────────────────────────────────
  function counter(tl, el, at, dur) {
    var raw = el.getAttribute('data-count') || el.textContent;
    var m = raw.match(/^([^\d]*)([\d][\d\s.,  ]*)(.*)$/);
    if (!m) return;
    var numStr = m[2].trim();
    var decMatch = numStr.match(/[.,](\d{1,2})$/);
    var decimals = decMatch && !/[.,]\d{3}$/.test(numStr) ? decMatch[1].length : 0;
    var clean = decimals ? numStr.slice(0, -decimals - 1).replace(/[^\d]/g, '') + '.' + decMatch[1] : numStr.replace(/[^\d]/g, '');
    var target = parseFloat(clean);
    if (!isFinite(target)) return;
    var grouped = /[\s  .,]\d{3}/.test(numStr);
    var sep = decimals && numStr.indexOf(',') >= 0 ? ',' : '.';
    function fmt(v) {
      var s = v.toFixed(decimals);
      var parts = s.split('.');
      if (grouped) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return m[1] + parts.join(sep) + m[3];
    }
    var o = { v: 0 };
    el.textContent = fmt(0);
    tl.fromTo(o, { v: 0 }, { v: target, duration: dur, ease: 'power2.out', immediateRender: true, onUpdate: function () { el.textContent = fmt(o.v); } }, at);
  }

  // ── Les scènes ───────────────────────────────────────────────────────────
  var BUILD = {
    hook: function (tl, el, s) {
      var t = s.tin, flashes = qa(el, 'flash');
      if (flashes.length) {
        var per = Math.min(0.42, (s.duration * 0.55) / flashes.length);
        flashes.forEach(function (f, i) {
          var at = t + i * per;
          gsap.set(f, { autoAlpha: 0 });
          tl.set(f, { autoAlpha: 1 }, at);
          E(tl, f.firstElementChild, { scale: 1.45, opacity: 0 }, { scale: 1, opacity: 1, duration: per * 0.9, ease: 'expo.out' }, at);
          tl.set(f, { autoAlpha: 0 }, at + per);
        });
        var final = q(el, 'final'), tf = t + flashes.length * per;
        gsap.set(final, { autoAlpha: 0 });
        tl.set(final, { autoAlpha: 1 }, tf);
        words(tl, q(el, 'title'), tf);
        return;
      }
      rise(tl, q(el, 'kicker'), t, 3);
      E(tl, q(el, 'block'), { scaleX: 0 }, { scaleX: 1, duration: P.d * 1.1, ease: P.inOut }, t + 0.05);
      words(tl, q(el, 'title'), t + 0.12, { rot: s.variant === 1 ? 6 : 0 });
      E(tl, q(el, 'bar'), { scaleX: 0 }, { scaleX: 1, duration: P.d, ease: P.inOut }, t + 0.4);
    },
    statement: function (tl, el, s) {
      var t = s.tin;
      if (s.variant === 1) {
        var br = qa(el, 'bracket');
        E(tl, br[0], { x: -U * 14, opacity: 0 }, { x: 0, opacity: 1, ease: P.inOut }, t);
        E(tl, br[1], { x: U * 14, opacity: 0 }, { x: 0, opacity: 1, ease: P.inOut }, t);
        blurIn(tl, q(el, 'title'), t + 0.15);
      } else {
        lines(tl, q(el, 'title'), t);
        var path = el.querySelector('[data-r="underline"] path');
        draw(tl, path, t + 0.45);
      }
      rise(tl, q(el, 'sub'), t + 0.6, 3);
    },
    product: function (tl, el, s) {
      var t = s.tin, img = q(el, 'img'), card = q(el, 'card');
      if (q(el, 'media') && img) {
        E(tl, img, { scale: 1.2, xPercent: -2 }, { scale: 1.03, xPercent: 2, ease: 'none', duration: s.span }, s.visFrom);
        words(tl, q(el, 'name'), t + 0.1);
      } else if (card && img) {
        var r = getComputedStyle(card).borderRadius;
        E(tl, card, { clipPath: 'inset(100% 0% 0% 0% round ' + r + ')' }, { clipPath: 'inset(0% 0% 0% 0% round ' + r + ')', duration: P.d * 1.2, ease: P.inOut }, t);
        E(tl, img, { scale: 1.35 }, { scale: 1, duration: s.span, ease: 'power1.out' }, t);
        words(tl, q(el, 'name'), t + 0.35);
      } else {
        rise(tl, q(el, 'kicker'), t, 3);
        var sp = split(q(el, 'name'), 'words,chars');
        if (sp && sp.chars.length) E(tl, sp.chars, { yPercent: 120, rotate: 10 }, { yPercent: 0, rotate: 0, stagger: Math.min(P.st * 0.6, 0.6 / sp.chars.length), duration: P.d }, t + 0.1);
      }
      rise(tl, q(el, 'tagline'), t + 0.55, 3);
      pop(tl, q(el, 'price'), t + 0.8);
    },
    benefits: function (tl, el, s) {
      var t = s.tin, items = qa(el, 'item');
      words(tl, q(el, 'title'), t);
      var start = t + (q(el, 'title') ? 0.35 : 0.05);
      var per = Math.min(0.45, Math.max(0.2, (s.duration - 1.4) / Math.max(1, items.length)));
      items.forEach(function (it, i) {
        var at = start + i * per;
        if (s.variant === 1) {
          E(tl, it, { y: U * 8, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1 }, at);
        } else {
          E(tl, it, { x: -U * 6, opacity: 0 }, { x: 0, opacity: 1 }, at);
          var tick = it.querySelector('.tick');
          E(tl, tick, { scale: 0 }, { scale: 1, ease: P.back, duration: P.d * 0.8 }, at + 0.05);
          draw(tl, it.querySelector('[data-draw]'), at + 0.2, P.d * 0.7);
        }
      });
    },
    stat: function (tl, el, s) {
      var t = s.tin, value = q(el, 'value');
      E(tl, value, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, ease: P.back }, t);
      counter(tl, value, t, Math.min(1.6, s.duration * 0.5));
      draw(tl, el.querySelector('[data-r="ring"] [data-draw]'), t, Math.min(1.6, s.duration * 0.55));
      E(tl, q(el, 'line'), { scaleX: 0 }, { scaleX: 1, ease: P.inOut }, t + 0.3);
      rise(tl, q(el, 'label'), t + 0.45, 3);
    },
    offer: function (tl, el, s) {
      var t = s.tin;
      rise(tl, q(el, 'kicker'), t, 3);
      rise(tl, q(el, 'old'), t + 0.15, 2);
      E(tl, q(el, 'strike'), { scaleX: 0 }, { scaleX: 1, duration: P.d * 0.6, ease: P.inOut }, t + 0.45);
      var price = q(el, 'price');
      var sp = split(price, 'words,chars');
      if (sp && sp.chars.length) E(tl, sp.chars, { yPercent: 60, scale: 0.4, opacity: 0 }, { yPercent: 0, scale: 1, opacity: 1, ease: P.back, stagger: Math.min(0.05, 0.5 / sp.chars.length), duration: P.d * 0.8 }, t + 0.55);
      var badge = q(el, 'badge');
      if (badge) {
        E(tl, badge, { scale: 2.6, rotate: -45, opacity: 0 }, { scale: 1, rotate: -12, opacity: 1, ease: 'back.out(2)', duration: P.d * 0.7 }, t + 0.95);
        var k = Math.max(0, Math.floor((s.end - (t + 1.8)) / 0.5));
        if (k >= 2) X(tl, badge, { scale: 1 }, { scale: 1.08, duration: 0.25, ease: 'sine.inOut', repeat: k - (k % 2) - 1, yoyo: true }, t + 1.8);
      }
      var rays = q(el, 'rays'), burst = q(el, 'burst');
      if (rays) {
        E(tl, rays, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, ease: P.ease }, t);
        X(tl, rays, { rotate: 0 }, { rotate: 12 * s.span, ease: 'none', duration: s.span }, s.visFrom);
      }
      if (burst) E(tl, burst, { scale: 0, rotate: -30 }, { scale: 1, rotate: 0, ease: P.back, duration: P.d }, t + 0.1);
      rise(tl, q(el, 'note'), t + 1.1, 2);
    },
    quote: function (tl, el, s) {
      var t = s.tin;
      E(tl, q(el, 'mark'), { scale: 0, rotate: -20 }, { scale: 1, rotate: 0, ease: P.back }, t);
      blurIn(tl, q(el, 'quote'), t + 0.2);
      E(tl, q(el, 'line'), { scaleX: 0 }, { scaleX: 1, ease: P.inOut }, t + 0.9);
      E(tl, q(el, 'author'), { x: -U * 4, opacity: 0 }, { x: 0, opacity: 1 }, t + 1.05);
    },
    event: function (tl, el, s) {
      var t = s.tin;
      rise(tl, q(el, 'kicker'), t, 3);
      words(tl, q(el, 'title'), t + 0.1);
      qa(el, 'row').forEach(function (row, i) {
        var at = t + 0.55 + i * 0.28;
        E(tl, row.querySelector('.event-icon'), { rotationX: -90, transformPerspective: U * 60, opacity: 0 }, { rotationX: 0, opacity: 1, ease: P.back }, at);
        E(tl, row.querySelector('.fit'), { x: -U * 4, opacity: 0 }, { x: 0, opacity: 1 }, at + 0.08);
      });
    },
    gallery: function (tl, el, s) {
      var t = s.tin;
      qa(el, 'tile').forEach(function (tile, i) {
        var at = t + i * 0.22;
        E(tl, tile, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: P.inOut, duration: P.d * 1.1 }, at);
        E(tl, tile.querySelector('img'), { scale: 1.3 }, { scale: 1.04, ease: 'power1.out', duration: s.span }, at);
      });
      words(tl, q(el, 'caption'), t + 0.7);
    },
    wordswap: function (tl, el, s) {
      var t = s.tin, list = qa(el, 'word');
      rise(tl, q(el, 'lead'), t, 3);
      var per = Math.max(0.45, (s.duration - 0.9) / Math.max(1, list.length));
      list.forEach(function (w, i) {
        var at = t + 0.25 + i * per;
        E(tl, w, { yPercent: 110 }, { yPercent: 0, duration: P.d * 0.7, ease: P.inOut }, at);
        if (i < list.length - 1) X(tl, w, { yPercent: 0 }, { yPercent: -110, duration: P.d * 0.7, ease: P.inOut }, at + per);
      });
    },
    cta: function (tl, el, s) {
      var t = s.tin;
      words(tl, q(el, 'title'), t);
      var btn = q(el, 'button'), circle = q(el, 'circle');
      if (btn) {
        E(tl, btn, { scale: 0.6, opacity: 0, y: U * 4 }, { scale: 1, opacity: 1, y: 0, ease: P.back }, t + 0.45);
        var k = Math.floor((s.end - (t + 1.4)) / 0.4);
        if (k >= 2) X(tl, btn, { scale: 1 }, { scale: 1.06, duration: 0.2, ease: 'sine.inOut', repeat: k - (k % 2) - 1, yoyo: true }, t + 1.4);
        var arrow = btn.querySelector('.cta-arrow');
        if (k >= 2) X(tl, arrow, { x: 0 }, { x: U * 1.6, duration: 0.2, ease: 'sine.inOut', repeat: k - (k % 2) - 1, yoyo: true }, t + 1.4);
      }
      if (circle) {
        E(tl, circle, { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, ease: P.back }, t + 0.4);
        words(tl, q(el, 'action'), t + 0.55);
        var kk = Math.floor((s.end - (t + 1.4)) / 0.4);
        if (kk >= 2) X(tl, circle.firstElementChild, { x: 0 }, { x: U * 1.4, duration: 0.2, ease: 'sine.inOut', repeat: kk - (kk % 2) - 1, yoyo: true }, t + 1.4);
      }
      rise(tl, q(el, 'contact'), t + 0.85, 2);
    },
    logo: function (tl, el, s) {
      var t = s.tin;
      var reveal = q(el, 'reveal'), plate = q(el, 'plate');
      if (reveal) {
        E(tl, reveal, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: P.d * 1.2, ease: P.inOut }, t);
        E(tl, q(el, 'logo'), { scale: 1.25 }, { scale: 1, duration: P.d * 1.8, ease: P.ease }, t);
        E(tl, q(el, 'bar'), { scaleX: 0 }, { scaleX: 1, ease: P.inOut }, t + 0.45);
      }
      if (plate) {
        qa(el, 'rings').forEach(function (wrap) {
          Array.prototype.slice.call(wrap.children).forEach(function (ring, i) {
            E(tl, ring, { scale: 0.2, opacity: 0.6 }, { scale: 1.6, opacity: 0, duration: 1.6, ease: 'power1.out' }, t + i * 0.3);
          });
        });
        E(tl, plate, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, ease: P.back, duration: P.d }, t + 0.1);
      }
      rise(tl, q(el, 'tagline'), t + 0.6, 2);
    }
  };

  // ── Transitions ──────────────────────────────────────────────────────────
  function layer(cls, color) {
    var d = document.createElement('div');
    d.className = cls;
    if (color) d.style.background = color;
    stage.appendChild(d);
    return d;
  }
  function transition(tl, prev, s, i) {
    var c = s.start, d = P.tr, kind = s.transitionIn || 'fade';
    var sf = D.surfaces[s.surface] || {};
    var axis = HORIZONTAL ? 'xPercent' : 'yPercent';
    var dir = i % 2 ? -1 : 1;
    var o = {};
    if (kind === 'wipe') {
      var a = layer('tr-panel', sf.hl), b = layer('tr-panel', sf.bg);
      o = {}; o[axis] = -101 * dir; var o0 = {}; o0[axis] = 0; var o1 = {}; o1[axis] = 101 * dir;
      E(tl, a, o, assign(o0, { duration: d * 0.5, ease: P.inOut }), c - d * 0.5);
      E(tl, b, o, assign(o0, { duration: d * 0.5, ease: P.inOut }), c - d * 0.38);
      X(tl, a, o0, assign(o1, { duration: d * 0.5, ease: P.inOut }), c + 0.02);
      X(tl, b, o0, assign(o1, { duration: d * 0.5, ease: P.inOut }), c + 0.1);
    } else if (kind === 'split') {
      var axis2 = HORIZONTAL ? 'yPercent' : 'xPercent';
      var p1 = layer('tr-panel', sf.hl), p2 = layer('tr-panel', sf.hl);
      p1.style.clipPath = HORIZONTAL ? 'inset(0 0 50% 0)' : 'inset(0 50% 0 0)';
      p2.style.clipPath = HORIZONTAL ? 'inset(50% 0 0 0)' : 'inset(0 0 0 50%)';
      var f1 = {}, f2 = {}, z = {}, g1 = {}, g2 = {};
      f1[axis2] = -51; f2[axis2] = 51; z[axis2] = 0; g1[axis2] = -51; g2[axis2] = 51;
      E(tl, p1, f1, assign(z, { duration: d * 0.45, ease: P.inOut }), c - d * 0.45);
      E(tl, p2, f2, assign(z, { duration: d * 0.45, ease: P.inOut }), c - d * 0.45);
      X(tl, p1, z, assign(g1, { duration: d * 0.5, ease: P.inOut }), c + 0.04);
      X(tl, p2, z, assign(g2, { duration: d * 0.5, ease: P.inOut }), c + 0.04);
    } else if (kind === 'flash') {
      var fl = layer('tr-flash', sf.hl);
      E(tl, fl, { opacity: 0 }, { opacity: 1, duration: 0.08, ease: 'none' }, c - 0.08);
      X(tl, fl, { opacity: 1 }, { opacity: 0, duration: 0.18, ease: 'power1.out' }, c);
      E(tl, s.el, { scale: 1.08 }, { scale: 1, duration: 0.5, ease: 'expo.out' }, c);
    } else if (kind === 'circle') {
      E(tl, s.el, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: d, ease: P.inOut }, c - d * 0.5);
    } else if (kind === 'push') {
      o = {}; o[axis] = 100 * dir; var z0 = {}; z0[axis] = 0; var e1 = {}; e1[axis] = -100 * dir;
      E(tl, s.el, o, assign(z0, { duration: d, ease: P.inOut }), c - d * 0.5);
      X(tl, prev.el, z0, assign(e1, { duration: d, ease: P.inOut }), c - d * 0.5);
    } else if (kind === 'zoom') {
      // Les deux scènes restent à l'échelle ≥ 1 : aucun bord visible, on « traverse ».
      E(tl, s.el, { scale: 1.18, opacity: 0 }, { scale: 1, opacity: 1, duration: d, ease: P.inOut }, c - d * 0.5);
      X(tl, prev.el, { scale: 1, opacity: 1 }, { scale: 1.12, opacity: 0, duration: d, ease: P.inOut }, c - d * 0.5);
    } else {
      E(tl, s.el, { opacity: 0 }, { opacity: 1, duration: d, ease: 'power1.inOut' }, c - d * 0.5);
    }
  }

  // ── Construction de la ligne de temps ────────────────────────────────────
  var tl = gsap.timeline({ paused: true });

  function build() {
    var els = Array.prototype.slice.call(stage.querySelectorAll('section.scene'));
    var S = D.scenes;
    S.forEach(function (s, i) {
      s.el = els[i];
      s.end = s.start + s.duration;
      var d = P.tr;
      var kind = s.transitionIn;
      s.visFrom = i === 0 ? 0 : (COVER[kind] ? s.start : s.start - d * 0.5);
      s.tin = i === 0 ? 0.15 : s.start + (COVER[kind] ? d * 0.3 : d * 0.15);
    });
    S.forEach(function (s, i) {
      var next = S[i + 1];
      s.visTo = next ? (COVER[next.transitionIn] ? next.start : next.start + P.tr * 0.5) : D.duration + 1;
      s.span = s.visTo - s.visFrom;
    });

    S.forEach(function (s, i) {
      gsap.set(s.el, { visibility: 'hidden', zIndex: 10 + i });
      tl.set(s.el, { visibility: 'visible' }, Math.max(0, s.visFrom));
      if (S[i + 1]) tl.set(s.el, { visibility: 'hidden' }, s.visTo);
      // Poussée de caméra : le contenu respire pendant toute la scène.
      var safe = s.el.querySelector('.safe');
      if (safe) E(tl, safe, { scale: 1 }, { scale: 1.035, ease: 'none', duration: s.span }, s.visFrom);
      qa(s.el, 'decor').forEach(function (dc, k) {
        var sg = k % 2 ? -1 : 1;
        E(tl, dc, { x: 0, y: 0, rotate: 0, scale: 0.9 }, { x: sg * U * 5 * P.drift, y: U * 3 * P.drift, rotate: sg * 10 * P.drift, scale: 1, ease: 'none', duration: s.span }, s.visFrom);
      });
      if (i > 0) transition(tl, S[i - 1], s, i);
      var builder = BUILD[s.sceneId];
      if (builder) builder(tl, s.el, s);
    });

    // Marque discrète en coin, entre l'accroche et la signature finale.
    var mark = document.getElementById('brandmark');
    if (mark && S.length > 2) {
      var from = S[1].tin + 0.2, to = S[S.length - 1].start - 0.05;
      if (to - from > 1) {
        tl.set(mark, { visibility: 'visible' }, from);
        E(tl, mark, { opacity: 0, y: -U * 2 }, { opacity: 1, y: 0, duration: 0.5 }, from);
        X(tl, mark, { opacity: 1 }, { opacity: 0, duration: 0.3 }, to - 0.3);
      }
    }
    // La ligne de temps couvre toute la durée, même si la dernière animation finit avant.
    tl.set({}, {}, D.duration);
  }

  function waitImages() {
    var imgs = Array.prototype.slice.call(document.images);
    return Promise.all(imgs.map(function (img) {
      return new Promise(function (resolve) {
        function done() { resolve(); }
        function failed() {
          img.style.display = 'none';
          // Logo illisible : la signature retombe sur le nom de la marque.
          var fallback = img.parentNode && img.parentNode.querySelector('[data-r="logo-fallback"]');
          if (fallback) fallback.style.display = 'block';
          resolve();
        }
        if (img.complete) { (img.decode ? img.decode() : Promise.resolve()).then(done, failed); }
        else { img.addEventListener('load', function () { (img.decode ? img.decode() : Promise.resolve()).then(done, failed); }); img.addEventListener('error', failed); }
      });
    }));
  }
  function timeout(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /**
   * Les polices de la marque, dans TOUTES les graisses utilisées, avant la
   * première mesure : une graisse chargée en retard changerait la taille des
   * textes entre deux images (et l'ajustement serait faux).
   */
  function loadFonts() {
    var fams = D.fonts ? [D.fonts.display, D.fonts.body] : [];
    var jobs = [];
    fams.forEach(function (f) {
      if (!f) return;
      ['400', '600', '700', '800'].forEach(function (w) {
        jobs.push(document.fonts.load(w + ' 40px "' + f + '"', 'AÀaé0').catch(function () {}));
      });
    });
    return Promise.all(jobs);
  }

  var ready = (async function () {
    await Promise.race([loadFonts(), timeout(10000)]);
    await Promise.race([document.fonts.ready, timeout(8000)]);
    await Promise.race([waitImages(), timeout(15000)]);
    Array.prototype.slice.call(stage.querySelectorAll('[data-fit]')).forEach(fitOne);
    Array.prototype.slice.call(stage.querySelectorAll('section.scene')).forEach(shrinkScene);
    build();
    tl.seek(0, false);
    await Promise.race([document.fonts.ready, timeout(3000)]);
    if (D.mode === 'preview') setupPreview();
    return true;
  })();

  window.__IDEM_VIDEO__ = {
    duration: D.duration,
    ready: ready,
    seek: function (t) { tl.seek(Math.max(0, Math.min(D.duration, t)), false); },
    timeline: function () { return tl; }
  };

  // ── Aperçu : lecture en temps réel, musique synchronisée ─────────────────
  function setupPreview() {
    document.body.classList.add('preview');
    var wrap = document.createElement('div');
    wrap.className = 'pv-wrap';
    stage.parentNode.insertBefore(wrap, stage);
    wrap.appendChild(stage);
    function resize() {
      var k = Math.min(window.innerWidth / D.width, window.innerHeight / D.height);
      stage.style.transform = 'scale(' + k + ')';
      wrap.style.width = D.width * k + 'px';
      wrap.style.height = D.height * k + 'px';
    }
    resize();
    window.addEventListener('resize', resize);

    var audio = null;
    if (D.music && D.music.url) {
      audio = new Audio(D.music.url);
      audio.preload = 'auto';
    }
    var ui = document.createElement('div');
    ui.className = 'pv-ui';
    ui.innerHTML = '<button class="pv-btn" type="button" aria-label="Lecture">❚❚</button><div class="pv-bar"><div class="pv-fill"></div></div><span class="pv-time">0:00</span>';
    wrap.appendChild(ui);
    var btn = ui.querySelector('.pv-btn'), bar = ui.querySelector('.pv-bar'), fill = ui.querySelector('.pv-fill'), time = ui.querySelector('.pv-time');
    var big = document.createElement('button');
    big.className = 'pv-big';
    big.type = 'button';
    big.setAttribute('aria-label', 'Lecture');
    big.innerHTML = '<span>▶</span>';
    wrap.appendChild(big);

    var playing = false, startedAt = 0, offset = 0;
    var poster = Math.min(D.duration * 0.25, (D.scenes[0] ? D.scenes[0].start + D.scenes[0].duration * 0.8 : 1));
    tl.seek(poster, false);

    function now() { return playing ? Math.min(D.duration, offset + (performance.now() - startedAt) / 1000) : offset; }
    function syncAudio(t) {
      if (!audio) return;
      var want = (D.music.startAt || 0) + t;
      if (Math.abs(audio.currentTime - want) > 0.15) { try { audio.currentTime = want; } catch (e) {} }
      var fadeIn = Math.min(1, t / 0.5), fadeOut = Math.min(1, (D.duration - t) / 1.2);
      audio.volume = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut))) * 0.9;
    }
    function play() {
      if (offset >= D.duration - 0.05) offset = 0;
      playing = true; startedAt = performance.now();
      btn.textContent = '❚❚'; big.style.display = 'none';
      if (audio) { syncAudio(offset); audio.play().catch(function () {}); }
    }
    function pause() {
      offset = now(); playing = false; btn.textContent = '▶';
      if (audio) audio.pause();
    }
    function fmtTime(t) { var s = Math.floor(t); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    function loop() {
      var t = now();
      tl.seek(t, false);
      fill.style.width = (t / D.duration * 100) + '%';
      time.textContent = fmtTime(t);
      if (playing) {
        syncAudio(t);
        if (t >= D.duration) { offset = 0; playing = false; if (audio) audio.pause(); btn.textContent = '▶'; big.style.display = 'flex'; tl.seek(poster, false); }
      }
      requestAnimationFrame(loop);
    }
    btn.addEventListener('click', function () { playing ? pause() : play(); });
    big.addEventListener('click', function () { offset = 0; play(); });
    bar.addEventListener('click', function (e) {
      var r = bar.getBoundingClientRect();
      offset = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * D.duration;
      startedAt = performance.now();
      if (audio) syncAudio(offset);
      big.style.display = 'none';
    });
    btn.textContent = '▶';
    requestAnimationFrame(loop);
    window.addEventListener('message', function (e) {
      if (!e.data || e.data.type !== 'idem-video') return;
      if (e.data.action === 'pause' && playing) pause();
    });
  }
})();
`;
