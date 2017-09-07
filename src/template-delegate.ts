import { Parser, ParserDelegate, Tag } from "./parser";
import { escapeNone, escapeXml, escapeTmpl } from "./escape";

const VALUE_OPEN    = "{{";
const VALUE_CLOSE   = "}}";
const CONTROL_OPEN  = "{#";
const CONTROL_CLOSE = "#}";

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

    onText(parser: Parser, text: string): void {
        if (!this._ignore) {
            this._parsed += this.parseText(text, escapeNone);
        }
    }

    onOpenTag(parser: Parser, tag: Tag): void {
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
                } else {
                    text += ">";
                }

                this._parsed += text;
            } else {
                if (tag.name === "Children") {
                    this._ignore = true;
                    this._parsed += "`,$children(),`";
                } else {
                    this._parsed += "`,$ins(`" + escapeTmpl(tag.name) + "`,{";

                    for (let attribute in tag.attributes) {
                        this._parsed += "[`" + escapeTmpl(attribute) + "`]:`" + this.parseAttribute(tag.attributes[attribute]) + "`,";
                    }

                    this._parsed += "[`$children`]:function(){var $buf=[];$buf.push(`";
                }
            }
        }
    }

    onCloseTag(parser: Parser, tagName: string): void {
        if (this._stack > 1) {
            const c = tagName.charAt(0);
            if (c != c.toUpperCase()) {
                if (this._closeTag) {
                    this._parsed += "</" + escapeXml(tagName) + ">";
                }
            } else {
                if (tagName === "Children") {
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

            console.log("TEMPLATE:", this._parsed)
            parser.appendTemplate(new Function("$esc", "$ins", "$locals", this._parsed) as TemplateFunction);
            parser.changeDelegate(null);
        }
    }

    private parseText(text: string, escape: EscapeFunction): string {
        const length    = text.length;
        let position    = 0;
        let nextValue   = nextIndexOf(VALUE_OPEN);
        let nextControl = nextIndexOf(CONTROL_OPEN);
        let result      = "";

        while (nextValue < length || nextControl < length) {
            if (nextValue < nextControl) {
                result += escapeTmpl(escape(text.slice(position, nextValue)));
                position = nextValue + VALUE_OPEN.length;

                const end = nextIndexOf(VALUE_CLOSE);
                result += "`,$esc(" + text.slice(position, end) + "),`";
                position = end + VALUE_CLOSE.length;

                nextValue = nextIndexOf(VALUE_OPEN);
            } else {
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

        function nextIndexOf(substring: string): number {
            const result = text.indexOf(substring, position);
            return result < 0 ? length : result;
        }
    }

    private parseAttribute(text: string): string {
        const length    = text.length;
        let position    = 0;
        let nextValue   = nextIndexOf(VALUE_OPEN);
        let result      = "";

        while (nextValue < length) {
            result += escapeTmpl(escapeXml(text.slice(position, nextValue)));
            position = nextValue + VALUE_OPEN.length;

            const end = nextIndexOf(VALUE_CLOSE);
            result += "`+$esc(" + text.slice(position, end) + ")+`";
            position = end + VALUE_CLOSE.length;

            nextValue = nextIndexOf(VALUE_OPEN);
        }

        result += escapeTmpl(text.slice(position));
        return result;

        function nextIndexOf(substring: string): number {
            const result = text.indexOf(substring, position);
            return result < 0 ? length : result;
        }
    }
}
