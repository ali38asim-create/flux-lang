// fluxruntime.js - OmniScript runtime v2.2 (robust indentation compiler)
(function() {
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

    function compileOmniScript(source) {
        // 1. Replace keywords
        let js = source;
        for (let [omni, std] of Object.entries(keywordMap)) {
            js = js.replace(new RegExp(`\\b${omni}\\b`, 'g'), std);
        }

        // 2. Convert 'component' to a function that returns a component
        js = js.replace(/^component\s+(\w+)\s*\(/gm, 'function $1(');

        // 3. Indentation to braces (more robust)
        const lines = js.split('\n');
        const out = [];
        let indentStack = [0];   // current indentation level (spaces count)
        let i = 0;
        while (i < lines.length) {
            let line = lines[i];
            if (line.trim() === '') {
                out.push('');
                i++;
                continue;
            }

            // Calculate indentation (number of leading spaces/tabs, tabs = 4 spaces)
            let indent = 0;
            for (let ch of line) {
                if (ch === ' ') indent++;
                else if (ch === '\t') indent += 4;
                else break;
            }

            const trimmed = line.trim();
            const currentIndent = indentStack[indentStack.length - 1];

            // Handle block end: when indentation decreases
            if (indent < currentIndent) {
                // Close one or more blocks
                while (indent < indentStack[indentStack.length - 1]) {
                    indentStack.pop();
                    out.push('}');
                }
                // After closing, we need to re-evaluate the same line because it might still need closing?
                // Actually, we should not push the line yet; continue loop without increment i
                continue;
            }

            // Handle block start: when indentation increases
            if (indent > currentIndent) {
                // Increase stack and add opening brace before the line
                indentStack.push(indent);
                out.push('{');
            }

            // Remove trailing colon if present (block indicator)
            let processed = line.replace(/:\s*$/, '');
            out.push(processed);
            i++;
        }

        // Close any remaining open blocks
        while (indentStack.length > 1) {
            out.push('}');
            indentStack.pop();
        }

        return out.join('\n');
    }

    // --- Component System (unchanged, but ensure it's complete) ---
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
                // attach events
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

    // --- Runtime API ---
    let previewTarget = null;
    function setPreviewTarget(selector) {
        previewTarget = document.querySelector(selector);
        if (!previewTarget) console.warn(`Target ${selector} not found`);
    }
    function render(template) {
        if (!previewTarget) { console.warn('No preview target'); return; }
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
    function display(el) { if (previewTarget) previewTarget.appendChild(el); }
    function listen(event, target, handler) {
        const t = typeof target === 'string' ? document.querySelector(target) : target;
        if (t) t.addEventListener(event, handler);
    }
    function style(selector, rules, scope) {
        let css = `${selector} { ${rules} }`;
        if (scope) css = `${selector}[data-flux-${scope}], ${selector} .data-flux-${scope} { ${rules} }`;
        const styleTag = document.createElement('style');
        styleTag.textContent = css;
        document.head.appendChild(styleTag);
    }

    // --- Module loader (simplified) ---
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

    // --- Execute all Flux scripts ---
    function runOmniScripts() {
        document.querySelectorAll('script[type="text/omnilingua"]').forEach(async script => {
            let src = script.src ? await (await fetch(script.src)).text() : script.textContent;
            const js = compileOmniScript(src);
            try {
                eval(js);
            } catch(e) {
                console.error('Flux compilation error:', e);
                console.error('Generated JS:\n', js);
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runOmniScripts);
    else runOmniScripts();

    window.setPreviewTarget = setPreviewTarget;
    window.render = render;
    window.display = display;
    window.listen = listen;
    window.style = style;
})();
