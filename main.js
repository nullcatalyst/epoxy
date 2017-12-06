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
    let apps = outputs.map((result) => {
        const app = new Application(lib, result.entry, {
            minify: !!result.minify,
            output: result.output,
            data: result.data,
        });
        app.on("output", (output) => {
            // console.log("OUTPUT");
            if (result.output) {
                mkdirp(path.dirname(result.output), (error, made) => {
                    if (error) {
                        return console.error(error);
                    }
                    fs.writeFile(result.output, output, { encoding: "utf8" }, (error) => {
                        if (error) {
                            return console.error(error);
                        }
                        console.log("Output", result.output);
                    });
                });
            }
            else {
                console.log("[" + result.entry + "]:");
                console.log(output + "\n");
            }
        });
        return app;
    });
    let watchFiles = [configPath];
    if (config.watchFiles) {
        if (Array.isArray(config.watchFiles)) {
            watchFiles.push(...config.watchFiles);
        }
        else {
            watchFiles.push(config.watchFiles);
        }
    }
    const watcher = chokidar.watch(watchFiles, { ignoreInitial: true })
        .on("change", () => { watcher.close(); lib.stop(); start(); })
        .on("unlink", () => { watcher.close(); lib.stop(); });
}
function toArray(value) {
    return Array.isArray(value) ? value : [value];
}
