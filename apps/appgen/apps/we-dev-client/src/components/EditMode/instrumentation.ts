/**
 * Instrumentation du projet généré pour le mode Edit.
 *
 * À l'entrée du mode Edit on écrit un plugin Vite dans le projet et on l'ajoute
 * au tableau `plugins` du vite.config. Ce plugin :
 *   1. ajoute un attribut `data-idem-id="<cheminRelatif>|<offsetJSX>"` sur chaque
 *      balise ouvrante JSX (transform `enforce: 'pre'`, avant @vitejs/plugin-react) ;
 *   2. injecte l'agent d'édition en inline dans index.html (transformIndexHtml).
 *
 * À la sortie du mode Edit on retire l'import + l'appel du plugin et on supprime
 * le fichier — le code du projet redevient identique à l'original.
 *
 * Vite surveille son fichier de config : toute modif déclenche un redémarrage du
 * serveur dans le WebContainer, donc l'iframe se recharge instrumentée / propre.
 */
import { parse } from '@babel/parser';
import traverseDefault from '@babel/traverse';

const traverse = ((traverseDefault as unknown as { default?: typeof traverseDefault })
  .default || traverseDefault) as typeof traverseDefault;

export const PLUGIN_PATH = '.idem/vite-plugin-idem.js';
const IMPORT_LINE = `import { idemEditPlugin } from './.idem/vite-plugin-idem.js';`;
const VITE_CONFIG_NAMES = [
  'vite.config.js',
  'vite.config.ts',
  'vite.config.mjs',
  'vite.config.mts',
  'vite.config.cjs',
];

export interface InstrumentationPlan {
  ok: boolean;
  writes: Record<string, string>;
  deletes: string[];
  reason?: string;
}

export function findViteConfigPath(files: Record<string, string>): string | null {
  return VITE_CONFIG_NAMES.find((name) => name in files) ?? null;
}

/* ------------------------------------------------------------------ */
/* Agent injecté dans l'iframe (JS pur — sans backtick ni ${} pour     */
/* rester simple à transporter). Communique via postMessage.           */
/* ------------------------------------------------------------------ */

