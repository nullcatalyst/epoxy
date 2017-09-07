import { Parser, ParserDelegate } from "./parser";

export class ScriptDelegate implements ParserDelegate {
    private _stack: number;
    private _contents: string;

    constructor() {
        this._stack     = 0;
        this._contents  = "";
    }

    onError(parser: Parser, error: Error): void {

    }

    onText(parser: Parser, text: string): void {
        if (this._stack != 1) {
            return;
        }

        this._contents += text;
    }

    onOpenTag(parser: Parser, tagName: string, attributes: MapLike<string>): void {
        ++this._stack;
    }

    onCloseTag(parser: Parser, tagName: string): void {
        --this._stack;
        if (this._stack == 0) {
            parser.appendScript(this._contents);
            parser.changeDelegate(null);
        }
    }
}
