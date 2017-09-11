import * as fs from "fs";
import * as path from "path";
import * as chokidar from "chokidar";
import mkdirp from "mkdirp";
const { Library, Application } = require("./lib");

const argv = process.argv;
const argc = argv.length;

interface ConfigOutput {
    entry: string;
    file: string;
    data?: any;
    minify?: boolean;
}

interface Config {
    watch?: boolean;
    sources: string | string[];
    outputs: ConfigOutput | ConfigOutput[];
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

    let apps = outputs.map((output: ConfigOutput) => {
        const app = new Application(lib, output.entry, {
            minify: !!output.minify,
            file: output.file,
            data: output.data,
        });

        app.on("output", (result: string) => {
            // console.log("OUTPUT");

            if (output.file) {
                mkdirp(path.dirname(output.file), (error: Error, made: string) => {
                    if (error) {
                        return console.error(error);
                    }

                    fs.writeFile(output.file, result, { encoding: "utf8" }, (error: Error) => {
                        if (error) {
                            return console.error(error);
                        }

                        console.log("Output", output.file);
                    });
                });
            } else {
                console.log("[" + output.entry + "]:")
                console.log(result + "\n");
            }
        });

        return app;
    });

    const watcher = chokidar.watch(configPath, { ignoreInitial: true })
        .on("change", () => { watcher.close(); lib.stop(); start(); })
        .on("unlink", () => { watcher.close(); lib.stop(); });
}

function toArray<T>(value: T | T[]): T[] {
    return Array.isArray(value) ? value : [value];
}
