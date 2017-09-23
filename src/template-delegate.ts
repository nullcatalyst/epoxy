import { emptyString } from "./util";
import { Parser, ParserDelegate } from "./parser";
import { escapeNone, escapeXml, escapeTmpl } from "./escape";

const VALUE         = "value";
const VALUE_OPEN    = "{{";
const VALUE_CLOSE   = "}}";
const HTML          = "html";
const HTML_OPEN     = "<%=";
const HTML_CLOSE    = "%>";
const CODE          = "code";
const CODE_OPEN     = "<%";
const CODE_CLOSE    = "%>";

export class TemplateDelegate implements ParserDelegate {
    private _stack: number;
    private _closeTag: boolean;
    private _ignore: boolean;
    private _contents: string;
    private _parsed: string;

    constructor() {
        this._stack     = 0;
        this._closeTag  = true;
        this._ignore    = false;
        this._parsed    = "var $buf=[];with($locals=$locals||{}){$buf.push(`";
    }

    onError(parser: Parser, error: Error): void {

    }

    onText(parser: Parser, text: string): void {
        if (!this._ignore) {
            this._parsed += this.parseText(text, escapeNone);
        }
    }

    onOpenTag(parser: Parser, tagName: string, attributes: MapLike<string>): void {
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
            } else {
                if (tagName === "Styles") {
                    this._ignore = true;
                    this._parsed += "</Styles" + toAttributeString(attributes) + "/>";
                } else if (tagName === "Scripts") {
                    this._ignore = true;
                    this._parsed += "</Scripts" + toAttributeString(attributes) + "/>";
                } else if (tagName === "Children") {
                    this._ignore = true;
                    this._parsed += "`,$children(),`";
                } else {
                    this._parsed += "`,$ins(`" + escapeTmpl(tagName) + "`,{";

                    for (let attribute in attributes) {
                        this._parsed += this.parseAttribute(attribute, attributes[attribute]);
                    }

                    this._parsed += "[`$children`]:function(){var $buf=[];$buf.push(`";
                }
            }
        }
    }

    onCloseTag(parser: Parser, tagName: string): void {
        // console.log("CLOSETAG:", tagName);

        if (this._stack > 1) {
            const c = tagName.charAt(0);
            if (c != c.toUpperCase()) {
                if (this._closeTag) {
                    this._parsed += "</" + escapeXml(tagName) + ">";
                }
            } else {
                if (tagName === "Styles") {
                    this._ignore = false;
                } else if (tagName === "Scripts") {
                    this._ignore = false;
                } else if (tagName === "Children") {
                    this._ignore = false;
                } else {
                    this._parsed += "`);return $buf.join(``);}}),`";
                }
            }

            this._closeTag = true;
        }

        --this._stack;
        if (this._stack == 0) {
            this._parsed += "`)}return $buf.join(``);";

            let templateFn: TemplateFunction = emptyString;
            try {
                templateFn = new Function("$esc", "$ins", "$locals", this._parsed) as TemplateFunction;
            } catch (error) {
                console.error(error);
                console.log(this._parsed);
            }
            parser.appendTemplate(templateFn);

            parser.changeDelegate(null);
        }
    }

    private parseText(text: string, escape: EscapeFunction): string {
        const length    = text.length;
        let position    = 0;
        let nextValue   = nextIndexOf(VALUE_OPEN);
        let nextHtml    = nextIndexOf(HTML_OPEN);
        let nextCode    = nextIndexOf(CODE_OPEN);
        let result      = "";

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
            nextHtml  = nextIndexOf(HTML_OPEN);
            nextCode  = nextIndexOf(CODE_OPEN);
        }

        result += escapeTmpl(text.slice(position));
        return result;

        function nextIndexOf(substring: string): number {
            const result = text.indexOf(substring, position);
            return result < 0 ? length : result;
        }

        function hasNext(): boolean {
            return nextValue < length || nextHtml < length || nextCode < length;
        }

        function nextType(): string {
            if (nextValue <= nextHtml && nextValue <= nextCode) {
                return VALUE;
            } else if (nextHtml <= nextCode) {
                return HTML;
            } else {
                return CODE;
            }
        }
    }

    private parseAttribute(name: string, value: string): string {
        if (isStringSurrounded(name, VALUE_OPEN, VALUE_CLOSE) && value === "") {
            return "..." + name.slice(VALUE_OPEN.length, -VALUE_CLOSE.length) + ",";
        }

        return "[`" + escapeTmpl(name) + "`]:" + this.parseAttributeValue(value) + ","
    }

    private parseAttributeValue(text: string): string {
        const length    = text.length;
        let position    = 0;
        let nextValue   = nextIndexOf(VALUE_OPEN);
        let result      = "";

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

        function nextIndexOf(substring: string): number {
            const result = text.indexOf(substring, position);
            return result < 0 ? length : result;
        }
    }
}

function isStringSurrounded(test: string, prefix: string, postfix: string): boolean {
    return test.startsWith(prefix) && test.endsWith(postfix);
}

function toAttributeString(attributes: MapLike<string>): string {
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