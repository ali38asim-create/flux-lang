// fluxruntime.js - OmniScript runtime v2.1 (fixed indentation handling)
(function() {
    // --- Keyword mapping ---
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
        'component': 'function' // treat component as function
    };

    // Robust indentation to braces conversion
    function compileOmniScript(source) {
        // Replace keywords
        let jsCode = source;
        for (let [omni, std] of Object.entries(keywordMap)) {
            const regex = new RegExp(`\\b${omni}\\b`, 'g');
            jsCode = jsCode.replace(regex, std);
        }

        // Convert component keyword: component Name(props) -> function Name(props)
        // This is a simple substitution; we'll handle the component system later.
        jsCode = jsCode.replace(/^component\s+(\w+)\s*\(/gm, 'function $1(');

        // Split into lines for indentation conversion
        const lines = jsCode.split('\n');
        const output = [];
        const indentStack = [0]; // track indentation levels
        let pendingOpenBraces = 0; // handle multiple opens in one line

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.trim() === '') {
                output.push('');
                continue;
            }

            const indent = line.search(/\S|$/);
            const trimmed = line.trim();

            // Skip lines that are already braces (they are part of the output)
            if (trimmed === '}' || trimmed === '};') {
                // Already have braces, don't add more
                output.push(line);
                continue;
            }

            // Determine if the line introduces a block (ends with ':')
            const endsWithColon = /:\s*$/.test(trimmed);
            const isBlockStart = endsWithColon;

            // Adjust indentation
            if (indent > indentStack[indentStack.length - 1]) {
                // Indent increased: start a new block
                indentStack.push(indent);
                // Add opening brace before the line
                output.push('{');
                pendingOpenBraces++;
            } else if (indent < indentStack[indentStack.length - 1]) {
                // Indent decreased: close blocks
                while (indent < indentStack[indentStack.length - 1]) {
                    indentStack.pop();
                    output.push('}');
                }
            }

            // Remove trailing colon if present, but keep the rest
            let processedLine = line;
            if (endsWithColon) {
                processedLine = line.replace(/:\s*$/, '');
            }

            output.push(processedLine);
        }

        // Close any remaining blocks
        while (indentStack.length > 1) {
            output.push('}');
            indentStack.pop();
        }

        return output.join('\n');
    }

    // --- Component System (unchanged, but ensure functions are defined) ---
    const componentRegistry = new Map();
    let currentComponentId = 0;

    function createComponent(renderFn, props = {}) {
        const id = currentComponentId++;
        const state = {};
        const refs = {};
        let mounted = false;
        let domNode = null;
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
                const html = renderFn.call(component);
                domNode.innerHTML = html;
                if (scopedStyles) {
                    const styleTag = document.createElement('style');
                    styleTag.textContent = scopedStyles;
                    domNode.appendChild(styleTag);
                }
                // Reattach event handlers and bindings
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
                            const [targetProp, sourceVar] = attr.value.split(':');
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

    window.__flux_component = function(renderFn, props) {
        return createComponent(renderFn, props);
    };

    // --- Runtime helpers ---
    let previewTarget = null;

    function setPreviewTarget(selector) {
        previewTarget = document.querySelector(selector);
        if (!previewTarget) console.warn(`Preview target ${selector} not found`);
    }

    function render(template, data = {}) {
        if (!previewTarget) {
            console.warn('No preview target. Use setPreviewTarget("#id")');
            return;
        }
        let html = template.replace(/\{([^}]+)\}/g, (match, expr) => {
            try {
                return eval(expr);
            } catch(e) {
                console.warn(`Cannot evaluate ${expr}`, e);
                return match;
            }
        });
        previewTarget.innerHTML = html;

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
                    const [targetProp, sourceVar] = attr.value.split(':');
                    el.removeAttribute(attr.name);
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        const value = eval(sourceVar);
                        el.value = value;
                        el.addEventListener('input', (e) => {
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
            const attr = `data-flux-${scope}`;
            css = `${selector}[${attr}], ${selector} .${attr} { ${rules} }`;
        }
        const styleTag = document.createElement('style');
        styleTag.textContent = css;
        document.head.appendChild(styleTag);
    }

    // --- Module loader ---
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
            try {
                eval(jsCode);
            } catch(e) {
                console.error('Flux compilation error:', e);
                console.error('Generated JS:', jsCode);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runOmniScripts);
    } else {
        runOmniScripts();
    }

    window.setPreviewTarget = setPreviewTarget;
    window.render = render;
    window.display = display;
    window.listen = listen;
    window.style = style;
})();
