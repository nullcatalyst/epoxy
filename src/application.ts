import * as EventEmitter from "events";
import * as Promise from "bluebird";
import * as htmlmin from "html-minifier";
import * as uglify from "uglify-js";
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

            let output = "";
            try {
                output = insert(this._name, options!.data!);
            } catch (error) {
                console.error(error);
            }

            if (style && (style = style.trim())) {
                output = output.replace(/<\/Styles(.*)\/>/g, "<style$1>" + style.replace("$", () => "\\$") + "</style>");
            } else {
                output = output.replace(/<\/Styles(.*)\/>/g, "");
            }

            if (script && (script = script.trim())) {
                output = output.replace(/<\/Scripts(.*)\/>/g, "<script$1>" + script.replace("$", () => "\\$") + "</script>");
            } else {
                output = output.replace(/<\/Scripts(.*)\/>/g, "");
            }

            if (options!.minify!) {
                output = htmlmin.minify(output, {
                    collapseBooleanAttributes: true,
                    collapseWhitespace: true,
                    decodeEntities: true,
                    minifyCSS: true,
                    minifyJS: uglify.minify,
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
                if (!($name in renderFns)) {
                    throw new Error(`No template found for name "${$name}"`);
                }

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
