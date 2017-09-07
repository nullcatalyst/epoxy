import * as fs from "fs";
import * as path from "path";
import * as chokidar from "chokidar";
const { Library, Application, Module } = require("./lib");

const argv = process.argv;
const argc = argv.length;

interface ConfigFile {
    entry: string;
    output: string;
    data?: any;
    minify?: boolean;
}

interface Config {
    // watch?: boolean;
    watch?: string | string[];
    files: ConfigFile | ConfigFile[];
}

const configPath = argc === 2 ? path.resolve("epoxy.config.json") : path.resolve(argv[2]);
const config: Config = require(configPath);

if (!config.files) {
    // There must be at least one output
    process.exit();
}

let files = Array.isArray(config.files) ? config.files : [config.files];
let lib = new Library(config.watch || "**/*.html", { watch: !!config.watch });
let apps = files.map((file: ConfigFile) => {
    const app = new Application(lib, file.entry, { minify: !!file.minify });

    app.on("output", (output: string) => {
        if (file.output) {
            fs.writeFile(file.output, output, { encoding: "utf8" }, (error: Error) => {
                if (error) {
                    console.error(error);
                }
            });
        } else {
            console.log(file.entry, "->", output);
        }
    });

    return app;
});