export const AGENT_SOURCE = [
  '(function(){',
  '  if (window.__IDEM_AGENT__) return; window.__IDEM_AGENT__ = true;',
  '  var SOURCE = "idem-edit";',
  '  var ATTR = "data-idem-id";',
  '  var enabled = false, editing = false, selectedEl = null;',
  '  var hoverBox = null, selBox = null, dropLine = null;',
  '  var drag = null;',
  '',
  '  function post(msg){ msg.source = SOURCE; window.parent.postMessage(msg, "*"); }',
  '',
  '  function mkBox(color){',
  '    var b = document.createElement("div");',
  '    b.style.position = "absolute"; b.style.pointerEvents = "none";',
  '    b.style.zIndex = "2147483646"; b.style.border = "2px solid " + color;',
  '    b.style.borderRadius = "2px"; b.style.transition = "all .05s ease";',
  '    b.style.display = "none"; document.body.appendChild(b); return b;',
  '  }',
  '  function ensureBoxes(){',
  '    if (!hoverBox) hoverBox = mkBox("rgba(109,40,217,.5)");',
  '    if (!selBox) selBox = mkBox("#6D28D9");',
  '    if (!dropLine){',
  '      dropLine = document.createElement("div");',
  '      dropLine.style.position = "absolute"; dropLine.style.pointerEvents = "none";',
  '      dropLine.style.zIndex = "2147483647"; dropLine.style.background = "#6D28D9";',
  '      dropLine.style.display = "none"; dropLine.style.borderRadius = "2px";',
  '      document.body.appendChild(dropLine);',
  '    }',
  '  }',
  '  function place(box, el){',
  '    if (!el){ box.style.display = "none"; return; }',
  '    var r = el.getBoundingClientRect();',
  '    box.style.display = "block";',
  '    box.style.top = (r.top + window.scrollY) + "px";',
  '    box.style.left = (r.left + window.scrollX) + "px";',
  '    box.style.width = r.width + "px"; box.style.height = r.height + "px";',
  '  }',
  '',
  '  function isTextEditable(el){',
  '    var tag = el.tagName.toLowerCase();',
  '    if (["img","input","textarea","select","svg","br","hr","video","canvas"].indexOf(tag) !== -1) return false;',
  '    for (var i=0;i<el.childNodes.length;i++){ if (el.childNodes[i].nodeType === 1) return false; }',
  '    return el.textContent != null && el.textContent.trim().length >= 0;',
  '  }',
  '',
  '  function info(el){',
  '    var r = el.getBoundingClientRect();',
  '    var cs = window.getComputedStyle(el);',
  '    var tag = el.tagName.toLowerCase();',
  '    return {',
  '      id: el.getAttribute(ATTR), tag: tag,',
  '      textEditable: isTextEditable(el),',
  '      text: (el.textContent || ""),',
  '      src: tag === "img" ? (el.getAttribute("src") || "") : undefined,',
  '      className: (typeof el.className === "string" ? el.className : ""),',
  '      computed: {',
  '        color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight,',
  '        textAlign: cs.textAlign, backgroundColor: cs.backgroundColor',
  '      },',
  '      rect: { top: r.top, left: r.left, width: r.width, height: r.height }',
  '    };',
  '  }',
  '',
  '  function target(e){',
  '    var el = e.target;',
  '    if (!el || !el.closest) return null;',
  '    return el.closest("[" + ATTR + "]");',
  '  }',
  '',
  '  function select(el){',
  '    selectedEl = el;',
  '    place(selBox, el);',
  '    post({ type: "SELECTED", element: el ? info(el) : null });',
  '  }',
  '',
  '  function reposition(){ if (selectedEl) place(selBox, selectedEl); }',
  '',
  '  /* ---- reorder helpers ---- */',
  '  function siblings(el){',
  '    var out = [];',
  '    var p = el.parentNode; if (!p) return out;',
  '    for (var i=0;i<p.children.length;i++){',
  '      var c = p.children[i];',
  '      if (c.getAttribute && c.getAttribute(ATTR)) out.push(c);',
  '    }',
  '    return out;',
  '  }',
  '  function isHorizontal(sibs){',
  '    if (sibs.length < 2) return false;',
  '    var a = sibs[0].getBoundingClientRect(), b = sibs[1].getBoundingClientRect();',
  '    return Math.abs(b.left - a.left) > Math.abs(b.top - a.top);',
  '  }',
  '  function dropTarget(sibs, x, y, moved){',
  '    var horiz = isHorizontal(sibs);',
  '    for (var i=0;i<sibs.length;i++){',
  '      if (sibs[i] === moved) continue;',
  '      var r = sibs[i].getBoundingClientRect();',
  '      var mid = horiz ? (r.left + r.width/2) : (r.top + r.height/2);',
  '      var pos = horiz ? x : y;',
  '      if (pos < mid) return sibs[i];',
  '    }',
  '    return null;',
  '  }',
  '  function showDrop(before, sibs){',
  '    ensureBoxes();',
  '    var horiz = isHorizontal(sibs);',
  '    var ref = before || (sibs.length ? sibs[sibs.length-1] : null);',
  '    if (!ref){ dropLine.style.display = "none"; return; }',
  '    var r = ref.getBoundingClientRect();',
  '    dropLine.style.display = "block";',
  '    if (horiz){',
  '      var lx = before ? r.left : r.right;',
  '      dropLine.style.left = (lx + window.scrollX - 1) + "px";',
  '      dropLine.style.top = (r.top + window.scrollY) + "px";',
  '      dropLine.style.width = "3px"; dropLine.style.height = r.height + "px";',
  '    } else {',
  '      var ly = before ? r.top : r.bottom;',
  '      dropLine.style.top = (ly + window.scrollY - 1) + "px";',
  '      dropLine.style.left = (r.left + window.scrollX) + "px";',
  '      dropLine.style.height = "3px"; dropLine.style.width = r.width + "px";',
  '    }',
  '  }',
  '',
  '  /* ---- event handlers (capture phase) ---- */',
  '  function onMove(e){',
  '    if (!enabled) return;',
  '    if (drag){',
  '      var sibs = drag.sibs;',
  '      var before = dropTarget(sibs, e.clientX, e.clientY, drag.el);',
  '      drag.before = before;',
  '      showDrop(before, sibs);',
  '      return;',
  '    }',
  '    if (editing) return;',
  '    var el = target(e);',
  '    if (el && el !== selectedEl) place(hoverBox, el); else hoverBox.style.display = "none";',
  '  }',
  '  function onDown(e){',
  '    if (!enabled || editing) return;',
  '    var el = target(e); if (!el) return;',
  '    var sibs = siblings(el);',
  '    drag = { el: el, sibs: sibs, before: null, x: e.clientX, y: e.clientY, moved: false };',
  '  }',
  '  function onMoveDrag(e){',
  '    if (!drag) return;',
  '    if (!drag.moved && (Math.abs(e.clientX-drag.x) > 5 || Math.abs(e.clientY-drag.y) > 5)){',
  '      drag.moved = true; hoverBox.style.display = "none";',
  '    }',
  '  }',
  '  function onUp(e){',
  '    if (!drag){ return; }',
  '    var d = drag; drag = null; dropLine.style.display = "none";',
  '    if (!d.moved) { return; }',
  '    e.preventDefault(); e.stopPropagation();',
  '    var beforeId = d.before ? d.before.getAttribute(ATTR) : null;',
  '    var movedId = d.el.getAttribute(ATTR);',
  '    if (beforeId === movedId) return;',
  '    post({ type: "REORDER", id: movedId, beforeId: beforeId });',
  '  }',
  '  function onClick(e){',
  '    if (!enabled || editing) return;',
  '    var el = target(e);',
  '    e.preventDefault(); e.stopPropagation();',
  '    hoverBox.style.display = "none";',
  '    select(el);',
  '  }',
  '  function onDblClick(e){',
  '    if (!enabled) return;',
  '    var el = target(e); if (!el) return;',
  '    e.preventDefault(); e.stopPropagation();',
  '    var tag = el.tagName.toLowerCase();',
  '    if (tag === "img"){ post({ type: "REQUEST_IMAGE", id: el.getAttribute(ATTR) }); return; }',
  '    if (!isTextEditable(el)) return;',
  '    editing = true; selectedEl = el;',
  '    el.setAttribute("contenteditable", "true");',
  '    el.focus();',
  '    var range = document.createRange(); range.selectNodeContents(el);',
  '    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);',
  '    var finish = function(){',
  '      el.removeAttribute("contenteditable");',
  '      el.removeEventListener("blur", finish);',
  '      el.removeEventListener("keydown", onKey);',
  '      editing = false;',
  '      post({ type: "TEXT_EDIT", id: el.getAttribute(ATTR), text: el.innerText });',
  '      place(selBox, el);',
  '    };',
  '    var onKey = function(ev){',
  '      if (ev.key === "Enter" && !ev.shiftKey){ ev.preventDefault(); el.blur(); }',
  '      if (ev.key === "Escape"){ ev.preventDefault(); el.blur(); }',
  '      ev.stopPropagation();',
  '    };',
  '    el.addEventListener("blur", finish);',
  '    el.addEventListener("keydown", onKey);',
  '  }',
  '',
  '  function setEnabled(v){',
  '    enabled = v; ensureBoxes();',
  '    document.body.style.cursor = v ? "default" : "";',
  '    if (!v){',
  '      hoverBox.style.display = "none"; selBox.style.display = "none";',
  '      dropLine.style.display = "none"; selectedEl = null; editing = false; drag = null;',
  '    }',
  '  }',
  '',
  '  window.addEventListener("message", function(e){',
  '    var d = e.data; if (!d || d.source !== SOURCE) return;',
  '    if (d.type === "ENABLE_EDIT") setEnabled(!!d.enabled);',
  '    else if (d.type === "SET_SELECTION"){',
  '      if (!d.id){ select(null); return; }',
  '      var el = document.querySelector("[" + ATTR + "=" + JSON.stringify(d.id) + "]");',
  '      if (el) select(el);',
  '    }',
  '  });',
  '',
  '  document.addEventListener("mousemove", onMove, true);',
  '  document.addEventListener("mousemove", onMoveDrag, true);',
  '  document.addEventListener("mousedown", onDown, true);',
  '  document.addEventListener("mouseup", onUp, true);',
  '  document.addEventListener("click", onClick, true);',
  '  document.addEventListener("dblclick", onDblClick, true);',
  '  window.addEventListener("scroll", reposition, true);',
  '  window.addEventListener("resize", reposition, true);',
  '',
  '  post({ type: "AGENT_READY" });',
  '})();',
].join('\n');

