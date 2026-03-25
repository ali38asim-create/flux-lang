// flux-runtime.js – Complete Flux browser runtime
(function() {
    function createElement(vnode) {
        if (typeof vnode === 'string') return document.createTextNode(vnode);
        const el = document.createElement(vnode.type);
        if (vnode.props) {
            for (let [key, val] of Object.entries(vnode.props)) {
                if (key.startsWith('on') && typeof val === 'function') {
                    el.addEventListener(key.slice(2).toLowerCase(), val);
                } else if (key === 'style' && typeof val === 'object') {
                    Object.assign(el.style, val);
                } else if (key === 'class') {
                    el.className = val;
                } else {
                    el.setAttribute(key, val);
                }
            }
        }
        vnode.children.forEach(child => el.appendChild(createElement(child)));
        return el;
    }

    function render(vnode, container) {
        container.innerHTML = '';
        container.appendChild(createElement(vnode));
    }

    const tagMap = new Map();
    const basicTags = [
        'div','span','p','a','button','input','form','ul','li','h1','h2','h3','h4','h5','h6',
        'img','table','tr','td','th','section','article','header','footer','nav','main'
    ];
    basicTags.forEach(tag => tagMap.set(tag, tag));
    for (let i = 1; i <= 6; i++) tagMap.set(`f${i}`, `h${i}`);
    tagMap.set('heading','h1'); tagMap.set('title','h1'); tagMap.set('button','button'); tagMap.set('btn','button');

    function resolveTag(tagName) {
        if (tagMap.has(tagName)) return tagMap.get(tagName);
        tagMap.set(tagName, tagName);
        return tagName;
    }

    function parseLine(line) {
        line = line.trim();
        if (line === '') return null;
        let match = line.match(/^([a-zA-Z][a-zA-Z0-9-]*)(?:\s+\(([^)]*)\))?(?:\s+("([^"]*)"|'([^']*)'))?/);
        if (!match) return null;
        let tag = match[1], attrStr = match[2], text = match[4] || match[5];
        let attrs = {};
        if (attrStr) {
            const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*"([^"]*)"|([a-zA-Z][a-zA-Z0-9-]*)\s+([^\s]+)/g;
            let m;
            while ((m = attrRegex.exec(attrStr)) !== null) {
                if (m[1]) attrs[m[1]] = m[2];
                else if (m[3]) attrs[m[3]] = m[4];
            }
        }
        return { tag, attrs, text };
    }

    function parseFlux(source) {
        const lines = source.split('\n');
        const stack = [];
        let root = null, currentParent = null, lastIndent = 0;
        for (let line of lines) {
            const indent = line.search(/\S|$/);
            const trimmed = line.trim();
            if (trimmed === '') continue;
            const parsed = parseLine(line);
            if (!parsed) continue;
            const vnode = {
                type: resolveTag(parsed.tag),
                props: parsed.attrs,
                children: parsed.text ? [parsed.text] : [],
                indent: indent
            };
            if (indent === 0) {
                root = vnode;
                stack.length = 0;
                stack.push(vnode);
                currentParent = vnode;
            } else if (indent > lastIndent) {
                if (currentParent) {
                    currentParent.children.push(vnode);
                    stack.push(vnode);
                    currentParent = vnode;
                }
            } else if (indent === lastIndent) {
                stack.pop();
                const parent = stack[stack.length - 1];
                if (parent) {
                    parent.children.push(vnode);
                    stack.push(vnode);
                    currentParent = vnode;
                }
            } else {
                while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
                const parent = stack[stack.length - 1];
                if (parent) {
                    parent.children.push(vnode);
                    stack.push(vnode);
                    currentParent = vnode;
                } else {
                    root = vnode;
                    stack = [vnode];
                    currentParent = vnode;
                }
            }
            lastIndent = indent;
        }
        return root;
    }

    class FluxConnectElement extends HTMLElement {
        static get observedAttributes() { return ['src', 'mode', 'flux']; }
        constructor() { super(); this.attachShadow({ mode: 'open' }); }
        async connectedCallback() { this.load(); }
        attributeChangedCallback() { this.load(); }
        async load() {
            const src = this.getAttribute('src');
            const inlineFlux = this.getAttribute('flux');
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
            const vnode = parseFlux(fluxCode);
            if (vnode) {
                const mode = this.getAttribute('mode') || 'replace';
                if (mode === 'replace') this.shadowRoot.innerHTML = '';
                render(vnode, this.shadowRoot);
            } else {
                console.error('Failed to parse Flux');
                this.shadowRoot.innerHTML = '<div style="color:red">Parse error</div>';
            }
        }
    }
    customElements.define('flux-connect', FluxConnectElement);
})();
