// flux-runtime.js – Full-featured Flux Language Runtime v2.0
// Supports: components, state, events, routing, theming, animations, layout, forms, media
(function (global) {
  'use strict';

  // ─── Virtual DOM ───────────────────────────────────────────────────────────
  function h(type, props, ...children) {
    return { type, props: props || {}, children: children.flat(Infinity) };
  }

  function createElement(vnode) {
    if (vnode == null || vnode === false) return document.createTextNode('');
    if (typeof vnode === 'string' || typeof vnode === 'number')
      return document.createTextNode(String(vnode));
    if (Array.isArray(vnode)) {
      const frag = document.createDocumentFragment();
      vnode.forEach(v => frag.appendChild(createElement(v)));
      return frag;
    }

    // Special: raw HTML
    if (vnode.type === '__raw__') {
      const wrap = document.createElement('div');
      wrap.innerHTML = vnode.html;
      const frag = document.createDocumentFragment();
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      return frag;
    }

    const el = document.createElement(vnode.type);

    // Apply props
    for (const [key, val] of Object.entries(vnode.props || {})) {
      if (key === 'class' || key === 'className') {
        el.className = Array.isArray(val) ? val.filter(Boolean).join(' ') : val;
      } else if (key === 'style') {
        if (typeof val === 'object') Object.assign(el.style, val);
        else el.setAttribute('style', val);
      } else if (key.startsWith('on') && typeof val === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (key === 'ref' && typeof val === 'function') {
        val(el);
      } else if (key === 'dangerouslySetInnerHTML') {
        el.innerHTML = val.__html || '';
      } else if (typeof val === 'boolean') {
        if (val) el.setAttribute(key, '');
        else el.removeAttribute(key);
      } else if (val != null) {
        el.setAttribute(key, val);
      }
    }

    // Append children
    (vnode.children || []).forEach(child => {
      const node = createElement(child);
      if (Array.isArray(node)) node.forEach(n => el.appendChild(n));
      else if (node) el.appendChild(node);
    });

    return el;
  }

  function patch(container, newVnode, oldEl) {
    const newEl = createElement(newVnode);
    if (oldEl) container.replaceChild(newEl, oldEl);
    else container.appendChild(newEl);
    return newEl;
  }

  // ─── Tag Resolution ─────────────────────────────────────────────────────────
  const TAG_MAP = {
    // Headings
    f1:'h1', f2:'h2', f3:'h3', f4:'h4', f5:'h5', f6:'h6',
    // Semantic
    row:'div', col:'div', box:'div', card:'div', stack:'div',
    grid:'div', flex:'div', wrap:'div', group:'div', panel:'div',
    sidebar:'aside', topbar:'header', navbar:'nav', hero:'section',
    footer:'footer', modal:'div', overlay:'div', badge:'span',
    tag:'span', chip:'span', avatar:'div', icon:'span',
    // Form
    btn:'button', field:'input', check:'input', radio:'input',
    toggle:'input', select:'select', option:'option', textarea:'textarea',
    label:'label', fieldset:'fieldset', legend:'legend', form:'form',
    // Media
    img:'img', video:'video', audio:'audio', canvas:'canvas', svg:'svg',
    iframe:'iframe', picture:'picture', source:'source',
    // Typography
    text:'span', para:'p', quote:'blockquote', code:'code',
    pre:'pre', kbd:'kbd', mark:'mark', del:'del', ins:'ins',
    sub:'sub', sup:'sup', abbr:'abbr', cite:'cite',
    // Layout
    divider:'hr', line:'hr', br:'br', sep:'hr',
    list:'ul', olist:'ol', item:'li', dt:'dt', dd:'dd', dl:'dl',
    table:'table', thead:'thead', tbody:'tbody', tfoot:'tfoot',
    row_:'tr', cell:'td', header_:'th',
    // Interactive
    details:'details', summary:'summary', dialog:'dialog',
    progress:'progress', meter:'meter', output:'output',
    // Links & Nav
    link:'a', anchor:'a',
    // Misc
    script:'script', style:'style', template:'template',
  };

  function resolveTag(t) { return TAG_MAP[t] || t; }

  // ─── CSS Class Utilities ────────────────────────────────────────────────────
  const FLUX_STYLES = `
    :host { display: block; }
    .fx-row { display: flex; flex-direction: row; }
    .fx-col { display: flex; flex-direction: column; }
    .fx-stack { display: flex; flex-direction: column; gap: 0.75rem; }
    .fx-grid { display: grid; }
    .fx-center { display: flex; align-items: center; justify-content: center; }
    .fx-wrap { flex-wrap: wrap; }
    .fx-card { background: var(--fx-card-bg, #fff); border-radius: var(--fx-radius, 8px); box-shadow: var(--fx-shadow, 0 2px 12px rgba(0,0,0,0.08)); padding: 1.25rem; }
    .fx-panel { background: var(--fx-panel-bg, #f8f9fa); border-radius: var(--fx-radius, 8px); padding: 1rem; }
    .fx-hero { padding: 4rem 2rem; text-align: center; }
    .fx-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem; border-radius: var(--fx-btn-radius, 6px); border: none; cursor: pointer; font-size: 0.95rem; font-weight: 500; transition: all 0.18s ease; background: var(--fx-primary, #007acc); color: #fff; }
    .fx-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
    .fx-btn:active { transform: translateY(0); filter: brightness(0.95); }
    .fx-btn-secondary { background: var(--fx-secondary, #6c757d); }
    .fx-btn-danger { background: var(--fx-danger, #dc3545); }
    .fx-btn-success { background: var(--fx-success, #28a745); }
    .fx-btn-outline { background: transparent; border: 2px solid var(--fx-primary, #007acc); color: var(--fx-primary, #007acc); }
    .fx-btn-ghost { background: transparent; color: var(--fx-primary, #007acc); }
    .fx-input { display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1.5px solid var(--fx-border, #dee2e6); border-radius: var(--fx-radius, 6px); font-size: 0.95rem; transition: border-color 0.18s; outline: none; background: var(--fx-input-bg, #fff); color: var(--fx-text, #212529); }
    .fx-input:focus { border-color: var(--fx-primary, #007acc); box-shadow: 0 0 0 3px rgba(0,122,204,0.15); }
    .fx-badge { display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: var(--fx-primary, #007acc); color: #fff; }
    .fx-avatar { width: 2.5rem; height: 2.5rem; border-radius: 50%; background: var(--fx-primary, #007acc); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; overflow: hidden; }
    .fx-modal { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .fx-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 999; }
    .fx-fade-in { animation: fxFadeIn 0.35s ease both; }
    .fx-slide-up { animation: fxSlideUp 0.35s ease both; }
    .fx-slide-down { animation: fxSlideDown 0.35s ease both; }
    .fx-bounce { animation: fxBounce 0.5s cubic-bezier(.36,.07,.19,.97) both; }
    .fx-pulse { animation: fxPulse 1.5s ease-in-out infinite; }
    .fx-spin { animation: fxSpin 1s linear infinite; }
    .fx-tooltip { position: relative; }
    .fx-tooltip::after { content: attr(data-tip); position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: 0.3rem 0.7rem; border-radius: 4px; font-size: 0.8rem; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.2s; }
    .fx-tooltip:hover::after { opacity: 1; }
    .fx-divider { border: none; border-top: 1.5px solid var(--fx-border, #dee2e6); margin: 1rem 0; }
    .fx-loading { display: inline-block; width: 1.5rem; height: 1.5rem; border: 3px solid var(--fx-border, #dee2e6); border-top-color: var(--fx-primary, #007acc); border-radius: 50%; animation: fxSpin 0.75s linear infinite; }
    .fx-progress { appearance: none; width: 100%; height: 6px; border-radius: 3px; overflow: hidden; background: var(--fx-border, #dee2e6); }
    .fx-progress::-webkit-progress-bar { background: var(--fx-border, #dee2e6); }
    .fx-progress::-webkit-progress-value { background: var(--fx-primary, #007acc); transition: width 0.3s; }
    .fx-table { width: 100%; border-collapse: collapse; }
    .fx-table th, .fx-table td { padding: 0.6rem 0.9rem; border-bottom: 1px solid var(--fx-border, #dee2e6); text-align: left; }
    .fx-table th { font-weight: 600; background: var(--fx-panel-bg, #f8f9fa); }
    .fx-table tr:hover td { background: var(--fx-hover-bg, rgba(0,122,204,0.04)); }
    .fx-tag { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.7rem; border-radius: 999px; font-size: 0.8rem; font-weight: 500; background: var(--fx-tag-bg, #e9ecef); color: var(--fx-tag-color, #495057); }
    .fx-alert { padding: 0.85rem 1.1rem; border-radius: var(--fx-radius, 6px); border-left: 4px solid; margin: 0.5rem 0; }
    .fx-alert-info { background: #e8f4fd; border-color: #007acc; color: #004a7c; }
    .fx-alert-success { background: #eafaf1; border-color: #28a745; color: #155724; }
    .fx-alert-warning { background: #fff9e6; border-color: #ffc107; color: #856404; }
    .fx-alert-danger { background: #fdecea; border-color: #dc3545; color: #721c24; }
    .fx-sidebar { width: var(--fx-sidebar-width, 240px); min-height: 100vh; background: var(--fx-sidebar-bg, #1e1e2e); color: var(--fx-sidebar-color, #cdd6f4); }
    .fx-navbar { display: flex; align-items: center; padding: 0 1.5rem; height: 56px; background: var(--fx-navbar-bg, #fff); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .fx-section { padding: var(--fx-section-padding, 3rem 2rem); }
    .fx-container { max-width: var(--fx-container-max, 1200px); margin: 0 auto; padding: 0 1rem; }
    .fx-gap-sm { gap: 0.5rem; } .fx-gap { gap: 1rem; } .fx-gap-lg { gap: 2rem; }
    .fx-p-sm { padding: 0.5rem; } .fx-p { padding: 1rem; } .fx-p-lg { padding: 2rem; }
    .fx-m-sm { margin: 0.5rem; } .fx-m { margin: 1rem; } .fx-m-lg { margin: 2rem; }
    .fx-text-sm { font-size: 0.8rem; } .fx-text-lg { font-size: 1.2rem; } .fx-text-xl { font-size: 1.5rem; }
    .fx-bold { font-weight: 700; } .fx-muted { opacity: 0.6; } .fx-italic { font-style: italic; }
    .fx-rounded { border-radius: var(--fx-radius, 8px); } .fx-rounded-full { border-radius: 9999px; }
    .fx-shadow { box-shadow: var(--fx-shadow, 0 2px 12px rgba(0,0,0,0.08)); }
    .fx-shadow-lg { box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
    .fx-bg-primary { background: var(--fx-primary, #007acc); color: #fff; }
    .fx-bg-dark { background: var(--fx-dark, #1e1e2e); color: #cdd6f4; }
    .fx-code { font-family: 'Fira Code', monospace; background: var(--fx-code-bg, #f0f0f0); padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.88em; }
    .fx-pre { background: var(--fx-code-bg, #1e1e2e); color: #cdd6f4; padding: 1.2rem; border-radius: 8px; overflow-x: auto; font-family: 'Fira Code', monospace; }
    @keyframes fxFadeIn { from { opacity:0 } to { opacity:1 } }
    @keyframes fxSlideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
    @keyframes fxSlideDown { from { opacity:0; transform:translateY(-16px) } to { opacity:1; transform:none } }
    @keyframes fxBounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
    @keyframes fxPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    @keyframes fxSpin { to { transform: rotate(360deg) } }
  `;

  // ─── Flux Parser v2 ─────────────────────────────────────────────────────────
  function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      // skip whitespace
      if (/\s/.test(src[i])) { i++; continue; }
      // line comment
      if (src[i] === '/' && src[i+1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      // block comment
      if (src[i] === '/' && src[i+1] === '*') {
        i += 2;
        while (i < src.length && !(src[i] === '*' && src[i+1] === '/')) i++;
        i += 2; continue;
      }
      // string
      if (src[i] === '"' || src[i] === "'") {
        const q = src[i]; let s = ''; i++;
        while (i < src.length && src[i] !== q) {
          if (src[i] === '\\') { i++; s += src[i]; } else s += src[i];
          i++;
        }
        i++;
        tokens.push({ type: 'string', val: s });
        continue;
      }
      // template string
      if (src[i] === '`') {
        let s = ''; i++;
        while (i < src.length && src[i] !== '`') {
          s += src[i]; i++;
        }
        i++;
        tokens.push({ type: 'string', val: s });
        continue;
      }
      // number
      if (/\d/.test(src[i]) || (src[i] === '-' && /\d/.test(src[i+1]))) {
        let n = '';
        if (src[i] === '-') { n = '-'; i++; }
        while (i < src.length && /[\d.]/.test(src[i])) { n += src[i]; i++; }
        tokens.push({ type: 'number', val: parseFloat(n) });
        continue;
      }
      // punctuation
      if ('{}()[]@,;:=!<>|&+-*/%'.includes(src[i])) {
        tokens.push({ type: 'punct', val: src[i] }); i++; continue;
      }
      // identifier / keyword
      if (/[a-zA-Z_$]/.test(src[i])) {
        let id = '';
        while (i < src.length && /[a-zA-Z0-9_$\-]/.test(src[i])) { id += src[i]; i++; }
        tokens.push({ type: 'ident', val: id });
        continue;
      }
      i++;
    }
    return tokens;
  }

  const KEYWORDS = new Set([
    'component','def','state','theme','style','import','export',
    'if','else','for','in','while','return','emit','on',
    '@get','@post','@put','@delete','@patch','@file','@css','@ws',
    'true','false','null','let','const','var','await','async'
  ]);

  function parseProgram(src) {
    const tokens = tokenize(src);
    let pos = 0;
    const peek = (offset=0) => tokens[pos + offset];
    const consume = () => tokens[pos++];
    const expect = (val) => { const t = consume(); if (t?.val !== val) throw new Error(`Expected '${val}' got '${t?.val}'`); return t; };

    const nodes = [];

    while (pos < tokens.length) {
      const t = peek();
      if (!t) break;

      if (t.type === 'ident' && t.val === 'component') {
        nodes.push(parseComponent());
      } else if (t.type === 'ident' && t.val === 'def') {
        nodes.push(parseDef());
      } else if (t.type === 'ident' && t.val === 'theme') {
        nodes.push(parseTheme());
      } else if (t.type === 'ident' && t.val === 'import') {
        nodes.push(parseImport());
      } else if (t.type === 'ident' && (t.val === '@get' || t.val === '@post' || t.val === '@put' || t.val === '@delete' || t.val === '@patch')) {
        nodes.push(parseRoute());
      } else {
        consume(); // skip unknown
      }
    }

    return nodes;

    function parseComponent() {
      consume(); // 'component'
      const name = consume().val;
      let props = [];
      if (peek()?.val === '(') {
        consume();
        while (peek()?.val !== ')') {
          if (peek()?.val === ',') { consume(); continue; }
          props.push(consume().val);
        }
        consume();
      }
      expect('{');
      const body = parseBlock();
      return { kind: 'component', name, props, body };
    }

    function parseDef() {
      consume(); // 'def'
      const name = consume().val;
      let params = [];
      if (peek()?.val === '(') {
        consume();
        while (peek()?.val !== ')') {
          if (peek()?.val === ',') { consume(); continue; }
          params.push(consume().val);
        }
        consume();
      }
      expect('{');
      const body = parseBlock();
      return { kind: 'def', name, params, body };
    }

    function parseTheme() {
      consume(); // 'theme'
      let name = 'default';
      if (peek()?.type === 'ident' && peek()?.val !== '{') name = consume().val;
      expect('{');
      const vars = {};
      while (peek()?.val !== '}') {
        const k = consume().val; expect(':'); const v = consume().val;
        vars[k] = v;
        if (peek()?.val === ',') consume();
      }
      consume();
      return { kind: 'theme', name, vars };
    }

    function parseImport() {
      consume(); // 'import'
      const path = consume().val;
      return { kind: 'import', path };
    }

    function parseRoute() {
      const method = consume().val.slice(1); // remove @
      const path = consume().val;
      expect('{');
      const body = parseBlock();
      return { kind: 'route', method, path, body };
    }

    function parseBlock() {
      const stmts = [];
      while (pos < tokens.length && peek()?.val !== '}') {
        const stmt = parseStatement();
        if (stmt) stmts.push(stmt);
      }
      if (peek()?.val === '}') consume();
      return stmts;
    }

    function parseStatement() {
      const t = peek();
      if (!t) return null;

      if (t.val === 'state') return parseState();
      if (t.val === 'style') return parseStyle();
      if (t.val === 'if') return parseIf();
      if (t.val === 'for') return parseFor();
      if (t.val === 'return') { consume(); return { kind: 'return', value: parseExpr() }; }
      if (t.val === 'emit') { consume(); const name = consume().val; return { kind: 'emit', name }; }
      if (t.val === 'on') return parseOn();
      if (t.val === 'let' || t.val === 'const' || t.val === 'var') return parseVar();

      // Element or expression
      if (t.type === 'ident' && !KEYWORDS.has(t.val)) {
        // Check if it's an element (followed by string, (, {, or more idents)
        const next = peek(1);
        if (next && (next.type === 'string' || next.val === '(' || next.val === '{' || (next.type === 'ident' && !KEYWORDS.has(next.val)))) {
          return parseElement();
        }
        if (!next || next.val === '}' || next.val === '\n') {
          // standalone element with no children
          return parseElement();
        }
      }

      consume();
      return null;
    }

    function parseState() {
      consume(); // 'state'
      expect('{');
      const vars = {};
      while (peek()?.val !== '}') {
        const k = consume().val; expect(':'); const v = parseExpr();
        vars[k] = v;
        if (peek()?.val === ',') consume();
      }
      consume();
      return { kind: 'state', vars };
    }

    function parseStyle() {
      consume(); // 'style'
      expect('{');
      let css = '';
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const t = consume();
        if (t.val === '{') depth++;
        else if (t.val === '}') { depth--; if (depth === 0) break; }
        css += t.val + ' ';
      }
      return { kind: 'style', css };
    }

    function parseIf() {
      consume(); // 'if'
      const cond = parseExpr();
      expect('{');
      const then = parseBlock();
      let els = null;
      if (peek()?.val === 'else') {
        consume();
        expect('{');
        els = parseBlock();
      }
      return { kind: 'if', cond, then, els };
    }

    function parseFor() {
      consume(); // 'for'
      const item = consume().val;
      expect('in');
      const list = parseExpr();
      expect('{');
      const body = parseBlock();
      return { kind: 'for', item, list, body };
    }

    function parseOn() {
      consume(); // 'on'
      const event = consume().val;
      expect('{');
      const body = parseBlock();
      return { kind: 'on', event, body };
    }

    function parseVar() {
      const kw = consume().val;
      const name = consume().val;
      expect('=');
      const value = parseExpr();
      return { kind: 'var', kw, name, value };
    }

    function parseElement() {
      const tag = consume().val;
      let attrs = {};
      let children = [];
      let classes = [];

      // Inline classes: btn.primary.lg
      // (handled via tag name for now, split on '.')
      const tagParts = tag.split('.');
      const baseTag = tagParts[0];
      if (tagParts.length > 1) classes = tagParts.slice(1).map(c => `fx-${c}`);

      // Attribute block (...)
      if (peek()?.val === '(') {
        consume();
        while (peek()?.val !== ')') {
          if (!peek()) break;
          if (peek()?.val === ',') { consume(); continue; }
          const k = consume().val;
          if (peek()?.val === '=') {
            consume();
            const v = consume();
            attrs[k] = v.val;
          } else {
            // boolean attr or shorthand class
            if (k === 'class') {
              const v = consume();
              if (typeof v.val === 'string') classes.push(...v.val.split(' '));
            } else {
              attrs[k] = true;
            }
          }
        }
        if (peek()?.val === ')') consume();
      }

      // Apply class shortcuts from attr
      if (attrs.class) {
        classes.push(...attrs.class.split(' '));
        delete attrs.class;
      }

      // Children block {...} or inline string
      if (peek()?.val === '{') {
        consume();
        children = parseBlock();
      } else if (peek()?.type === 'string') {
        children = [{ kind: 'text', value: consume().val }];
      } else if (peek()?.type === 'number') {
        children = [{ kind: 'text', value: String(consume().val) }];
      }

      return { kind: 'element', tag: baseTag, classes, attrs, children };
    }

    function parseExpr() {
      const t = peek();
      if (!t) return null;
      if (t.type === 'string') { consume(); return { kind: 'literal', value: t.val }; }
      if (t.type === 'number') { consume(); return { kind: 'literal', value: t.val }; }
      if (t.val === 'true') { consume(); return { kind: 'literal', value: true }; }
      if (t.val === 'false') { consume(); return { kind: 'literal', value: false }; }
      if (t.val === 'null') { consume(); return { kind: 'literal', value: null }; }
      if (t.type === 'ident') {
        const name = consume().val;
        if (peek()?.val === '(') {
          consume();
          const args = [];
          while (peek()?.val !== ')') {
            if (peek()?.val === ',') { consume(); continue; }
            args.push(parseExpr());
          }
          consume();
          return { kind: 'call', name, args };
        }
        if (peek()?.val === '.') {
          consume();
          const prop = consume().val;
          return { kind: 'member', obj: name, prop };
        }
        return { kind: 'ident', name };
      }
      consume();
      return null;
    }
  }

  // ─── Flux Evaluator / Renderer ──────────────────────────────────────────────
  class FluxInstance {
    constructor(componentDef, props, registry) {
      this.def = componentDef;
      this.props = props || {};
      this.registry = registry || {};
      this.state = {};
      this.fns = {};
      this.eventHandlers = {};
      this.styles = [];
      this._setupState();
      this._setupFns();
    }

    _setupState() {
      for (const node of this.def.body) {
        if (node.kind === 'state') {
          for (const [k, v] of Object.entries(node.vars)) {
            this.state[k] = this._evalExpr(v, {});
          }
        }
      }
    }

    _setupFns() {
      for (const node of this.def.body) {
        if (node.kind === 'def') {
          this.fns[node.name] = (...args) => {
            const ctx = { ...this.state, props: this.props };
            node.params.forEach((p, i) => ctx[p] = args[i]);
            return this._evalBlock(node.body, ctx);
          };
        }
      }
    }

    setState(key, value) {
      this.state[key] = value;
      if (this._mountEl && this._rerenderFn) this._rerenderFn();
    }

    _evalExpr(expr, ctx) {
      if (expr == null) return null;
      if (expr.kind === 'literal') return expr.value;
      if (expr.kind === 'ident') {
        if (expr.name in ctx) return ctx[expr.name];
        if (expr.name in this.state) return this.state[expr.name];
        if (expr.name in this.props) return this.props[expr.name];
        return undefined;
      }
      if (expr.kind === 'member') {
        const obj = this._evalExpr({ kind: 'ident', name: expr.obj }, ctx);
        return obj?.[expr.prop];
      }
      if (expr.kind === 'call') {
        const fn = this.fns[expr.name] || window[expr.name];
        if (fn) return fn(...expr.args.map(a => this._evalExpr(a, ctx)));
        return null;
      }
      return null;
    }

    _evalBlock(stmts, ctx) {
      const vnodes = [];
      for (const stmt of stmts || []) {
        const result = this._evalStmt(stmt, ctx);
        if (result != null) {
          if (Array.isArray(result)) vnodes.push(...result);
          else vnodes.push(result);
        }
      }
      return vnodes;
    }

    _evalStmt(stmt, ctx) {
      if (!stmt) return null;
      switch (stmt.kind) {
        case 'element': return this._renderElement(stmt, ctx);
        case 'text': return stmt.value;
        case 'if': {
          const cond = this._evalExpr(stmt.cond, ctx);
          return this._evalBlock(cond ? stmt.then : (stmt.els || []), ctx);
        }
        case 'for': {
          const list = this._evalExpr(stmt.list, ctx) || [];
          return list.flatMap(item => this._evalBlock(stmt.body, { ...ctx, [stmt.item]: item }));
        }
        case 'state': return null;
        case 'style': this.styles.push(stmt.css); return null;
        case 'def': return null;
        case 'return': return this._evalExpr(stmt.value, ctx);
        case 'var': {
          ctx[stmt.name] = this._evalExpr(stmt.value, ctx);
          return null;
        }
        case 'on': return null;
        default: return null;
      }
    }

    _renderElement(node, ctx) {
      const tag = resolveTag(node.tag);
      const props = {};
      const classes = [...(node.classes || [])];

      // Auto-apply fx- classes for layout tags
      const layoutFxClass = {
        card: 'fx-card', panel: 'fx-panel', hero: 'fx-hero', row: 'fx-row',
        col: 'fx-col', stack: 'fx-stack', grid: 'fx-grid', flex: 'fx-row',
        navbar: 'fx-navbar', sidebar: 'fx-sidebar', section: 'fx-section',
        badge: 'fx-badge', avatar: 'fx-avatar', modal: 'fx-modal',
        overlay: 'fx-overlay', tag: 'fx-tag', chip: 'fx-tag',
        divider: 'fx-divider', sep: 'fx-divider',
        pre: 'fx-pre', code: 'fx-code',
      };
      if (layoutFxClass[node.tag]) classes.push(layoutFxClass[node.tag]);

      // Process attributes
      for (const [k, v] of Object.entries(node.attrs || {})) {
        if (k === 'class') { classes.push(...v.split(' ')); continue; }

        // Event handlers
        if (k.startsWith('on')) {
          const evtName = k.slice(2).toLowerCase();
          props[`on${evtName.charAt(0).toUpperCase()}${evtName.slice(1)}`] = (e) => {
            // Evaluate handler: can be fn name or inline expression
            if (typeof v === 'string' && this.fns[v]) this.fns[v](e);
            else {
              // Try to run as JS in context
              try {
                const fn = new Function('state', 'props', 'e', `with(state){ ${v} }`);
                fn({ ...this.state, ...this.fns }, this.props, e);
              } catch {}
            }
            if (this._rerenderFn) this._rerenderFn();
          };
          continue;
        }

        // Special shorthands
        if (k === 'variant' || k === 'type_') {
          if (node.tag === 'btn' || node.tag === 'button') {
            classes.push(`fx-btn-${v}`);
            continue;
          }
        }
        if (k === 'animate') { classes.push(`fx-${v}`); continue; }
        if (k === 'tooltip') { props['data-tip'] = v; classes.push('fx-tooltip'); continue; }
        if (k === 'loading') { classes.push('fx-pulse'); continue; }

        // Interpolate {{state.var}} in string values
        if (typeof v === 'string') {
          const interpolated = v.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
            const val = ctx[expr.trim()] ?? this.state[expr.trim()] ?? this.props[expr.trim()] ?? '';
            return String(val);
          });
          props[k] = interpolated;
        } else {
          props[k] = v;
        }
      }

      // Button auto-class
      if (node.tag === 'btn' || (tag === 'button' && !classes.some(c => c.startsWith('fx-btn')))) {
        classes.push('fx-btn');
      }
      // Input auto-class
      if (node.tag === 'field' || node.tag === 'check' || node.tag === 'radio' || node.tag === 'toggle') {
        classes.push('fx-input');
        if (node.tag === 'check') props.type = 'checkbox';
        if (node.tag === 'radio') props.type = 'radio';
        if (node.tag === 'toggle') { props.type = 'checkbox'; props.role = 'switch'; }
      }
      // Progress bar
      if (node.tag === 'progress') classes.push('fx-progress');
      // Table
      if (node.tag === 'table' || node.tag === 'tbl') classes.push('fx-table');
      // Alert
      if (node.tag === 'alert') {
        const variant = node.attrs?.variant || node.attrs?.type || 'info';
        classes.push('fx-alert', `fx-alert-${variant}`);
      }

      if (classes.length) props.className = classes.join(' ');

      const children = this._evalBlock(node.children, ctx);

      return h(tag, props, ...children);
    }

    render(container) {
      const renderFn = () => {
        const vnodes = this._evalBlock(this.def.body, { ...this.state, props: this.props });
        const styleEl = this.styles.length ? h('style', {}, FLUX_STYLES + '\n' + this.styles.join('\n')) : h('style', {}, FLUX_STYLES);
        const root = h('div', { className: 'fx-root' }, styleEl, ...vnodes);
        container.innerHTML = '';
        container.appendChild(createElement(root));
      };
      this._rerenderFn = renderFn;
      renderFn();
    }
  }

  // ─── Theme Engine ───────────────────────────────────────────────────────────
  const THEME_VARS = {
    default: {},
    dark: {
      '--fx-primary': '#569cd6', '--fx-bg': '#1e1e2e', '--fx-text': '#cdd6f4',
      '--fx-card-bg': '#313244', '--fx-panel-bg': '#24273a', '--fx-border': '#45475a',
      '--fx-input-bg': '#313244', '--fx-navbar-bg': '#181825',
    },
    light: {
      '--fx-primary': '#007acc', '--fx-bg': '#ffffff', '--fx-text': '#212529',
      '--fx-card-bg': '#ffffff', '--fx-panel-bg': '#f8f9fa', '--fx-border': '#dee2e6',
    },
    ocean: {
      '--fx-primary': '#0ea5e9', '--fx-secondary': '#06b6d4',
      '--fx-card-bg': '#f0f9ff', '--fx-panel-bg': '#e0f2fe',
    },
    forest: {
      '--fx-primary': '#16a34a', '--fx-secondary': '#65a30d',
      '--fx-card-bg': '#f0fdf4', '--fx-panel-bg': '#dcfce7',
    },
    sunset: {
      '--fx-primary': '#f97316', '--fx-secondary': '#ef4444',
      '--fx-card-bg': '#fff7ed', '--fx-panel-bg': '#ffedd5',
    },
  };

  function applyTheme(el, themeName, overrides = {}) {
    const vars = { ...THEME_VARS[themeName] || {}, ...overrides };
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  }

  // ─── Router ─────────────────────────────────────────────────────────────────
  class FluxRouter {
    constructor() {
      this.routes = {};
      window.addEventListener('hashchange', () => this._dispatch());
      window.addEventListener('popstate', () => this._dispatch());
    }
    add(path, handler) { this.routes[path] = handler; }
    navigate(path) { window.location.hash = path; }
    _dispatch() {
      const path = window.location.hash.slice(1) || '/';
      const handler = this.routes[path] || this.routes['*'];
      if (handler) handler(path);
    }
  }
  const router = new FluxRouter();

  // ─── Component Registry ─────────────────────────────────────────────────────
  const componentRegistry = {};

  // ─── Flux Program Runner ─────────────────────────────────────────────────────
  function runFlux(src, container, compName = null) {
    const nodes = parseProgram(src);
    const components = {};
    let themeVars = {};
    let themeName = 'default';

    for (const node of nodes) {
      if (node.kind === 'component') {
        components[node.name] = node;
        componentRegistry[node.name] = node;
      }
      if (node.kind === 'theme') {
        themeName = node.name;
        themeVars = node.vars;
      }
    }

    const targetName = compName || Object.keys(components)[0];
    const compDef = components[targetName];
    if (!compDef) {
      container.innerHTML = `<div style="color:red;font-family:monospace;padding:1rem">⚠ Component "${targetName}" not found.<br>Available: ${Object.keys(components).join(', ') || 'none'}</div>`;
      return;
    }

    const instance = new FluxInstance(compDef, {}, components);
    applyTheme(container, themeName, convertThemeVars(themeVars));
    instance.render(container);
    return instance;
  }

  function convertThemeVars(vars) {
    const out = {};
    for (const [k, v] of Object.entries(vars)) {
      out[k.startsWith('--') ? k : `--fx-${k}`] = v;
    }
    return out;
  }

  // ─── <flux-connect> Custom Element ──────────────────────────────────────────
  class FluxConnectElement extends HTMLElement {
    static get observedAttributes() { return ['src', 'flux', 'component', 'theme']; }
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    async connectedCallback() { await this.load(); }
    attributeChangedCallback() { if (this.isConnected) this.load(); }

    async load() {
      const src = this.getAttribute('src');
      const inline = this.getAttribute('flux');
      const compName = this.getAttribute('component') || null;
      const theme = this.getAttribute('theme') || 'default';
      let fluxCode;

      if (inline) {
        fluxCode = inline;
      } else if (src) {
        try {
          const resp = await fetch(src);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          fluxCode = await resp.text();
        } catch (e) {
          this.shadowRoot.innerHTML = `<div style="color:red;padding:1rem;font-family:monospace">⚠ Failed to load "${src}": ${e.message}</div>`;
          return;
        }
      } else {
        this.shadowRoot.innerHTML = '<div style="color:orange;padding:1rem">No src or flux attribute provided.</div>';
        return;
      }

      applyTheme(this.shadowRoot.host, theme);
      runFlux(fluxCode, this.shadowRoot, compName);
    }
  }

  if (!customElements.get('flux-connect')) {
    customElements.define('flux-connect', FluxConnectElement);
  }

  // ─── Expose API ─────────────────────────────────────────────────────────────
  global.Flux = {
    run: runFlux,
    parse: parseProgram,
    applyTheme,
    router,
    registry: componentRegistry,
    version: '2.0.0',
  };

})(window);
