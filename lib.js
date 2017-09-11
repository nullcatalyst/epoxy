'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var EventEmitter = require('events');
var Promise$1 = require('bluebird');
var chokidar = require('chokidar');
var globby = _interopDefault(require('globby'));
var path = require('path');
var fs = require('fs');
var html = require('htmlparser2');
var htmlmin = require('html-minifier');

function dashCamel(value) {
    return String(value).replace(/(^|-)(\w|$)/g, (full, dash, c) => c.toUpperCase());
}
function file2tag(fileName) {
    return dashCamel(path.parse(fileName).name);
}

class Module {
    constructor(fileName, style, script, template) {
        this._fileName = fileName;
        this._name = file2tag(fileName);
        this._style = style;
        this._script = script;
        this._template = template;
    }
    get fileName() {
        return this._fileName;
    }
    get name() {
        return this._name;
    }
    get style() {
        return this._style;
    }
    get script() {
        return this._script;
    }
    get template() {
        return this._template;
    }
}

class Parser$1 {
    constructor(library, fileName) {
        this._delegate = null;
        this._delegates = {};
        this._style = "";
        this._script = "";
        this._template = null;
        this._promise = new Promise$1((resolve$$1, reject) => {
            const parser = new html.Parser({
                onerror: (error) => {
                    this.onError(error);
                    reject(error);
                },
                onopentag: (tagName, attributes, ...rest) => {
                    this.onOpenTag(tagName, attributes);
                },
                onclosetag: (tagName) => {
                    this.onCloseTag(tagName);
                },
                ontext: (text) => {
                    this.onText(text);
                },
                onend: () => {
                    this.onEnd();
                    resolve$$1(new Module(fileName, this._style, this._script, this._template || noop));
                },
            }, {
                xmlMode: false,
                decodeEntities: false,
                lowerCaseTags: false,
                lowerCaseAttributeNames: false,
                recognizeCDATA: true,
                recognizeSelfClosing: true,
            });
            const file = fs.createReadStream(path.resolve(fileName))
                .on("error", (error) => {
                reject(error);
            })
                .on("data", (data) => {
                parser.write(data);
            })
                .on("close", () => {
                parser.end();
            });
        });
    }
    get promise() {
        return this._promise;
    }
    changeDelegate(delegate) {
        this._delegate = delegate;
    }
    addTagDelegate(tagName, delegateClass) {
        this._delegates[tagName] = delegateClass;
    }
    appendStyle(style) {
        this._style += style;
    }
    appendScript(script) {
        this._script += script;
    }
    appendTemplate(template) {
        if (this._template) {
            const prev = this._template;
            this._template = ($esc, $ins, $locals) => prev($esc, $ins, $locals) + template($esc, $ins, $locals);
        }
        else {
            this._template = template;
        }
    }
    onError(error) {
        console.error(error);
        if (this._delegate) {
            this._delegate.onError(this, error);
        }
    }
    onText(text) {
        if (this._delegate) {
            this._delegate.onText(this, text);
        }
    }
    onOpenTag(tagName, attributes) {
        if (!this._delegate) {
            if (tagName in this._delegates) {
                this._delegate = new this._delegates[tagName]();
            }
        }
        if (this._delegate) {
            this._delegate.onOpenTag(this, tagName, attributes);
        }
    }
    onCloseTag(tagName) {
        if (this._delegate) {
            this._delegate.onCloseTag(this, tagName);
        }
    }
    onEnd() {
    }
}
function noop() {
    return "";
}

class StyleDelegate {
    constructor() {
        this._stack = 0;
        this._contents = "";
    }
    onError(parser, error) {
    }
    onText(parser, text) {
        if (this._stack != 1) {
            return;
        }
        this._contents += text;
    }
    onOpenTag(parser, tagName, attributes) {
        ++this._stack;
    }
    onCloseTag(parser, tagName) {
        --this._stack;
        if (this._stack == 0) {
            parser.appendStyle(this._contents);
            parser.changeDelegate(null);
        }
    }
}

