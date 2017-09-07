import { Parser, ParserDelegate, Tag } from "./parser";

export class ScriptDelegate implements ParserDelegate {
    private _stack: number;
    private _contents: string;

    constructor() {
        this._stack     = 0;
        this._contents  = "";
    }

    onText(parser: Parser, text: string) {
        if (this._stack != 1) {
            return;
        }

        this._contents += text;
    }

    onOpenTag(parser: Parser, tag: Tag) {
        ++this._stack;
    }

    onCloseTag(parser: Parser, tagName: string) {
        --this._stack;
        if (this._stack == 0) {
            parser.appendScript(this._contents);
            parser.changeDelegate(null);
        }
    }
}
