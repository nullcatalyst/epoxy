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
var uglify = require('uglify-js');

function emptyString() { return ""; }

function dashCamel(value) {
    return String(value).replace(/(^|-)(\w|$)/g, (full, dash, c) => c.toUpperCase());
}
function file2tag(fileName) {
    return dashCamel(path.parse(fileName).name);
}

class Module {
    constructor(fileName, name, style, script, template) {
        this._fileName = fileName;
        this._name = name;
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

/// START TEMPORARY HACK
function whitespace(c) {
    return c === " " || c === "\n" || c === "\t" || c === "\f" || c === "\r";
}
html.Tokenizer.prototype._stateBeforeTagName = function (c) {
    if (c === "%") {
        this._state = 0; // TEXT;
    }
    else if (c === "/") {
        this._state = 4; // BEFORE_CLOSING_TAG_NAME;
    }
    else if (c === "<") {
        this._cbs.ontext(this._getSection());
        this._sectionStart = this._index;
    }
    else if (c === ">" || this._special !== 0 /* SPECIAL_NONE */ || whitespace(c)) {
        this._state = 0; // TEXT;
    }
    else if (c === "!") {
        this._state = 14; // BEFORE_DECLARATION;
        this._sectionStart = this._index + 1;
    }
    else if (c === "?") {
        this._state = 16; // IN_PROCESSING_INSTRUCTION;
        this._sectionStart = this._index + 1;
    }
    else {
        this._state = (!this._xmlMode && (c === "s" || c === "S")) ? 30 /* BEFORE_SPECIAL */ : 2 /* IN_TAG_NAME */;
        this._sectionStart = this._index;
    }
};
/// END TEMPORARY HACK
class Parser$1 {
    constructor(library, fileName) {
        this._delegate = null;
        this._delegates = {};
        this._name = file2tag(fileName);
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
                    resolve$$1(new Module(fileName, this._name, this._style, this._script, this._template || emptyString));
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
    changeName(name) {
        this._name = name;
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

class NameDelegate {
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
            parser.changeName(this._contents);
            parser.changeDelegate(null);
        }
    }
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
const HTML = "html";
const HTML_OPEN = "<%=";
const HTML_CLOSE = "%>";
const CODE = "code";
const CODE_OPEN = "<%";
const CODE_CLOSE = "%>";
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
            this._parsed += parseText(text, escapeNone);
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
                        text += "=\"" + parseText(attributes[attribute], escapeXml) + "\"";
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
                        this._parsed += parseAttribute(attribute, attributes[attribute]);
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
            let templateFn = emptyString;
            try {
                templateFn = new Function("$esc", "$ins", "$locals", this._parsed);
            }
            catch (error) {
                console.error(error);
                console.log(this._parsed);
            }
            parser.appendTemplate(templateFn);
            parser.changeDelegate(null);
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
function parseAttribute(name, value) {
    if (isStringSurrounded(name, VALUE_OPEN, VALUE_CLOSE) && value === "") {
        return "..." + name.slice(VALUE_OPEN.length, -VALUE_CLOSE.length) + ",";
    }
    return "[`" + escapeTmpl(name) + "`]:" + parseAttributeValue(value) + ",";
}
function parseAttributeValue(text) {
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
function parseText(text, escape) {
    const length = text.length;
    let position = 0;
    let nextValue = nextIndexOf(VALUE_OPEN);
    let nextHtml = nextIndexOf(HTML_OPEN);
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
                break;
            }
            case HTML: {
                result += escapeTmpl(escape(text.slice(position, nextHtml)));
                position = nextHtml + HTML_OPEN.length;
                const end = nextIndexOf(HTML_CLOSE);
                result += "`,String(" + text.slice(position, end) + "),`";
                position = end + HTML_CLOSE.length;
                break;
            }
            case CODE: {
                result += escapeTmpl(escape(text.slice(position, nextCode)));
                position = nextCode + CODE_OPEN.length;
                const end = nextIndexOf(CODE_CLOSE);
                result += "`);" + text.slice(position, end) + ";$buf.push(`";
                position = end + CODE_CLOSE.length;
                break;
            }
            default: {
                console.error("");
                break;
            }
        }
        nextValue = nextIndexOf(VALUE_OPEN);
        nextHtml = nextIndexOf(HTML_OPEN);
        nextCode = nextIndexOf(CODE_OPEN);
    }
    result += escapeTmpl(text.slice(position));
    return result;
    function nextIndexOf(substring) {
        const result = text.indexOf(substring, position);
        return result < 0 ? length : result;
    }
    function hasNext() {
        return nextValue < length || nextHtml < length || nextCode < length;
    }
    function nextType() {
        if (nextValue <= nextHtml && nextValue <= nextCode) {
            return VALUE;
        }
        else if (nextHtml <= nextCode) {
            return HTML;
        }
        else {
            return CODE;
        }
    }
}

class DefaultParser extends Parser$1 {
    constructor(library, fileName) {
        super(library, fileName);
        this.addTagDelegate("name", NameDelegate);
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
                return parser.promise
                    .catch((error) => {
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
            let output = "";
            try {
                output = insert(this._name, options.data);
            }
            catch (error) {
                console.error(error);
            }
            if (style && (style = style.trim())) {
                output = output.replace(/<\/Styles(.*)\/>/g, "<style$1>" + style.replace("$", () => "\\$") + "</style>");
            }
            else {
                output = output.replace(/<\/Styles(.*)\/>/g, "");
            }
            if (script && (script = script.trim())) {
                output = output.replace(/<\/Scripts(.*)\/>/g, "<script$1>" + script.replace("$", () => "\\$") + "</script>");
            }
            else {
                output = output.replace(/<\/Scripts(.*)\/>/g, "");
            }
            if (options.minify) {
                output = htmlmin.minify(output, {
                    collapseBooleanAttributes: true,
                    collapseWhitespace: true,
                    decodeEntities: true,
                    minifyCSS: true,
                    minifyJS: uglify.minify,
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
                if (!($name in renderFns)) {
                    throw new Error(`No template found for name "${$name}"`);
                }
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