/* ------------------------------------------------------------------ */
/* Source du plugin Vite (écrit dans le projet).                        */
/* Corps en concaténation de chaînes pour éviter les template literals. */
/* ------------------------------------------------------------------ */

export function buildVitePluginSource(): string {
  return `import path from 'path';
import babel from '@babel/core';

const AGENT = ${JSON.stringify(AGENT_SOURCE)};

let idemRoot = process.cwd();

function walk(node, visit){
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)){ for (var i=0;i<node.length;i++) walk(node[i], visit); return; }
  if (typeof node.type === 'string') visit(node);
  for (var k in node){
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'range' || k === 'leadingComments' || k === 'trailingComments') continue;
    var v = node[k];
    if (v && typeof v === 'object') walk(v, visit);
  }
}

export function idemEditPlugin(){
  return {
    name: 'idem-edit',
    enforce: 'pre',
    configResolved: function(c){ idemRoot = c.root; },
    transform: function(code, id){
      var clean = id.split('?')[0];
      if (clean.charCodeAt(0) === 0) return null;
      if (clean.indexOf('node_modules') !== -1) return null;
      if (!/\\.(t|j)sx$/.test(clean)) return null;
      var rel = path.relative(idemRoot, clean).split(path.sep).join('/');
      var ast;
      try {
        ast = babel.parseSync(code, {
          configFile: false, babelrc: false, filename: clean,
          parserOpts: { plugins: ['jsx', 'typescript'], errorRecovery: true }
        });
      } catch (e){ return null; }
      var inserts = [];
      walk(ast, function(node){
        if (node.type === 'JSXOpeningElement' && typeof node.start === 'number'){
          var nameNode = node.name;
          var pos = (nameNode && typeof nameNode.end === 'number') ? nameNode.end : (node.start + 1);
          inserts.push({ pos: pos, id: rel + '|' + node.start });
        }
      });
      if (!inserts.length) return null;
      inserts.sort(function(a,b){ return b.pos - a.pos; });
      var out = code;
      for (var i=0;i<inserts.length;i++){
        var ins = inserts[i];
        out = out.slice(0, ins.pos) + ' ${'data-idem-id'}="' + ins.id + '"' + out.slice(ins.pos);
      }
      return { code: out, map: null };
    },
    transformIndexHtml: function(html){
      var tag = '<script>' + AGENT + '<' + '/script>';
      if (html.indexOf('</body>') !== -1) return html.replace('</body>', tag + '</body>');
      return html + tag;
    }
  };
}
`;
}

