import * as EventEmitter from "events";
import * as glob from "glob";
import * as Promise from "bluebird";
import { Module } from "./module";
import { Parser } from "./parser";
import { DefaultParser } from "./default-parser";

const globp = Promise.promisify(glob);

export interface LibraryOptions {
    parser?: typeof Parser;
    watch?: boolean; // Default false
}

export class Library extends EventEmitter {
    private _modules: MapLike<Module>;

    constructor(globPattern: string, options?: LibraryOptions) {
        super();

        this._modules = {};

        const ParserClass = (options && options.parser) || DefaultParser;
        globp(globPattern)
            .then((files: string[]) => {
                return Promise.all(files.map((filePath: string) => {
                    const parser = new ParserClass(this, filePath);
                    return parser.promise;
                }));
            })
            .then((modules: Module[]) => {
                modules.forEach((module: Module) => {
                    this._modules[module.name] = module;
                });

                this.emit("parse");
            });
    }

    getRenderFunctions($esc: EscapeFunction, $ins: InsertFunction, addHandlers?: boolean): MapLike<RenderFunction> {
        const renderFns: MapLike<RenderFunction> = {};

        Object.entries(this._modules)
            .forEach(([name, module]) => {
                renderFns[name] = module.template.bind(null, $esc, $ins) as RenderFunction;
            });

        return renderFns;
    }
}
