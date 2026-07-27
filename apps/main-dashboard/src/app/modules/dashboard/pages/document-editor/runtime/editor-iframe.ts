/**
 * Construction du document HTML injecté dans l'iframe d'édition + runtime
 * d'instrumentation (plain JS, exécuté DANS l'iframe). Le document assemble
 * toutes les sections empilées, charge Tailwind + Chart.js EXACTEMENT comme le
 * PdfService (rendu identique au PDF), et installe le pont postMessage.
 *
 * Le runtime est volontairement écrit en chaîne (pas de dépendance Angular) car
 * il tourne dans un contexte isolé. Les chemins d'éléments ("0.2.1") sont
 * calculés en index d'ENFANTS-ÉLÉMENTS, à l'identique côté hôte (DOMParser),
 * garantissant la localisation déterministe des nœuds.
 */

import { EditableSection, PageFormat, RenderContext } from '../models/editor.types';

/** Échappe le contenu destiné à un attribut HTML. */
function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Business plan (multi-page) uniquement : sur le CONTENEUR RACINE seul, remplace
 * la hauteur fixe par min-h et enlève overflow-hidden pour laisser le contenu
 * s'étendre (parité avec le PDF). Ne modifie que les classes de la racine : la
 * structure — donc les chemins d'édition — reste inchangée.
 */
function normalizeRootForFlow(html: string): string {
  return html.replace(
    /(<[a-zA-Z][^>]*\bclass=")([^"]*)(")/,
    (_m, pre: string, cls: string, post: string) => {
      const fixed = cls
        .replace(/\bh-\[(\d+(?:\.\d+)?)(mm|cm|in)\]/g, 'min-h-[$1$2]')
        .replace(/\boverflow-hidden\b/g, 'overflow-visible');
      return pre + fixed + post;
    },
  );
}

/**
 * Snippet exécuté dans le <head>, APRÈS le chargement de chart.js et AVANT les
 * scripts de section : il enveloppe `window.Chart` pour capturer chaque
 * instance par canvas (édition ultérieure) et force `animation:false`.
 */
const CHART_CAPTURE_SNIPPET = `
(function () {
  if (!window.Chart) return;
  window.__idemCharts = new Map();
  var Real = window.Chart;
  function Wrapped(item, config) {
    try {
      config = config || {};
      config.options = config.options || {};
      config.options.animation = false;
      config.options.responsive = true;
      config.options.maintainAspectRatio = false;
    } catch (e) {}
    var inst = new Real(item, config);
    try {
      var canvas = inst.canvas || (item && item.canvas) || item;
      if (canvas) window.__idemCharts.set(canvas, inst);
    } catch (e) {}
    return inst;
  }
  Wrapped.prototype = Real.prototype;
  Object.keys(Real).forEach(function (k) { try { Wrapped[k] = Real[k]; } catch (e) {} });
  window.__idemRealChart = Real;
  window.Chart = Wrapped;
})();
`;

