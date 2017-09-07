import * as fs from "fs";
import * as path from "path";
import * as sax from "sax";
import * as Promise from "bluebird";
import { Module } from "./module";
import { Library } from "./library";

export type Tag = sax.Tag;

export interface ParserDelegate {
    onText(parser: Parser, text: string);
    onOpenTag(parser: Parser, tag: sax.Tag);
    onCloseTag(parser: Parser, tagName: string);
}

export interface ParserDelegateClass {
    new(): ParserDelegate;
}

export class Parser {
    private _delegate: ParserDelegate | null;
    private _delegates: { [tagName: string]: ParserDelegateClass };
    private _promise: Promise<Module>;

    private _style: string;
    private _script: string;
    private _template: TemplateFunction | null;

    constructor(library: Library, fileName: string) {
        this._delegate  = null;
        this._delegates = {};

        this._style  = "";
        this._script = "";
        this._template = null;

        this._promise = new Promise((resolve, reject) => {
            const parser = sax.createStream(true, {
                trim:       false,  // Whether or not to trim text and comment nodes
                normalize:  false,  // If true, then turn any whitespace into a single space
                lowercase:  false,  // If true, then lowercase tag names and attribute names in loose mode, rather than uppercasing them
                xmlns:      false,  // If true, then namespaces are supported
                position:   true,   // If false, then don't track line/col/position
                // strictEntities: false, // If true, only parse predefined XML entities (&amp;, &apos;, &gt;, &lt;, and &quot;)
            });

            parser.on("error",      (error: Error)      => { this.onError(error); reject(error); });
            parser.on("opentag",    (tag: sax.Tag)      => this.onOpenTag(tag)      );
            parser.on("closetag",   (tagName: string)   => this.onCloseTag(tagName) );
            parser.on("text",       (text: string)      => this.onText(text)        );
            parser.on("end",        ()                  => { this.onEnd(); resolve(new Module(fileName, this._style, this._script, this._template || noop)); });

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

    get promise(): Promise<Module> {
        return this._promise;
    }

    changeDelegate(delegate: ParserDelegate | null): void {
        this._delegate = delegate;
    }

    addTagDelegate(tagName: string, delegateClass: ParserDelegateClass) {
        this._delegates[tagName] = delegateClass;
    }

    appendStyle(style: string): void {
        this._style += style;
    }

    appendScript(script: string): void {
        this._script += script;
    }

    appendTemplate(template: TemplateFunction): void {
        if (this._template) {
            const prev = this._template;
            this._template = ($esc: EscapeFunction, $ins: InsertFunction, $locals: any) => prev($esc, $ins, $locals) + template($esc, $ins, $locals);
        } else {
            this._template = template;
        }
    }

    protected onError(error: Error): void {
        console.error(error);
        process.exit();
    }

    protected onText(text: string): void {
        if (!this._delegate) {
            // Ignore
        }

        if (this._delegate) {
            this._delegate.onText(this, text);
        }
    }

    protected onOpenTag(tag: sax.Tag): void {
        if (!this._delegate) {
            if (tag.name in this._delegates) {
                this._delegate = new this._delegates[tag.name]();
            }
        }

        if (this._delegate) {
            this._delegate.onOpenTag(this, tag);
        }
    }

    protected onCloseTag(tagName: string): void {
        if (!this._delegate) {
            // Ignore
        }

        if (this._delegate) {
            this._delegate.onCloseTag(this, tagName);
        }
    }

    protected onEnd(): void {

    }
}

function noop() {
    return "";
}
