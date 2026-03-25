// flux-runtime.js – Complete Flux runtime with reactive components, state, loops, conditionals, styling
// FIX: Custom element name is now "flux-connect" (must contain a hyphen)
(function() {
  // ----- Virtual DOM helpers -----
  function h(type, props, ...children) {
    return { type, props: props || {}, children: children.flat() };
  }

  function createElement(vnode) {
    if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));
    if (Array.isArray(vnode)) return vnode.map(createElement);
    const el = document.createElement(vnode.type);
    if (vnode.props) {
      for (let [key, val] of Object.entries(vnode.props)) {
        if (key.startsWith('on') && typeof val === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'style' && typeof val === 'object') {
          Object.assign(el.style, val);
        } else if (key === 'class') {
          el.className = val;
        } else if (key === 'dangerouslySetInnerHTML') {
          el.innerHTML = val.__html;
        } else {
          el.setAttribute(key, val);
        }
      }
    }
    if (vnode.children) {
      vnode.children.forEach(child => {
        const childEl = createElement(child);
        if (childEl) el.appendChild(childEl);
      });
    }
    return el;
  }

  function render(vnode, container) {
    container.innerHTML = '';
    container.appendChild(createElement(vnode));
  }

  // ----- Reactive state (simple signals) -----
  class Signal {
    constructor(value) {
      this.value = value;
      this.listeners = [];
    }
    set(newValue) {
      if (this.value !== newValue) {
        this.value = newValue;
        this.listeners.forEach(fn => fn(this.value));
      }
    }
    get() { return this.value; }
    subscribe(fn) { this.listeners.push(fn); }
  }

  // ----- Flux Compiler & Runtime -----
  const TAG_WHITELIST = new Set([
    'div','span','p','a','button','input','form','ul','li','h1','h2','h3','h4','h5','h6',
    'img','table','tr','td','th','section','article','header','footer','nav','main','aside',
    'svg','circle','rect','path','g','defs','line','polygon','text','tspan',
    'style','script','link','meta','title','body','head','html','br','hr','label','select',
    'option','textarea','canvas','iframe','video','audio','source','track','details','summary',
    'dialog','menu','menuitem','fieldset','legend','datalist','output','progress','meter',
    'time','mark','ruby','rt','rp','bdi','bdo','wbr','ins','del','figure','figcaption',
    'blockquote','cite','pre','code','kbd','samp','var','abbr','address','area','map','param',
    'object','embed','picture','source','track','portal'
  ]);
  function normalizeTag(tag) { return tag; }

  class FluxComponent {
    constructor(def, props, parentContext) {
      this.def = def;
      this.props = props || {};
      this.state = {};
      this.context = parentContext || {};
      this.listeners = [];
      this.vnode = null;
      this.container = null;
      this._updateScheduled = false;

      if (def.state) {
        Object.entries(def.state).forEach(([key, initialVal]) => {
          const signal = new Signal(initialVal);
          this.state[key] = signal;
          signal.subscribe(() => this.scheduleUpdate());
        });
      }
    }

    scheduleUpdate() {
      if (!this._updateScheduled) {
        this._updateScheduled = true;
        Promise.resolve().then(() => this.update());
      }
    }

    update() {
      this._updateScheduled = false;
      const newVNode = this.render();
      if (this.container && this.vnode) {
        render(newVNode, this.container);
        this.vnode = newVNode;
      }
    }

    render() {
      return this._executeBlock(this.def.body, {
        props: this.props,
        state: this.state,
        context: this.context,
        component: this
      });
    }

    _executeBlock(block, ctx) {
      let results = [];
      for (let item of block) {
        const res = this._executeNode(item, ctx);
        if (res !== undefined) results.push(res);
      }
      return results.length === 1 ? results[0] : h('div', {}, results);
    }

    _executeNode(node, ctx) {
      switch (node.type) {
        case 'element':
          return this._executeElement(node, ctx);
        case 'if':
          const condition = this._evalExpr(node.condition, ctx);
          if (condition) {
            return this._executeBlock(node.then, ctx);
          } else if (node.else) {
            return this._executeBlock(node.else, ctx);
          }
          return null;
        case 'for':
          const items = this._evalExpr(node.iterable, ctx);
          if (Array.isArray(items)) {
            return items.map((item, index) => {
              const loopCtx = { ...ctx, item, index };
              return this._executeBlock(node.body, loopCtx);
            });
          }
          return null;
        case 'component':
          const subDef = this.def.components[node.name];
          if (subDef) {
            const subProps = node.props ? this._evalProps(node.props, ctx) : {};
            const subComp = new FluxComponent(subDef, subProps, ctx);
            return subComp.render();
          }
          console.warn(`Component "${node.name}" not found`);
          return null;
        case 'text':
          return String(this._evalExpr(node.value, ctx));
        default:
          return null;
      }
    }

    _executeElement(el, ctx) {
      const tag = normalizeTag(el.tag);
      const props = this._evalProps(el.attrs, ctx);
      const children = [];
      for (let child of el.children) {
        const res = this._executeNode(child, ctx);
        if (res !== undefined) children.push(res);
      }
      return h(tag, props, children);
    }

    _evalProps(attrs, ctx) {
      const result = {};
      for (let [key, val] of Object.entries(attrs)) {
        if (typeof val === 'string' && val.includes('{')) {
          result[key] = this._interpolateString(val, ctx);
        } else if (typeof val === 'object' && val.type === 'expr') {
          result[key] = this._evalExpr(val, ctx);
        } else {
          result[key] = val;
        }
      }
      return result;
    }

    _interpolateString(str, ctx) {
      return str.replace(/\{([^}]+)\}/g, (_, expr) => {
        return String(this._evalExpr(expr.trim(), ctx));
      });
    }

    _evalExpr(expr, ctx) {
      const vars = { ...ctx, ...ctx.props, ...ctx.state };
      const keys = Object.keys(vars);
      const values = keys.map(k => vars[k]);
      try {
        const fn = new Function(...keys, `return (${expr});`);
        return fn(...values);
      } catch (err) {
        console.error('Expression evaluation error:', expr, err);
        return null;
      }
    }
  }

  // ----- Parser for Flux language -----
  function parseFlux(source) {
    const lines = source.split('\n');
    const components = {};
    let currentComponent = null;
    let currentBlock = [];
    let indentStack = [];

    function addNode(node) {
      if (currentComponent) {
        currentComponent.body.push(node);
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.search(/\S|$/);
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('//')) continue;

      const compMatch = trimmed.match(/^component\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(([^)]*)\))?\s*{/);
      if (compMatch) {
        const name = compMatch[1];
        const params = compMatch[2] ? compMatch[2].split(',').map(p => p.trim()) : [];
        currentComponent = {
          name,
          params,
          state: {},
          components: {},
          body: []
        };
        components[name] = currentComponent;
        currentBlock = currentComponent.body;
        indentStack = [indent];
        continue;
      }

      const stateMatch = trimmed.match(/^state\s*{\s*([^}]+)\s*}/);
      if (stateMatch && currentComponent) {
        const stateDef = stateMatch[1];
        const pairs = stateDef.split(',').map(p => p.trim());
        pairs.forEach(pair => {
          const [key, val] = pair.split(':').map(s => s.trim());
          if (key && val) {
            let initVal = val;
            if (val.match(/^['"].*['"]$/)) initVal = val.slice(1, -1);
            else if (!isNaN(Number(val))) initVal = Number(val);
            else if (val === 'true') initVal = true;
            else if (val === 'false') initVal = false;
            else initVal = val;
            currentComponent.state[key] = initVal;
          }
        });
        continue;
      }

      const ifMatch = trimmed.match(/^if\s+(.+)\s*{/);
      const forMatch = trimmed.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.+)\s*{/);
      const elementMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9-]*)(?:\s+\(([^)]*)\))?(?:\s+(.*))?/);

      if (ifMatch && currentComponent) {
        const condition = ifMatch[1];
        const node = { type: 'if', condition, then: [], else: null };
        currentBlock.push(node);
        indentStack.push(indent);
        currentBlock = node.then;
        continue;
      } else if (forMatch && currentComponent) {
        const itemVar = forMatch[1];
        const iterable = forMatch[2];
        const node = { type: 'for', item: itemVar, iterable, body: [] };
        currentBlock.push(node);
        indentStack.push(indent);
        currentBlock = node.body;
        continue;
      } else if (elementMatch && currentComponent) {
        const tag = elementMatch[1];
        const attrStr = elementMatch[2] || '';
        const text = elementMatch[3] || '';
        const attrs = {};
        const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*"([^"]*)"|([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*'([^']*)'|([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*{([^}]+)}|([a-zA-Z][a-zA-Z0-9-]*)/g;
        let match;
        while ((match = attrRegex.exec(attrStr)) !== null) {
          if (match[1]) attrs[match[1]] = match[2];
          else if (match[3]) attrs[match[3]] = match[4];
          else if (match[5]) attrs[match[5]] = { type: 'expr', value: match[6] };
          else if (match[7]) attrs[match[7]] = true;
        }
        const children = [];
        if (text) {
          children.push({ type: 'text', value: text });
        }
        const node = { type: 'element', tag, attrs, children };
        currentBlock.push(node);
        continue;
      }

      if (trimmed === '}') {
        if (indentStack.length > 0) {
          indentStack.pop();
          let parent = currentComponent.body;
          currentBlock = indentStack.length > 0 ? parent : currentComponent.body;
        }
        continue;
      }
    }
    return components;
  }

  // ----- Web Component <flux-connect> -----
  class FluxConnectElement extends HTMLElement {
    static get observedAttributes() { return ['src', 'mode', 'flux', 'component']; }
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    async connectedCallback() { this.load(); }
    attributeChangedCallback() { this.load(); }

    async load() {
      const src = this.getAttribute('src');
      const inlineFlux = this.getAttribute('flux');
      const componentName = this.getAttribute('component') || 'default';
      let fluxCode;
      if (inlineFlux) {
        fluxCode = inlineFlux;
      } else if (src) {
        try {
          const response = await fetch(src);
          fluxCode = await response.text();
        } catch (err) {
          console.error('Error loading Flux:', err);
          this.shadowRoot.innerHTML = `<div style="color:red">Error: ${err.message}</div>`;
          return;
        }
      } else {
        this.shadowRoot.innerHTML = '<div style="color:red">No src or flux attribute provided</div>';
        return;
      }

      const components = parseFlux(fluxCode);
      const targetComp = components[componentName] || Object.values(components)[0];
      if (!targetComp) {
        this.shadowRoot.innerHTML = `<div style="color:red">No component found (looked for "${componentName}")</div>`;
        return;
      }

      const instance = new FluxComponent(targetComp, {}, {});
      instance.container = this.shadowRoot;
      const vnode = instance.render();
      render(vnode, this.shadowRoot);
      instance.vnode = vnode;
      this._instance = instance;
    }
  }

  // ✅ FIX: Define the custom element with a hyphenated name
  customElements.define('flux-connect', FluxConnectElement);

  window.Flux = { h, render, parseFlux, FluxComponent };
})();