/** Runtime d'interaction (sélection, édition texte, réordonnancement, charts). */
const INTERACTION_RUNTIME = `
(function () {
  var SRC = 'idem-editor';
  var HOST = 'idem-editor-host';
  var INLINE = { B:1,I:1,STRONG:1,EM:1,SPAN:1,A:1,BR:1,SMALL:1,SUB:1,SUP:1,MARK:1,U:1,CODE:1 };

  var selectedEl = null;
  var editingEl = null;

  // Couches d'overlay (survol + sélection + poignée de déplacement).
  var layer = document.createElement('div');
  layer.setAttribute('data-idem-ui', '');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2147483000;';
  var hoverBox = mkBox('rgba(20,71,230,0.35)', 'transparent');
  var selBox = mkBox('#1447e6', 'rgba(20,71,230,0.06)');
  selBox.style.pointerEvents = 'none';
  layer.appendChild(hoverBox);
  layer.appendChild(selBox);
  document.body.appendChild(layer);

  function mkBox(border, bg) {
    var b = document.createElement('div');
    b.style.cssText = 'position:absolute;display:none;border:2px solid ' + border + ';background:' + bg + ';border-radius:3px;box-sizing:border-box;transition:all .08s ease;';
    return b;
  }

  function post(msg) { msg.source = SRC; parent.postMessage(msg, '*'); }

  function sectionOf(el) {
    var s = el;
    while (s && s !== document.body) {
      if (s.hasAttribute && s.hasAttribute('data-section-id')) return s;
      s = s.parentElement;
    }
    return null;
  }

  // Chemin d'index d'enfants-éléments relatif au conteneur de section.
  function pathOf(el, sectionEl) {
    var parts = [];
    var node = el;
    while (node && node !== sectionEl) {
      var parent = node.parentElement;
      if (!parent) break;
      var idx = Array.prototype.indexOf.call(parent.children, node);
      parts.unshift(idx);
      node = parent;
    }
    return parts.join('.');
  }

  function nodeAt(sectionEl, path) {
    if (path === '') return sectionEl;
    var node = sectionEl;
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (!node) return null;
      node = node.children[parseInt(parts[i], 10)];
    }
    return node || null;
  }

  function isTextLeaf(el) {
    if (el.tagName === 'CANVAS' || el.tagName === 'IMG' || el.tagName === 'SVG') return false;
    var kids = el.children;
    for (var i = 0; i < kids.length; i++) {
      if (!INLINE[kids[i].tagName]) return false;
    }
    return (el.textContent || '').trim().length > 0;
  }

  function chartCanvasIn(el) {
    if (el.tagName === 'CANVAS') return el;
    var c = el.querySelector && el.querySelector('canvas');
    return c || null;
  }

  function readStyle(el) {
    var cs = getComputedStyle(el);
    var inline = el.style;
    return {
      color: inline.color || cs.color,
      backgroundColor: inline.backgroundColor || (cs.backgroundColor === 'rgba(0, 0, 0, 0)' ? '' : cs.backgroundColor),
      fontSize: inline.fontSize || cs.fontSize,
      fontWeight: inline.fontWeight || cs.fontWeight,
      textAlign: inline.textAlign || cs.textAlign,
      opacity: inline.opacity || cs.opacity
    };
  }

  function chartLite(canvas) {
    try {
      var inst = window.__idemCharts && window.__idemCharts.get(canvas);
      if (!inst) return null;
      var cfg = inst.config || {};
      var data = cfg.data || {};
      var opts = cfg.options || {};
      var plugins = opts.plugins || {};
      return {
        type: cfg.type || (cfg._config && cfg._config.type) || 'bar',
        labels: (data.labels || []).map(String),
        datasets: (data.datasets || []).map(function (d) {
          return {
            label: d.label || '',
            data: (d.data || []).map(function (v) { return typeof v === 'number' ? v : parseFloat(v) || 0; }),
            backgroundColor: d.backgroundColor,
            borderColor: d.borderColor
          };
        }),
        title: (plugins.title && plugins.title.text) || '',
        legend: !(plugins.legend && plugins.legend.display === false)
      };
    } catch (e) { return null; }
  }

  function place(box, el) {
    var r = el.getBoundingClientRect();
    box.style.left = (r.left + window.scrollX) + 'px';
    box.style.top = (r.top + window.scrollY) + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    box.style.display = 'block';
  }

  function reposition() {
    if (selectedEl && document.contains(selectedEl)) place(selBox, selectedEl);
    else selBox.style.display = 'none';
  }

  function readAttributes(el) {
    var attrs = [];
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name === 'contenteditable') continue;
      attrs.push({ name: a.name, value: a.value });
    }
    return attrs;
  }

  function buildSelection(el, sectionEl) {
    var canvas = chartCanvasIn(el);
    return {
      sectionId: sectionEl.getAttribute('data-section-id'),
      path: pathOf(el, sectionEl),
      tag: el.tagName.toLowerCase(),
      isTextLeaf: isTextLeaf(el),
      isChart: !!canvas,
      index: Array.prototype.indexOf.call(el.parentElement.children, el),
      siblingCount: el.parentElement.children.length,
      textContent: (el.textContent || '').trim().slice(0, 400),
      style: readStyle(el),
      attributes: readAttributes(el),
      chart: canvas ? chartLite(canvas) : undefined
    };
  }

  function select(el, notify) {
    if (editingEl && editingEl !== el) commitEdit();
    selectedEl = el;
    place(selBox, el);
    hoverBox.style.display = 'none';
    if (notify === false) return;
    var sectionEl = sectionOf(el);
    if (!sectionEl) return;
    post({ type: 'select', selection: buildSelection(el, sectionEl) });
  }

  function clearSelection() {
    if (editingEl) commitEdit();
    selectedEl = null;
    selBox.style.display = 'none';
    post({ type: 'deselect' });
  }

  /* ----- Édition de texte au double-clic ----- */
  function startEdit(el) {
    editingEl = el;
    el.setAttribute('contenteditable', 'true');
    el.classList.add('idem-editing');
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function commitEdit() {
    if (!editingEl) return;
    var el = editingEl;
    editingEl = null;
    el.removeAttribute('contenteditable');
    el.classList.remove('idem-editing');
    var sectionEl = sectionOf(el);
    if (!sectionEl) return;
    post({ type: 'text-change', sectionId: sectionEl.getAttribute('data-section-id'), path: pathOf(el, sectionEl), html: el.innerHTML });
    place(selBox, el);
  }

  /* ----- Glisser-déposer LIVE (façon Figma) parmi les frères ----- */
  var drag = null;
  var justDragged = false;
  var indicator = document.createElement('div');
  indicator.setAttribute('data-idem-ui', '');
  indicator.style.cssText = 'position:absolute;height:3px;background:#1447e6;border-radius:3px;display:none;z-index:2147483001;box-shadow:0 0 8px rgba(20,71,230,.9);pointer-events:none;';
  layer.appendChild(indicator);

  function beginDrag(el, e) {
    var parent = el.parentElement;
    if (!parent) return;
    drag = {
      el: el, parent: parent,
      from: Array.prototype.indexOf.call(parent.children, el),
      to: -1, started: false,
      startX: e.clientX, startY: e.clientY, ghost: null
    };
    window.addEventListener('pointermove', onDragMove, true);
    window.addEventListener('pointerup', onDragUp, true);
  }

  function startDragVisual(e) {
    drag.started = true;
    var r = drag.el.getBoundingClientRect();
    var ghost = drag.el.cloneNode(true);
    ghost.setAttribute('data-idem-ui', '');
    ghost.style.cssText += ';position:fixed;margin:0;left:' + (e.clientX - 12) + 'px;top:' + (e.clientY - 12) + 'px;width:' + r.width + 'px;height:' + r.height + 'px;pointer-events:none;opacity:.92;z-index:2147483003;box-shadow:0 16px 40px rgba(0,0,0,.4);transform:scale(.5);transform-origin:top left;background:#fff;border-radius:4px;overflow:hidden;';
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    drag.el.style.outline = '2px dashed rgba(20,71,230,.5)';
    drag.el.style.opacity = '0.35';
    hoverBox.style.display = 'none';
    selBox.style.display = 'none';
    handle.style.display = 'none';
    document.body.style.cursor = 'grabbing';
  }

  function onDragMove(e) {
    if (!drag) return;
    if (!drag.started) {
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) < 5) return;
      startDragVisual(e);
    }
    drag.ghost.style.left = (e.clientX - 12) + 'px';
    drag.ghost.style.top = (e.clientY - 12) + 'px';
    var kids = drag.parent.children;
    var y = e.clientY;
    var to = kids.length;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] === drag.el || kids[i].hasAttribute('data-idem-ui')) continue;
      var r = kids[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { to = i; break; }
    }
    drag.to = to;
    var refRect, top;
    if (to >= kids.length) { refRect = kids[kids.length - 1].getBoundingClientRect(); top = refRect.bottom; }
    else { refRect = kids[to].getBoundingClientRect(); top = refRect.top; }
    indicator.style.top = (top + window.scrollY - 1) + 'px';
    indicator.style.left = (refRect.left + window.scrollX) + 'px';
    indicator.style.width = refRect.width + 'px';
    indicator.style.display = 'block';
  }

  function onDragUp() {
    window.removeEventListener('pointermove', onDragMove, true);
    window.removeEventListener('pointerup', onDragUp, true);
    indicator.style.display = 'none';
    document.body.style.cursor = '';
    if (!drag) return;
    var d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    d.el.style.opacity = '';
    d.el.style.outline = '';
    if (!d.started) return; // simple clic, pas un glissement
    justDragged = true;
    setTimeout(function () { justDragged = false; }, 0);
    var toIndex = d.to > d.from ? d.to - 1 : d.to;
    if (d.to < 0 || toIndex === d.from) { select(d.el, true); return; }
    // Déplacement LIVE dans le DOM (aucun rechargement de l'iframe).
    d.parent.removeChild(d.el);
    var ref = d.parent.children[toIndex] || null;
    d.parent.insertBefore(d.el, ref);
    var sectionEl = sectionOf(d.parent);
    post({ type: 'reorder', sectionId: sectionEl.getAttribute('data-section-id'), parentPath: pathOf(d.parent, sectionEl), fromIndex: d.from, toIndex: toIndex });
    select(d.el, true);
  }

  // Démarrage d'un glissement en pressant l'élément déjà sélectionné (seuil de 5px).
  document.addEventListener('pointerdown', function (e) {
    if (editingEl || drag) return;
    if (e.target.closest && e.target.closest('[data-idem-ui]')) return;
    if (selectedEl && e.target === selectedEl && sectionOf(selectedEl)) beginDrag(selectedEl, e);
  }, true);

  /* ----- Événements globaux ----- */
  document.addEventListener('mousemove', function (e) {
    if (drag || editingEl) return;
    var el = e.target;
    if (!el || el === document.body || el.hasAttribute('data-idem-ui') || el.closest('[data-idem-ui]')) { hoverBox.style.display = 'none'; return; }
    if (!sectionOf(el)) { hoverBox.style.display = 'none'; return; }
    if (el === selectedEl) { hoverBox.style.display = 'none'; return; }
    place(hoverBox, el);
  }, true);

  document.addEventListener('click', function (e) {
    if (justDragged) { justDragged = false; e.preventDefault(); e.stopPropagation(); return; }
    var el = e.target;
    if (el.closest && el.closest('[data-idem-ui]')) return;
    if (editingEl && el === editingEl) return;
    if (!sectionOf(el)) { clearSelection(); return; }
    e.preventDefault();
    e.stopPropagation();
    select(el, true);
  }, true);

  document.addEventListener('dblclick', function (e) {
    var el = e.target;
    if (!sectionOf(el) || !isTextLeaf(el)) return;
    e.preventDefault();
    e.stopPropagation();
    select(el, true);
    startEdit(el);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!editingEl) return;
    if (e.key === 'Escape') { e.preventDefault(); commitEdit(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
  }, true);

  document.addEventListener('focusout', function (e) {
    if (editingEl && e.target === editingEl) commitEdit();
  }, true);

  window.addEventListener('resize', reposition, true);
  window.addEventListener('scroll', reposition, true);

  /* ----- Messages de l'hôte -> iframe ----- */
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.source !== HOST) return;
    if (m.type === 'clear-selection') { selectedEl = null; selBox.style.display = 'none'; return; }
    if (m.type === 'set-theme') { document.documentElement.classList.toggle('dark', !!m.dark); return; }
    var sectionEl = m.sectionId ? document.querySelector('[data-section-id="' + cssEscape(m.sectionId) + '"]') : null;
    if (!sectionEl) return;
    var node = nodeAt(sectionEl, m.path);
    if (!node) return;
    if (m.type === 'apply-style') {
      applyStyle(node, m.style);
      if (node === selectedEl) place(selBox, node);
    } else if (m.type === 'apply-chart') {
      applyChart(node, m.config);
    } else if (m.type === 'apply-attr') {
      if (m.value === null || m.value === undefined) node.removeAttribute(m.name);
      else node.setAttribute(m.name, m.value);
      if (node === selectedEl) {
        place(selBox, node);
        post({ type: 'select', selection: buildSelection(node, sectionEl) });
      }
    } else if (m.type === 'move-node') {
      var parent = node.parentElement;
      if (parent) {
        parent.removeChild(node);
        var ref = parent.children[m.toIndex] || null;
        parent.insertBefore(node, ref);
        select(node, true);
      }
    } else if (m.type === 'remove-node') {
      if (node === selectedEl) { selectedEl = null; selBox.style.display = 'none'; handle.style.display = 'none'; }
      node.remove();
      post({ type: 'deselect' });
    } else if (m.type === 'select-path') {
      select(node, false);
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      post({ type: 'select', selection: buildSelection(node, sectionEl) });
    }
  });

  function cssEscape(s) { return String(s).replace(/["\\\\]/g, '\\\\$&'); }

  function applyStyle(el, style) {
    Object.keys(style).forEach(function (k) {
      var v = style[k];
      var prop = k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
      if (v === '' || v == null) el.style.removeProperty(prop);
      else el.style.setProperty(prop, v);
    });
  }

  function applyChart(el, lite) {
    var canvas = chartCanvasIn(el);
    if (!canvas) return;
    var Real = window.__idemRealChart || window.Chart;
    var old = window.__idemCharts.get(canvas);
    var baseOptions = (old && old.config && old.config.options) || {};
    if (old) old.destroy();
    var cfg = {
      type: lite.type,
      data: {
        labels: lite.labels,
        datasets: lite.datasets.map(function (d) { return { label: d.label, data: d.data, backgroundColor: d.backgroundColor, borderColor: d.borderColor }; })
      },
      options: Object.assign({}, baseOptions, {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: Object.assign({}, baseOptions.plugins || {}, {
          title: { display: !!lite.title, text: lite.title || '' },
          legend: { display: lite.legend !== false }
        })
      })
    };
    var inst = new Real(canvas, cfg);
    window.__idemCharts.set(canvas, inst);
  }

  /* ----- Poignée de déplacement (bouton flottant sur la sélection) ----- */
  var handle = document.createElement('button');
  handle.setAttribute('data-idem-ui', '');
  handle.setAttribute('aria-hidden', 'true');
  handle.style.cssText = 'position:absolute;display:none;width:22px;height:22px;border:none;border-radius:6px;background:#1447e6;color:#fff;cursor:grab;pointer-events:auto;z-index:2147483002;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:12px;line-height:22px;text-align:center;';
  handle.textContent = '\\u2195';
  handle.title = 'Glisser pour déplacer';
  layer.appendChild(handle);
  handle.addEventListener('pointerdown', function (e) {
    if (!selectedEl) return;
    e.preventDefault();
    e.stopPropagation();
    beginDrag(selectedEl, e);
  });

  var _place = place;
  place = function (box, el) {
    _place(box, el);
    if (box === selBox) {
      var r = el.getBoundingClientRect();
      handle.style.left = (r.left + window.scrollX - 11) + 'px';
      handle.style.top = (r.top + window.scrollY - 11) + 'px';
      handle.style.display = 'block';
    }
  };
  var _repos = reposition;
  reposition = function () { _repos(); if (!selectedEl) handle.style.display = 'none'; };

  /* ----- Hauteur du document (auto-resize de l'iframe) ----- */
  var lastH = 0;
  function reportHeight() {
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    if (Math.abs(h - lastH) > 1) { lastH = h; post({ type: 'height', height: h }); }
  }
  if (window.ResizeObserver) { new ResizeObserver(reportHeight).observe(document.body); }
  window.addEventListener('load', reportHeight);
  setTimeout(reportHeight, 300);
  setTimeout(reportHeight, 1200);

  post({ type: 'ready' });
})();
`;

