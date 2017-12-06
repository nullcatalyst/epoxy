import * as fs from "fs";
import * as path from "path";
import * as chokidar from "chokidar";
import mkdirp from "mkdirp";
const { Library, Application } = require("./lib");

const argv = process.argv;
const argc = argv.length;

interface ResultConfig {
    entry: string;
    output: string;
    data?: any;
    minify?: boolean;
}

interface Config {
    watch?: boolean;
    sources: string | string[];
    outputs: ResultConfig | ResultConfig[];
    watchFiles?: string[];
}

const DEFAULT_CONFIG_FILE = "epoxy.config.js";
const configPath = path.resolve(argc === 2 ? DEFAULT_CONFIG_FILE : argv[2]);
start();

function start() {
    delete require.cache[configPath];
    const config: Config = require(configPath);

    if (!config.sources || !config.outputs) {
        // There must be at least one output
        process.exit();
    }

    let outputs = toArray(config.outputs);
    let lib = new Library({
        watch: !!config.watch,
        sources: toArray(config.sources),
    });

    let apps = outputs.map((result: ResultConfig) => {
        const app = new Application(lib, result.entry, {
            minify: !!result.minify,
            output: result.output,
            data: result.data,
        });

        app.on("output", (output: string) => {
            // console.log("OUTPUT");

            if (result.output) {
                mkdirp(path.dirname(result.output), (error: Error, made: string) => {
                    if (error) {
                        return console.error(error);
                    }

                    fs.writeFile(result.output, output, { encoding: "utf8" }, (error: Error) => {
                        if (error) {
                            return console.error(error);
                        }

                        console.log("Output", result.output);
                    });
                });
            } else {
                console.log("[" + result.entry + "]:")
                console.log(output + "\n");
            }
        });

        return app;
    });

    let watchFiles = [ configPath ];
    if (config.watchFiles) {
        if (Array.isArray(config.watchFiles)) {
            watchFiles.push(...config.watchFiles);
        } else {
            watchFiles.push(config.watchFiles);
        }
    }

    const watcher = chokidar.watch(watchFiles, { ignoreInitial: true })
        .on("change", () => { watcher.close(); lib.stop(); start(); })
        .on("unlink", () => { watcher.close(); lib.stop(); });
}

function toArray<T>(value: T | T[]): T[] {
    return Array.isArray(value) ? value : [value];
}
