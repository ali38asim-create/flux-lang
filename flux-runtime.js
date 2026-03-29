// fluxruntime.js - OmniScript runtime v2.0 with component system
(function() {
    // --- Keyword mapping (same as before) ---
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
        // New: component keyword mapping
        'component': 'function' // component is treated as a special function
    };

    // Compiler (same as before, but now also transforms component blocks)
    function compileOmniScript(source) {
        // Replace keywords
        let jsCode = source;
        for (let [omni, std] of Object.entries(keywordMap)) {
            const regex = new RegExp(`\\b${omni}\\b`, 'g');
            jsCode = jsCode.replace(regex, std);
        }

        // Transform component syntax: component Name(props) { ... } -> function Name(props) { return Component(...); }
        // We'll detect lines starting with "component" and convert them to a wrapped function that returns a component object.
        // This is a simplistic transformation; in a real parser we'd do AST manipulation.
        const lines = jsCode.split('\n');
        const outputLines = [];
        for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('component ') && trimmed.includes('(')) {
                // Convert to: function Name(props) { return __flux_component(function() { ... }, props); }
                // We'll just replace 'component' with 'function' and let the runtime handle component creation.
                line = line.replace(/^component\s+/, 'function ');
            }
            outputLines.push(line);
        }
        jsCode = outputLines.join('\n');

        // Indentation to braces conversion (same as before)
        // ... (rest of the compile function unchanged) ...
        // (We'll keep the existing indentation conversion)
        // For brevity, I'll reuse the same function but it's the same as earlier.
        // Actually, we need the full compile function here. I'll copy from previous version.
        const lines2 = jsCode.split('\n');
        const output = [];
        const indentStack = [0];
        let blockStack = [];

        for (let i = 0; i < lines2.length; i++) {
            let line = lines2[i];
            if (line.trim() === '') {
                output.push('');
                continue;
            }

            const indent = line.search(/\S|$/);
            const trimmedLine = line.trim();

            if (trimmedLine === '}' || trimmedLine === '};') {
                indentStack.pop();
                blockStack.pop();
                output.push(line);
                continue;
            }

            if (indent > indentStack[indentStack.length - 1]) {
                indentStack.push(indent);
                const lastLine = output[output.length - 1];
                if (lastLine && !lastLine.endsWith('{')) {
                    output.push('{');
                    blockStack.push('{');
                }
                output.push(line);
            } else if (indent < indentStack[indentStack.length - 1]) {
                while (indent < indentStack[indentStack.length - 1]) {
                    indentStack.pop();
                    const closed = blockStack.pop();
                    if (closed === '{') output.push('}');
                }
                output.push(line);
            } else {
                output.push(line);
            }
        }

        while (indentStack.length > 1) {
            output.push('}');
            indentStack.pop();
        }

        return output.join('\n');
    }

    // --- Component System ---
    const componentRegistry = new Map();
    let currentComponentId = 0;

    function createComponent(renderFn, props = {}) {
        const id = currentComponentId++;
        const state = {};
        const refs = {};
        let mounted = false;
        let domNode = null;

        // Scoped CSS storage for this component
        let scopedStyles = null;

        const component = {
            id,
            props,
            state,
            refs,
            mount(target) {
                if (mounted) return;
                mounted = true;
                domNode = document.createElement('div');
                target.appendChild(domNode);
                this.update();
            },
            update() {
                if (!domNode) return;
                // Render with current state and props
                const html = renderFn.call(component);
                domNode.innerHTML = html;
                // Apply scoped CSS
                if (scopedStyles) {
                    const styleTag = document.createElement('style');
                    styleTag.textContent = scopedStyles;
                    domNode.appendChild(styleTag);
                }
                // Reattach event handlers
                const allElements = domNode.querySelectorAll('*');
                for (let el of allElements) {
                    for (let attr of el.attributes) {
                        if (attr.name.startsWith('on')) {
                            const eventName = attr.name.slice(2);
                            const handlerName = attr.value;
                            if (typeof window[handlerName] === 'function') {
                                el.removeAttribute(attr.name);
                                el.addEventListener(eventName, window[handlerName].bind(component));
                            }
                        }
                        if (attr.name === 'bind') {
                            const binding = attr.value;
                            const parts = binding.split(':');
                            const targetProp = parts[0];
                            const sourceVar = parts[1];
                            el.removeAttribute(attr.name);
                            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                                el.value = component.state[sourceVar];
                                el.addEventListener('input', (e) => {
                                    component.state[sourceVar] = e.target.value;
                                    component.update();
                                });
                            }
                        }
                    }
                }
            },
            setState(newState) {
                Object.assign(state, newState);
                this.update();
            },
            setScopedCSS(css) {
                scopedStyles = css;
            }
        };
        return component;
    }

    // Register a component function (to be called by transformed component syntax)
    window.__flux_component = function(renderFn, props) {
        return createComponent(renderFn, props);
    };

    // --- Enhanced render function with component support ---
    let previewTarget = null;
    let rootComponents = [];

    function setPreviewTarget(selector) {
        previewTarget = document.querySelector(selector);
        if (!previewTarget) console.warn(`Preview target ${selector} not found`);
    }

    function render(template, data = {}) {
        if (!previewTarget) {
            console.warn('No preview target. Use setPreviewTarget("#id")');
            return;
        }
        // Simple variable interpolation
        let html = template.replace(/\{([^}]+)\}/g, (match, expr) => {
            try {
                return eval(expr);
            } catch(e) {
                console.warn(`Cannot evaluate ${expr}`, e);
                return match;
            }
        });
        previewTarget.innerHTML = html;
        // Attach event handlers and bindings
        const allElements = previewTarget.querySelectorAll('*');
        for (let el of allElements) {
            for (let attr of el.attributes) {
                if (attr.name.startsWith('on')) {
                    const eventName = attr.name.slice(2);
                    const handlerName = attr.value;
                    if (typeof window[handlerName] === 'function') {
                        el.removeAttribute(attr.name);
                        el.addEventListener(eventName, window[handlerName]);
                    }
                }
                if (attr.name === 'bind') {
                    const binding = attr.value;
                    const [targetProp, sourceVar] = binding.split(':');
                    el.removeAttribute(attr.name);
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        const value = eval(sourceVar);
                        el.value = value;
                        el.addEventListener('input', (e) => {
                            // Update the variable in global scope (simplistic)
                            window[sourceVar] = e.target.value;
                        });
                    }
                }
            }
        }
    }

    function display(element) {
        if (!previewTarget) {
            console.warn('No preview target');
            return;
        }
        previewTarget.appendChild(element);
    }

    function listen(event, target, handler) {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (el) el.addEventListener(event, handler);
    }

    function style(selector, rules, scope = null) {
        let css = `${selector} { ${rules} }`;
        if (scope) {
            // Scope CSS to a component (by adding data-attribute)
            const attr = `data-flux-${scope}`;
            css = `${selector}[${attr}], ${selector} .${attr} { ${rules} }`;
        }
        const styleTag = document.createElement('style');
        styleTag.textContent = css;
        document.head.appendChild(styleTag);
    }

    // --- Module loader (unchanged) ---
    async function loadModule(url) {
        if (!url.includes('.')) url += '.flux';
        const response = await fetch(url);
        const source = await response.text();
        const jsCode = compileOmniScript(source);
        const moduleExports = {};
        const moduleFunc = new Function('exports', 'require', jsCode);
        moduleFunc(moduleExports, loadModule);
        return moduleExports;
    }

    window.gather = async function(moduleName) {
        return await loadModule(moduleName);
    };

    // --- Execute scripts ---
    function runOmniScripts() {
        const scripts = document.querySelectorAll('script[type="text/omnilingua"]');
        scripts.forEach(async (script) => {
            let source;
            if (script.src) {
                const response = await fetch(script.src);
                source = await response.text();
            } else {
                source = script.textContent;
            }
            const jsCode = compileOmniScript(source);
            eval(jsCode);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runOmniScripts);
    } else {
        runOmniScripts();
    }

    // Expose additional helpers
    window.setPreviewTarget = setPreviewTarget;
    window.render = render;
    window.display = display;
    window.listen = listen;
    window.style = style;
})();