/** Styles de page (calage mm) + affordances d'édition. */
function pageStyles(format: PageFormat, multiPage: boolean): string {
  // multiPage (business plan) : la page grandit avec le contenu (min-height,
  // overflow visible). Sinon (pitch/charte) : page fixe rognée comme le PDF.
  const sectionSizing = multiPage
    ? `min-height: ${format.height}; overflow: visible;`
    : `height: ${format.height}; overflow: hidden;`;
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: transparent; }
    .idem-doc { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; }
    .idem-section {
      width: ${format.width};
      ${sectionSizing}
      background: #ffffff;
      position: relative;
      box-shadow: 0 8px 30px rgba(0,0,0,0.18);
      border-radius: 2px;
    }
    [data-section-id] * { cursor: default; }
    .idem-editing { outline: 2px solid #1447e6 !important; outline-offset: 2px; cursor: text !important; }
    h1,h2,h3,h4,h5,h6 { font-family: var(--idem-primary-font, inherit); }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  `;
}

/** Assemble le document complet injecté via srcdoc. */
export function buildIframeDocument(
  sections: EditableSection[],
  ctx: RenderContext,
  format: PageFormat,
  multiPage = false,
): string {
  const primary = ctx.primaryFont || 'Jura';
  const secondary = ctx.secondaryFont || 'Jura';
  // Multi-page (BP) : conteneur racine passé en flux (min-h + overflow visible),
  // sans toucher aux classes internes. Sinon (pitch/charte) : HTML tel quel.
  const sectionsHtml = sections
    .map((s, i) => {
      const inner = multiPage ? normalizeRootForFlow(s.html) : s.html;
      return `<section class="idem-section" data-section-id="${attr(s.id)}" data-section-index="${i}">${inner}</section>`;
    })
    .join('');

  return `<!doctype html>
<html class="${ctx.dark ? 'dark' : ''}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="/scripts/tailwind.js"></script>
<script src="/scripts/chart.js"></script>
${CHART_CAPTURE_SNIPPET ? `<script>${CHART_CAPTURE_SNIPPET}</script>` : ''}
${ctx.fontUrl ? `<link href="${attr(ctx.fontUrl)}" rel="stylesheet" />` : ''}
<script>
  if (window.tailwind) {
    window.tailwind.config = {
      theme: { extend: { fontFamily: {
        primary: ['${primary}', 'sans-serif'],
        secondary: ['${secondary}', 'sans-serif'],
        sans: ['${secondary}', 'system-ui', 'sans-serif']
      } } },
      corePlugins: { preflight: false }
    };
  }
</script>
<style>
  body { font-family: '${secondary}', system-ui, sans-serif; --idem-primary-font: '${primary}'; }
  ${pageStyles(format, multiPage)}
</style>
</head>
<body>
<div class="idem-doc">${sectionsHtml}</div>
<script>${INTERACTION_RUNTIME}</script>
</body>
</html>`;
}
