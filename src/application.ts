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
            const renderFns = this._library.getRenderFunctions($esc, insert);
            const included: MapLike<boolean> = {};

            let style  = "";
            let script = "";

            let result = insert(this._name, {});
            result = result.replace("</Styles/>", "<style>" + style + "</style>");
            result = result.replace("</Scripts/>", "<script>" + script + "</script>");

            this.emit("render", result);

            function insert($name: string, $locals: any): string {
                const [module, render] = renderFns[$name];

                if (!included[$name]) {
                    included[$name] = true;
                    style  += module.style;
                    script += module.script;
                }

                return render($locals);
            }
        };

        library.on("parse", update);
    }

    addCustomHandlers(renderFns: MapLike<RenderFunction>): void {
        renderFns["Styles"]     = () => "";
        renderFns["Scripts"]    = () => "";
        renderFns["Children"]   = () => "";
    }
}
