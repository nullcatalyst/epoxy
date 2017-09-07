import * as EventEmitter from "events";
import * as Promise from "bluebird";
import * as htmlmin from "html-minifier";
import { escapeXml } from "./escape";
import { file2tag } from "./util";
import { Library } from "./library";
import { Module } from "./module";

export interface ApplicationOptions {
    escape?: EscapeFunction; // default: escapeXml
    output?: string; // default: <no output>
    minify?: boolean; // default: false
    doctype?: boolean; // default: true
    data?: any; // default: {}
}

export class Application extends EventEmitter {
    private _library: Library;
    private _fileName: string;
    private _name: string;

    constructor(library: Library, fileName: string, options?: ApplicationOptions) {
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
            const renderFns = this._library.getRenderFunctions(options!.escape!, insert);
            const included: MapLike<boolean> = {};

            let style  = "";
            let script = "";

            let output = insert(this._name, options!.data!);
            output = output.replace("</Styles/>", "<style>" + style + "</style>");
            output = output.replace("</Scripts/>", "<script>" + script + "</script>");

            if (options!.minify!) {
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
                } as any);
            }

            if (options!.doctype!) {
                output = "<!doctype html>" + output;
            }

            this.emit("output", output);

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

        library.on("done", update)
            .on("update", update);

        this.stop = () => {
            library.removeListener("done", update)
                .removeListener("update", update);
        };
    }

    readonly stop: () => void;
}
