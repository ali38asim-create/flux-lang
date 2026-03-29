// fluxruntime.js - OmniScript (Flux) Runtime v4.0
// Supports <connect> tags, components, reactive state, and CSS injection.
(function() {
    // ========== 1. Keyword Mapping ==========
    const keywordMap = {
        'when': 'if', 'otherwise': 'else', 'orwhen': 'else if',
        'match': 'switch', 'with': 'case', 'fallback': 'default',
        'cycle': 'for', 'aslong': 'while', 'perform': 'do',
        'halt': 'break', 'skip': 'continue',
        'recipe': 'function', 'yield': 'return',
        'blueprint': 'class', 'builder': 'constructor', 'inherits': 'extends',
        'ancestor': 'super', 'create': 'new', 'itself': 'this',
        'store': 'let', 'constant': 'const',
        'attempt': 'try', 'capture': 'catch', 'always': 'finally', 'hurl': 'throw',
        'gather': 'import', 'expose': 'export',
        'concurrent': 'async', 'defer': 'await',
        'void': 'null', 'affirm': 'true', 'deny': 'false',
        'and': '&&', 'or': '||', 'not': '!',
        'identical': '===', 'equal': '==', 'distinct': '!==', 'unequal': '!=',
        'add': '+', 'subtract': '-', 'multiply': '*', 'divide': '/', 'modulo': '%', 'power': '**',
        'component': 'function'
    };

    // ========== 2. Compiler (OmniScript → JavaScript) ==========
    function compileOmniScript(source) {
        // Replace keywords
        let js = source;
        for (let [omni, std] of Object.entries(keywordMap)) {
            js = js.replace(new RegExp(`\\b${omni}\\b`, 'g'), std);
        }

        // Convert component declarations to functions
        js = js.replace(/^component\s+(\w+)\s*\(/gm, 'function $1(');

        // Indentation to braces (robust)
        const lines = js.split('\n');
        const out = [];
        let indentStack = [0];
        let i = 0;
        while (i < lines.length) {
            let line = lines[i];
            if (line.trim() === '') {
                out.push('');
                i++;
                continue;
            }
            let indent = 0;
            for (let ch of line) {
                if (ch === ' ') indent++;
                else if (ch === '\t') indent += 4;
                else break;
            }
            const trimmed = line.trim();
            const currentIndent = indentStack[indentStack.length - 1];

            if (indent < currentIndent) {
                while (indent < indentStack[indentStack.length - 1]) {
                    indentStack.pop();
                    out.push('}');
                }
                continue;
            }
            if (indent > currentIndent) {
                indentStack.push(indent);
                out.push('{');
            }
            let processed = line.replace(/:\s*$/, '');
            out.push(processed);
            i++;
        }
        while (indentStack.length > 1) {
            out.push('}');
            indentStack.pop();
        }
        return out.join('\n');
    }

    // ========== 3. Component System ==========
    let currentComponentId = 0;
    function createComponent(renderFn, props = {}) {
        const id = currentComponentId++;
        const state = {};
        let mounted = false;
        let domNode = null;
        let scopedStyles = null;

        const component = {
            id, props, state,
            mount(target) {
                if (mounted) return;
                mounted = true;
                domNode = document.createElement('div');
                target.appendChild(domNode);
                this.update();
            },
            update() {
                if (!domNode) return;
                const html = renderFn.call(component);
                domNode.innerHTML = html;
                if (scopedStyles) {
                    const styleTag = document.createElement('style');
                    styleTag.textContent = scopedStyles;
                    domNode.appendChild(styleTag);
                }
                // Attach event handlers and bindings
                for (let el of domNode.querySelectorAll('*')) {
                    for (let attr of el.attributes) {
                        if (attr.name.startsWith('on')) {
                            const event = attr.name.slice(2);
                            const handler = window[attr.value];
                            if (typeof handler === 'function') {
                                el.removeAttribute(attr.name);
                                el.addEventListener(event, handler.bind(component));
                            }
                        }
                        if (attr.name === 'bind') {
                            const [_, src] = attr.value.split(':');
                            el.removeAttribute(attr.name);
                            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                                el.value = component.state[src] || '';
                                el.addEventListener('input', e => {
                                    component.state[src] = e.target.value;
                                    component.update();
                                });
                            }
                        }
                    }
                }
            },
            setState(newState) { Object.assign(state, newState); this.update(); },
            setScopedCSS(css) { scopedStyles = css; }
        };
        return component;
    }
    window.__flux_component = (renderFn, props) => createComponent(renderFn, props);

    // ========== 4. DOM Helpers ==========
    let previewTarget = null;
    function setPreviewTarget(selector) {
        previewTarget = document.querySelector(selector);
        if (!previewTarget) console.warn(`[Flux] Preview target ${selector} not found`);
    }
    function render(template) {
        if (!previewTarget) { console.warn('[Flux] No preview target'); return; }
        let html = template.replace(/\{([^}]+)\}/g, (_, expr) => {
            try { return eval(expr); } catch(e) { return expr; }
        });
        previewTarget.innerHTML = html;
        for (let el of previewTarget.querySelectorAll('*')) {
            for (let attr of el.attributes) {
                if (attr.name.startsWith('on')) {
                    const event = attr.name.slice(2);
                    const handler = window[attr.value];
                    if (typeof handler === 'function') {
                        el.removeAttribute(attr.name);
                        el.addEventListener(event, handler);
                    }
                }
                if (attr.name === 'bind') {
                    const [_, varName] = attr.value.split(':');
                    el.removeAttribute(attr.name);
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        el.value = window[varName] || '';
                        el.addEventListener('input', e => { window[varName] = e.target.value; });
                    }
                }
            }
        }
    }
    function display(element) {
        if (previewTarget) previewTarget.appendChild(element);
        else console.warn('[Flux] No preview target');
    }
    function listen(event, target, handler) {
        const t = typeof target === 'string' ? document.querySelector(target) : target;
        if (t) t.addEventListener(event, handler);
    }
    function style(selector, rules, scope = null) {
        let css = `${selector} { ${rules} }`;
        if (scope) css = `${selector}[data-flux-${scope}], ${selector} .data-flux-${scope} { ${rules} }`;
        const styleTag = document.createElement('style');
        styleTag.textContent = css;
        document.head.appendChild(styleTag);
    }

    // ========== 5. Module Loader ==========
    async function loadModule(url) {
        if (!url.includes('.')) url += '.flux';
        const res = await fetch(url);
        const src = await res.text();
        const js = compileOmniScript(src);
        const exports = {};
        new Function('exports', 'require', js)(exports, loadModule);
        return exports;
    }
    window.gather = loadModule;

    // ========== 6. <connect> Tag Processor ==========
    const processedTags = new WeakSet();
    async function runOmniScripts() {
        const connects = document.querySelectorAll('connect');
        for (let tag of connects) {
            if (processedTags.has(tag)) continue;
            processedTags.add(tag);
            let source;
            if (tag.hasAttribute('src')) {
                const response = await fetch(tag.getAttribute('src'));
                source = await response.text();
            } else {
                source = tag.textContent;
            }
            const jsCode = compileOmniScript(source);
            try {
                eval(jsCode);
            } catch(e) {
                console.error('[Flux] Execution error:', e);
                console.error('Generated JS:', jsCode);
            }
        }
    }

    // Run when DOM ready and watch for dynamically added <connect> tags
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runOmniScripts);
    } else {
        runOmniScripts();
    }
    const observer = new MutationObserver(() => runOmniScripts());
    observer.observe(document.body, { childList: true, subtree: true });

    // ========== 7. Expose Public API ==========
    window.setPreviewTarget = setPreviewTarget;
    window.render = render;
    window.display = display;
    window.listen = listen;
    window.style = style;
})();