class ScriptDelegate {
    constructor() {
        this._stack = 0;
        this._contents = "";
    }
    onError(parser, error) {
    }
    onText(parser, text) {
        if (this._stack != 1) {
            return;
        }
        this._contents += text;
    }
    onOpenTag(parser, tagName, attributes) {
        ++this._stack;
    }
    onCloseTag(parser, tagName) {
        --this._stack;
        if (this._stack == 0) {
            parser.appendScript(this._contents);
            parser.changeDelegate(null);
        }
    }
}

function escapeNone(value) {
    return String(value);
}
const XML = {
    ">": "&gt;",
    "<": "&lt;",
    "'": "&apos;",
    '"': "&quot;",
    "&": "&amp;",
};
function escapeXml(value) {
    return String(value).replace(/[&"<>\']/g, (c) => (c in XML ? XML[c] : c));
}
const TMPL = {
    "`": "\\`",
    "\\": "\\\\",
    "$": "\\$",
};
function escapeTmpl(value) {
    return String(value).replace(/[`\\$]/g, (c) => (c in TMPL ? TMPL[c] : c));
}

const VALUE = "value";
const VALUE_OPEN = "{{";
const VALUE_CLOSE = "}}";
const RAW = "raw";
const RAW_OPEN = "{=";
const RAW_CLOSE = "=}";
const CODE = "code";
const CODE_OPEN = "{#";
const CODE_CLOSE = "#}";
class TemplateDelegate {
    constructor() {
        this._stack = 0;
        this._closeTag = true;
        this._ignore = false;
        this._parsed = "var $buf=[];with($locals=$locals||{}){$buf.push(`";
    }
    onError(parser, error) {
    }
    onText(parser, text) {
        if (!this._ignore) {
            this._parsed += this.parseText(text, escapeNone);
        }
    }
    onOpenTag(parser, tagName, attributes) {
        // console.log("OPENTAG:", tagName);
        ++this._stack;
        if (this._stack > 1) {
            const c = tagName.charAt(0);
            if (c != c.toUpperCase()) {
                let text = "<" + escapeXml(tagName);
                for (let attribute in attributes) {
                    text += " " + escapeTmpl(escapeXml(attribute));
                    if (attributes[attribute]) {
                        text += "=\"" + this.parseText(attributes[attribute], escapeXml) + "\"";
                    }
                }
                this._parsed += text + ">";
            }
            else {
                if (tagName === "Styles") {
                    this._ignore = true;
                    this._parsed += "</Styles" + toAttributeString(attributes) + "/>";
                }
                else if (tagName === "Scripts") {
                    this._ignore = true;
                    this._parsed += "</Scripts" + toAttributeString(attributes) + "/>";
                }
                else if (tagName === "Children") {
                    this._ignore = true;
                    this._parsed += "`,$children(),`";
                }
                else {
                    this._parsed += "`,$ins(`" + escapeTmpl(tagName) + "`,{";
                    for (let attribute in attributes) {
                        this._parsed += this.parseAttribute(attribute, attributes[attribute]);
                    }
                    this._parsed += "[`$children`]:function(){var $buf=[];$buf.push(`";
                }
            }
        }
    }
    onCloseTag(parser, tagName) {
        // console.log("CLOSETAG:", tagName);
        if (this._stack > 1) {
            const c = tagName.charAt(0);
            if (c != c.toUpperCase()) {
                if (this._closeTag) {
                    this._parsed += "</" + escapeXml(tagName) + ">";
                }
            }
            else {
                if (tagName === "Styles") {
                    this._ignore = false;
                }
                else if (tagName === "Scripts") {
                    this._ignore = false;
                }
                else if (tagName === "Children") {
                    this._ignore = false;
                }
                else {
                    this._parsed += "`);return $buf.join(``);}}),`";
                }
            }
            this._closeTag = true;
        }
        --this._stack;
        if (this._stack == 0) {
            this._parsed += "`)}return $buf.join(``);";
            // console.log("fn->", this._parsed);
            parser.appendTemplate(new Function("$esc", "$ins", "$locals", this._parsed));
            parser.changeDelegate(null);
        }
    }
    parseText(text, escape) {
        const length = text.length;
        let position = 0;
        let nextValue = nextIndexOf(VALUE_OPEN);
        let nextRaw = nextIndexOf(RAW_OPEN);
        let nextCode = nextIndexOf(CODE_OPEN);
        let result = "";
        while (hasNext()) {
            switch (nextType()) {
                case VALUE: {
                    result += escapeTmpl(escape(text.slice(position, nextValue)));
                    position = nextValue + VALUE_OPEN.length;
                    const end = nextIndexOf(VALUE_CLOSE);
                    result += "`,$esc(" + text.slice(position, end) + "),`";
                    position = end + VALUE_CLOSE.length;
                    nextValue = nextIndexOf(VALUE_OPEN);
                    break;
                }
                case RAW: {
                    result += escapeTmpl(escape(text.slice(position, nextRaw)));
                    position = nextRaw + RAW_OPEN.length;
                    const end = nextIndexOf(RAW_CLOSE);
                    result += "`,String(" + text.slice(position, end) + "),`";
                    position = end + RAW_OPEN.length;
                    nextRaw = nextIndexOf(RAW_OPEN);
                    break;
                }
                case CODE: {
                    result += escapeTmpl(escape(text.slice(position, nextCode)));
                    position = nextCode + CODE_OPEN.length;
                    const end = nextIndexOf(CODE_CLOSE);
                    result += "`);" + text.slice(position, end) + ";$buf.push(`";
                    position = end + CODE_CLOSE.length;
                    nextCode = nextIndexOf(CODE_OPEN);
                    break;
                }
                default: {
                    console.error("");
                    break;
                }
            }
        }
        result += escapeTmpl(text.slice(position));
        return result;
        function nextIndexOf(substring) {
            const result = text.indexOf(substring, position);
            return result < 0 ? length : result;
        }
        function hasNext() {
            return nextValue < length || nextRaw < length || nextCode < length;
        }
        function nextType() {
            if (nextValue < nextCode || nextRaw < nextCode) {
                if (nextValue < nextRaw) {
                    return VALUE;
                }
                else {
                    return RAW;
                }
            }
            else {
                return CODE;
            }
        }
    }
    parseAttribute(name, value) {
        if (isStringSurrounded(name, VALUE_OPEN, VALUE_CLOSE) && value === "") {
            return "..." + name.slice(VALUE_OPEN.length, -VALUE_CLOSE.length) + ",";
        }
        return "[`" + escapeTmpl(name) + "`]:" + this.parseAttributeValue(value) + ",";
    }
    parseAttributeValue(text) {
        const length = text.length;
        let position = 0;
        let nextValue = nextIndexOf(VALUE_OPEN);
        let result = "";
        // Special case -> passing (only) a value
        if (isStringSurrounded(text, VALUE_OPEN, VALUE_CLOSE)) {
            return "(" + text.slice(VALUE_OPEN.length, -VALUE_CLOSE.length) + ")";
        }
        while (nextValue < length) {
            result += escapeTmpl(escapeXml(text.slice(position, nextValue)));
            position = nextValue + VALUE_OPEN.length;
            const end = nextIndexOf(VALUE_CLOSE);
            result += "`+$esc(" + text.slice(position, end) + ")+`";
            position = end + VALUE_CLOSE.length;
            nextValue = nextIndexOf(VALUE_OPEN);
        }
        result += escapeTmpl(text.slice(position));
        return "`" + result + "`";
        function nextIndexOf(substring) {
            const result = text.indexOf(substring, position);
            return result < 0 ? length : result;
        }
    }
}
function isStringSurrounded(test, prefix, postfix) {
    return test.startsWith(prefix) && test.endsWith(postfix);
}
function toAttributeString(attributes) {
    let result = "";
    if (attributes) {
        for (let attribute in attributes) {
            result += " " + attribute;
            if (attributes[attribute]) {
                result += "=\"" + attributes[attribute] + "\"";
            }
        }
    }
    return result;
}

class DefaultParser extends Parser$1 {
    constructor(library, fileName) {
        super(library, fileName);
        this.addTagDelegate("style", StyleDelegate);
        this.addTagDelegate("script", ScriptDelegate);
        this.addTagDelegate("template", TemplateDelegate);
    }
}

class Library extends EventEmitter {
    constructor(options) {
        super();
        // Set default options
        this._options = this.getDefaultOptions(options);
        this._modules = {};
        this._watcher = null;
        this.setMaxListeners(Infinity);
        this.start();
    }
    getDefaultOptions(options) {
        return {
            parser: options && options.parser || DefaultParser,
            sources: options && options.sources || [],
            watch: options && options.watch || false,
        };
    }
    start() {
        this.stop();
        globby(this._options.sources)
            .then((files) => {
            return Promise$1.all(files.map((filePath) => {
                const parser = new this._options.parser(this, filePath);
                return parser.promise.catch((error) => {
                    this.emit("error", error, filePath);
                });
            }));
        })
            .then((modules) => {
            modules.forEach((module) => {
                this._modules[module.name] = module;
            });
            this.emit("done");
            if (this._options.watch) {
                const update = (fileName) => {
                    const parser = new this._options.parser(this, fileName);
                    parser.promise
                        .then((module) => {
                        this._modules[module.name] = module;
                        this.emit("update", module);
                    })
                        .catch((error) => {
                        this.emit("error", error, fileName);
                    });
                };
                const remove = (fileName) => {
                    delete this._modules[file2tag(fileName)];
                };
                this._watcher = chokidar.watch(this._options.sources, { ignoreInitial: true })
                    .on("add", update)
                    .on("change", update)
                    .on("unlink", remove)
                    .setMaxListeners(Infinity);
            }
        });
    }
    getRenderFunctions($esc, $ins, addHandlers) {
        const renderFns = {};
        Object.entries(this._modules)
            .forEach(([name, module]) => {
            renderFns[name] = [module, module.template.bind(null, $esc, $ins)];
        });
        return renderFns;
    }
    stop() {
        if (this._watcher) {
            this._watcher.close();
            this._watcher = null;
        }
    }
}

class Application extends EventEmitter {
    constructor(library, fileName, options) {
        super();
        // Set default options
        options = options || {};
        options.escape = options.escape || escapeXml;
        options.minify = options.minify || false;
        options.doctype = options.doctype !== false;
        options.data = options.data || {};
        this._library = library;
        this._fileName = fileName;
        this._name = file2tag(fileName);
        const update = () => {
            const renderFns = this._library.getRenderFunctions(options.escape, insert);
            const included = {};
            let style = "";
            let script = "";
            let output = insert(this._name, options.data);
            output = output.replace(/<\/Styles(.*)\/>/g, "<style$1>" + style.replace("$", () => "\\$") + "</style>");
            output = output.replace(/<\/Scripts(.*)\/>/g, "<script$1>" + script.replace("$", () => "\\$") + "</script>");
            if (options.minify) {
                output = htmlmin.minify(output, {
                    collapseBooleanAttributes: true,
                    collapseWhitespace: true,
                    decodeEntities: true,
                    minifyCSS: true,
                    minifyJS: true,
                    quoteCharacter: '"',
                    removeComments: true,
                    removeRedundantAttributes: true,
                    removeScriptTypeAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    sortAttributes: true,
                    sortClassName: true,
                    useShortDoctype: true,
                });
            }
            if (options.doctype) {
                output = "<!doctype html>" + output;
            }
            this.emit("output", output);
            function insert($name, $locals) {
                const [module, render] = renderFns[$name];
                if (!included[$name]) {
                    included[$name] = true;
                    style += module.style;
                    script += module.script;
                }
                return render($locals);
            }
        };
        library.on("done", update)
            .on("update", update);
        this.stop = () => {
            library.removeListener("done", update)
                .removeListener("update", update);
        };
    }
}

exports.Library = Library;
exports.Application = Application;
