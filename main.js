#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');

const { Library, Application } = require("./lib");
const argv = process.argv;
const argc = argv.length;
const configPath = path.resolve(argc === 2 ? "epoxy.config.json" : argv[2]);
start();
function start() {
    const config = JSON.parse(fs.readFileSync(configPath, { encoding: "utf8" }));
    if (!config.sources || !config.outputs) {
        // There must be at least one output
        process.exit();
    }
    let outputs = toArray(config.outputs);
    let lib = new Library({
        watch: !!config.watch,
        sources: toArray(config.sources),
        config: configPath,
    });
    let apps = outputs.map((output) => {
        const app = new Application(lib, output.entry, {
            minify: !!output.minify,
            file: output.file,
            data: output.data,
        });
        app.on("output", (result) => {
            console.log("OUTPUT");
            if (output.file) {
                fs.writeFile(output.file, output, { encoding: "utf8" }, (error) => {
                    if (error) {
                        console.error(error);
                    }
                });
            }
            else {
                console.log(output.entry, "->", result);
            }
        });
        return app;
    });
    lib.on("config", () => {
        apps.forEach((app) => {
            app.stop();
        });
        start();
    });
}
function toArray(value) {
    return Array.isArray(value) ? value : [value];
}
