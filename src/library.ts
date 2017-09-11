import * as EventEmitter from "events";
import * as Promise from "bluebird";
import * as chokidar from "chokidar";
import globby from "globby";
import { toArray, file2tag } from "./util";
import { Module } from "./module";
import { Parser } from "./parser";
import { DefaultParser } from "./default-parser";

export interface LibraryOptions {
    parser: typeof Parser;
    sources: string[];
    watch: boolean;
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
    private _options: LibraryOptions;
    private _modules: MapLike<Module>;
    private _watcher: chokidar.FSWatcher | null;

    constructor(options?: Partial<LibraryOptions>) {
        super();

        // Set default options
        this._options = this.getDefaultOptions(options);
        this._modules = {};
        this._watcher = null;

        this.setMaxListeners(Infinity);
        this.start();
    }

    getDefaultOptions(options?: Partial<LibraryOptions>): LibraryOptions {
        return {
            parser:  options && options.parser  || DefaultParser,
            sources: options && options.sources || [],
            watch:   options && options.watch   || false,
        };
    }

    start(): void {
        this.stop();

        globby(this._options.sources)
            .then((files: string[]) => {
                return Promise.all(files.map((filePath: string) => {
                    const parser = new this._options.parser(this, filePath);
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

                if (this._options.watch) {
                    const update = (fileName: string) => {
                        const parser = new this._options.parser(this, fileName);
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

                    this._watcher = chokidar.watch(this._options.sources, { ignoreInitial: true })
                        .on("add", update)
                        .on("change", update)
                        .on("unlink", remove)
                        .setMaxListeners(Infinity);
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
