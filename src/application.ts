import * as EventEmitter from "events";
import * as Promise from "bluebird";
import { escapeXml } from "./escape";
import { Library } from "./library";
import { Module } from "./module";

export class Application extends EventEmitter {
    private _library: Library;
    private _fileName: string;
    private _name: string;

    constructor(library: Library, fileName: string, $esc: EscapeFunction = escapeXml) {
        super();

        this._library = library;
        this._fileName = fileName;
        this._name = Module.fileNameToModuleName(fileName);

        const update = () => {
            const renderFunctions = this._library.getRenderFunctions($esc, insert);

            this.emit("render", insert(this._name, {}));

            function insert(name: string, locals: any): string {
                const render = renderFunctions[name];
                if (!render) {
                    throw new Error();
                }

                return render(locals);
            }
        };

        library.on("parse", update);
    }
}
