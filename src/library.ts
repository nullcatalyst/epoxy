import * as EventEmitter from "events";
import * as Promise from "bluebird";
import * as chokidar from "chokidar";
import globby from "globby";
import { file2tag } from "./util";
import { Module } from "./module";
import { Parser } from "./parser";
import { DefaultParser } from "./default-parser";

export interface LibraryOptions {
    parser?: typeof Parser;
    watch?: boolean; // Default false
}

interface LibraryEvents {
    /** There was an error parsing a file */
    on(event: "error", handler: (error: Error) => void);

    /** Initial parsing is complete */
    on(event: "done", handler: () => void);

    /** A file has been updated and parsed */
    on(event: "update", handler: (module: Module) => void);
}

export class Library extends EventEmitter implements LibraryEvents {
    private _modules: MapLike<Module>;
    private _watcher: chokidar.FSWatcher | null;

    constructor(pattern: string | string[], options?: LibraryOptions) {
        super();

        // Set default options
        options = options || {};
        options.parser = options.parser || DefaultParser;
        options.watch = options.watch || false;

        this._modules = {};
        this._watcher = null;

        globby(pattern)
            .then((files: string[]) => {
                return Promise.all(files.map((filePath: string) => {
                    const parser = new options!.parser!(this, filePath);
                    return parser.promise.catch((error: Error) => {
                        this.emit("error", error, filePath);
                    });
                }));
            })
            .then((modules: Module[]) => {
                modules.forEach((module: Module) => {
                    this._modules[module.name] = module;
                });

                this.emit("done");

                if (options!.watch!) {
                    const update = (fileName: string) => {
                        const parser = new options!.parser!(this, fileName);
                        parser.promise
                            .then((module: Module) => {
                                this._modules[module.name] = module;
                                this.emit("update", module);
                            })
                            .catch((error: Error) => {
                                this.emit("error", error, fileName);
                            });
                    };

                    const remove = (fileName: string) => {
                        delete this._modules[file2tag(fileName)];
                    };

                    this._watcher = chokidar.watch(pattern, { ignoreInitial: true })
                        .on("add", update)
                        .on("change", update)
                        .on("unlink", remove);
                }
            });
    }

    getRenderFunctions($esc: EscapeFunction, $ins: InsertFunction, addHandlers?: boolean): MapLike<[Module, RenderFunction]> {
        const renderFns: MapLike<[Module, RenderFunction]> = {};

        Object.entries(this._modules)
            .forEach(([name, module]) => {
                renderFns[name] = [module, module.template.bind(null, $esc, $ins) as RenderFunction];
            });

        return renderFns;
    }

    stop(): void {
        if (this._watcher) {
            this._watcher.close();
            this._watcher = null;
        }
    }
}
