import * as fs from "fs";
import * as path from "path";
import * as html from "htmlparser2";
import * as Promise from "bluebird";
import { Module } from "./module";
import { Library } from "./library";

export interface ParserDelegate {
    onError(parser: Parser, error: Error): void;
    onText(parser: Parser, text: string): void;
    onOpenTag(parser: Parser, tagName: string, attributes: MapLike<string>): void;
    onCloseTag(parser: Parser, tagName: string): void;
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
            const parser = new html.Parser({
                onerror: (error: Error): void => {
                    this.onError(error);
                    reject(error);
                },
                onopentag: (tagName: string, attributes: MapLike<string>, ...rest): void => {
                    console.log(...rest);
                    this.onOpenTag(tagName, attributes);
                },
                onclosetag: (tagName: string): void => {
                    this.onCloseTag(tagName);
                },
                ontext: (text: string): void => {
                    this.onText(text);
                },
                onend: (): void => {
                    this.onEnd();
                    resolve(new Module(fileName, this._style, this._script, this._template || noop));
                },
            }, {
                xmlMode:                    false,
                decodeEntities:             false,
                lowerCaseTags:              false,
                lowerCaseAttributeNames:    false,
                recognizeCDATA:             true,
                recognizeSelfClosing:       true,
            });

            const file = fs.createReadStream(path.resolve(fileName))
                .on("error", (error: Error) => {
                    reject(error);
                })
                .on("data", (data: string) => {
                    parser.write(data);
                })
                .on("close", () => {
                    parser.end();
                });
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

        if (this._delegate) {
            this._delegate.onError(this, error);
        }
    }

    protected onText(text: string): void {
        if (!this._delegate) {
            // Ignore
        }

        if (this._delegate) {
            this._delegate.onText(this, text);
        }
    }

    protected onOpenTag(tagName: string, attributes: MapLike<string>): void {
        if (!this._delegate) {
            if (tagName in this._delegates) {
                this._delegate = new this._delegates[tagName]();
            }
        }

        if (this._delegate) {
            this._delegate.onOpenTag(this, tagName, attributes);
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
