'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var EventEmitter = require('events');
var glob = require('glob');
var Promise$1 = require('bluebird');
var fs = require('fs');
var path = require('path');
var sax = require('sax');
var htmlmin = require('html-minifier');

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

function dashCamel(value) {
    return String(value).replace(/(^|-)(\w|$)/g, (full, dash, c) => c.toUpperCase());
}

class Module {
    static fileNameToModuleName(fileName) {
        return dashCamel(path.parse(fileName).name);
    }
    constructor(fileName, style, script, template) {
        this._fileName = fileName;
        this._name = Module.fileNameToModuleName(fileName);
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

class Parser {
    constructor(library, fileName) {
        this._delegate = null;
        this._delegates = {};
        this._style = "";
        this._script = "";
        this._template = null;
        this._promise = new Promise$1((resolve$$1, reject) => {
            const parser = sax.createStream(true, {
                trim: false,
                normalize: false,
                lowercase: false,
                xmlns: false,
                position: true,
            });
            parser.on("error", (error) => { this.onError(error); reject(error); });
            parser.on("opentag", (tag) => this.onOpenTag(tag));
            parser.on("closetag", (tagName) => this.onCloseTag(tagName));
            parser.on("text", (text) => this.onText(text));
            parser.on("end", () => { this.onEnd(); resolve$$1(new Module(fileName, this._style, this._script, this._template || noop)); });
            const file = fs.createReadStream(path.resolve(fileName));
            // Write the root tag to the parser
            parser.write("<root>", "utf8");
            // When the file is closed (after being read), postfix the closing root tag
            file.on("close", function () {
                // End the root tag
                parser.write("</root>", "utf8");
                parser.end();
            });
            // Pipe the contents of the file through the parser
            file.pipe(parser, { end: false });
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
        process.exit();
    }
    onText(text) {
        if (this._delegate) {
            this._delegate.onText(this, text);
        }
    }
    onOpenTag(tag) {
        if (!this._delegate) {
            if (tag.name in this._delegates) {
                this._delegate = new this._delegates[tag.name]();
            }
        }
        if (this._delegate) {
            this._delegate.onOpenTag(this, tag);
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
    onText(parser, text) {
        if (this._stack != 1) {
            return;
        }
        this._contents += text;
    }
    onOpenTag(parser, tag) {
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
    onText(parser, text) {
        if (this._stack != 1) {
            return;
        }
        this._contents += text;
    }
    onOpenTag(parser, tag) {
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

const VALUE_OPEN = "{{";
const VALUE_CLOSE = "}}";
const CONTROL_OPEN = "{#";
const CONTROL_CLOSE = "#}";
class TemplateDelegate {
    constructor() {
        this._stack = 0;
        this._closeTag = true;
        this._ignore = false;
        this._parsed = "var $buf=[];with($locals=$locals||{}){$buf.push(`";
    }
    onText(parser, text) {
        if (!this._ignore) {
            this._parsed += this.parseText(text, escapeNone);
        }
    }
    onOpenTag(parser, tag) {
        ++this._stack;
        if (this._stack > 1) {
            this._closeTag = !tag.isSelfClosing;
            const c = tag.name.charAt(0);
            if (c != c.toUpperCase()) {
                let text = "<" + escapeXml(tag.name);
                for (let attribute in tag.attributes) {
                    text += " " + escapeTmpl(escapeXml(attribute)) + "=\"" + this.parseText(tag.attributes[attribute], escapeXml) + "\"";
                }
                if (tag.isSelfClosing) {
                    text += "/>";
                }
                else {
                    text += ">";
                }
                this._parsed += text;
            }
            else {
                if (tag.name === "Styles") {
                    this._ignore = true;
                    this._parsed += "</Styles/>";
                }
                else if (tag.name === "Scripts") {
                    this._ignore = true;
                    this._parsed += "</Scripts/>";
                }
                else if (tag.name === "Children") {
                    this._ignore = true;
                    this._parsed += "`,$children(),`";
                }
                else {
                    this._parsed += "`,$ins(`" + escapeTmpl(tag.name) + "`,{";
                    for (let attribute in tag.attributes) {
                        this._parsed += "[`" + escapeTmpl(attribute) + "`]:" + this.parseAttribute(tag.attributes[attribute]) + ",";
                    }
                    this._parsed += "[`$children`]:function(){var $buf=[];$buf.push(`";
                }
            }
        }
    }
    onCloseTag(parser, tagName) {
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
            // console.log("TEMPLATE:", this._parsed);
            console.log();
            parser.appendTemplate(new Function("$esc", "$ins", "$locals", this._parsed));
            parser.changeDelegate(null);
        }
    }
    parseText(text, escape) {
        const length = text.length;
        let position = 0;
        let nextValue = nextIndexOf(VALUE_OPEN);
        let nextControl = nextIndexOf(CONTROL_OPEN);
        let result = "";
        while (nextValue < length || nextControl < length) {
            if (nextValue < nextControl) {
                result += escapeTmpl(escape(text.slice(position, nextValue)));
                position = nextValue + VALUE_OPEN.length;
                const end = nextIndexOf(VALUE_CLOSE);
                result += "`,$esc(" + text.slice(position, end) + "),`";
                position = end + VALUE_CLOSE.length;
                nextValue = nextIndexOf(VALUE_OPEN);
            }
            else {
                result += escapeTmpl(escape(text.slice(position, nextControl)));
                position = nextControl + CONTROL_OPEN.length;
                const end = nextIndexOf(CONTROL_CLOSE);
                result += "`);" + text.slice(position, end) + ";$buf.push(`";
                position = end + CONTROL_CLOSE.length;
                nextControl = nextIndexOf(CONTROL_OPEN);
            }
        }
        result += escapeTmpl(text.slice(position));
        return result;
        function nextIndexOf(substring) {
            const result = text.indexOf(substring, position);
            return result < 0 ? length : result;
        }
    }
    parseAttribute(text) {
        const length = text.length;
        let position = 0;
        let nextValue = nextIndexOf(VALUE_OPEN);
        let result = "";
        // Special case -> passing (only) a value
        if (nextValue === 0 && nextIndexOf(VALUE_CLOSE) === length - VALUE_CLOSE.length) {
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

class DefaultParser extends Parser {
    constructor(library, fileName) {
        super(library, fileName);
        this.addTagDelegate("style", StyleDelegate);
        this.addTagDelegate("script", ScriptDelegate);
        this.addTagDelegate("template", TemplateDelegate);
    }
}

const globp = Promise$1.promisify(glob);
class Library extends EventEmitter {
    constructor(globPattern, options) {
        super();
        this._modules = {};
        const ParserClass = (options && options.parser) || DefaultParser;
        globp(globPattern)
            .then((files) => {
            return Promise$1.all(files.map((filePath) => {
                const parser = new ParserClass(this, filePath);
                return parser.promise;
            }));
        })
            .then((modules) => {
            modules.forEach((module) => {
                this._modules[module.name] = module;
            });
            this.emit("parse");
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
}

class Application extends EventEmitter {
    constructor(library, fileName, options) {
        super();
        // Set default options
        options = options || {};
        options.escape = options.escape || escapeXml;
        options.minify = options.minify || false;
        options.doctype = options.doctype !== false;
        this._library = library;
        this._fileName = fileName;
        this._name = Module.fileNameToModuleName(fileName);
        const update = () => {
            const renderFns = this._library.getRenderFunctions(options.escape, insert);
            const included = {};
            let style = "";
            let script = "";
            let output = insert(this._name, {});
            output = output.replace("</Styles/>", "<style>" + style + "</style>");
            output = output.replace("</Scripts/>", "<script>" + script + "</script>");
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
        library.on("parse", update);
    }
}

exports.Library = Library;
exports.Application = Application;
