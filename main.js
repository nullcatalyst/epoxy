#!/usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = require('fs');
var path = require('path');
var chokidar = require('chokidar');
var mkdirp = _interopDefault(require('mkdirp'));

const { Library, Application } = require("./lib");
const argv = process.argv;
const argc = argv.length;
const DEFAULT_CONFIG_FILE = "epoxy.config.js";
const configPath = path.resolve(argc === 2 ? DEFAULT_CONFIG_FILE : argv[2]);
start();
function start() {
    delete require.cache[configPath];
    const config = require(configPath);
    if (!config.sources || !config.outputs) {
        // There must be at least one output
        process.exit();
    }
    let outputs = toArray(config.outputs);
    let lib = new Library({
        watch: !!config.watch,
        sources: toArray(config.sources),
    });
    let apps = outputs.map((output) => {
        const app = new Application(lib, output.entry, {
            minify: !!output.minify,
            file: output.file,
            data: output.data,
        });
        app.on("output", (result) => {
            // console.log("OUTPUT");
            if (output.file) {
                mkdirp(path.dirname(output.file), (error, made) => {
                    if (error) {
                        return console.error(error);
                    }
                    fs.writeFile(output.file, result, { encoding: "utf8" }, (error) => {
                        if (error) {
                            return console.error(error);
                        }
                        console.log("Output", output.file);
                    });
                });
            }
            else {
                console.log("[" + output.entry + "]:");
                console.log(result + "\n");
            }
        });
        return app;
    });
    const watcher = chokidar.watch(configPath, { ignoreInitial: true })
        .on("change", () => { watcher.close(); lib.stop(); start(); })
        .on("unlink", () => { watcher.close(); lib.stop(); });
}
function toArray(value) {
    return Array.isArray(value) ? value : [value];
}