/* ------------------------------------------------------------------ */
/* Édition AST du vite.config : ajout / retrait du plugin.              */
/* ------------------------------------------------------------------ */

function findPluginsArrayStart(code: string): number | null {
  let result: number | null = null;
  try {
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript'] });
    traverse(ast, {
      ObjectProperty(path) {
        const key = path.node.key as unknown as { type: string; name?: string; value?: string };
        const name = key.type === 'Identifier' ? key.name : key.type === 'StringLiteral' ? key.value : null;
        if (name !== 'plugins') return;
        const value = path.node.value as unknown as { type: string; start: number };
        if (value.type === 'ArrayExpression' && result === null) {
          result = value.start; // position du '['
        }
      },
    });
  } catch {
    return null;
  }
  return result;
}

/** Ajoute l'import + l'appel idemEditPlugin() au vite.config. Retourne null si impossible. */
export function addPluginToViteConfig(code: string): string | null {
  if (code.includes('idemEditPlugin')) return code; // déjà instrumenté

  const arrStart = findPluginsArrayStart(code);
  let updated: string;
  if (arrStart !== null) {
    updated = code.slice(0, arrStart + 1) + 'idemEditPlugin(), ' + code.slice(arrStart + 1);
  } else {
    // Fallback regex si l'AST ne trouve pas le tableau.
    const m = code.match(/plugins\s*:\s*\[/);
    if (!m || m.index === undefined) return null;
    const at = m.index + m[0].length;
    updated = code.slice(0, at) + 'idemEditPlugin(), ' + code.slice(at);
  }
  return `${IMPORT_LINE}\n${updated}`;
}

export function removePluginFromViteConfig(code: string): string {
  let out = code;
  out = out.replace(IMPORT_LINE + '\n', '').replace(IMPORT_LINE, '');
  out = out
    .replace('idemEditPlugin(), ', '')
    .replace('idemEditPlugin(),', '')
    .replace(', idemEditPlugin()', '')
    .replace('idemEditPlugin()', '');
  return out;
}

/* ------------------------------------------------------------------ */
/* Plans d'injection / retrait appliqués au fileStore par le composant. */
/* ------------------------------------------------------------------ */

export function buildInjectPlan(files: Record<string, string>): InstrumentationPlan {
  const configPath = findViteConfigPath(files);
  if (!configPath) {
    return { ok: false, writes: {}, deletes: [], reason: 'vite.config introuvable' };
  }
  const newConfig = addPluginToViteConfig(files[configPath]);
  if (newConfig === null) {
    return { ok: false, writes: {}, deletes: [], reason: 'tableau plugins introuvable dans vite.config' };
  }
  return {
    ok: true,
    writes: { [PLUGIN_PATH]: buildVitePluginSource(), [configPath]: newConfig },
    deletes: [],
  };
}

export function buildRemovePlan(files: Record<string, string>): InstrumentationPlan {
  const configPath = findViteConfigPath(files);
  const writes: Record<string, string> = {};
  if (configPath && files[configPath]) {
    writes[configPath] = removePluginFromViteConfig(files[configPath]);
  }
  return { ok: true, writes, deletes: [PLUGIN_PATH] };
}
