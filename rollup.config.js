import tsc from "rollup-plugin-typescript";
import typescript from "typescript";
import node from "rollup-plugin-node-resolve";
import uglify from "rollup-plugin-uglify";
import { minify } from "uglify-es";

const plugins = [
    tsc({ typescript }),
    node(),
    uglify({
        mangle: {
            toplevel: true,
            eval: true,
            // properties: true,
        },
    }, minify),
];

const external = [
    // node
    "events",
    "fs",
    "path",

    // npm
    "bluebird",
    "chokidar",
    "globby",
    "html-minifier",
    "htmlparser2",
    "sax",
];

const globals = {
    // node
    "events": "require('events')",
    "fs": "require('fs')",
    "path": "require('path')",

    // npm
    "bluebird": "require('bluebird')",
    "chokidar": "require('chokidar')",
    "globby": "require('globby')",
    "html-minifier": "require('html-minifier')",
    "htmlparser2": "require('htmlparser2')",
    "sax": "require('sax')",
};

export default [
    {
        input: "src/lib.ts",
        output: {
            file: "lib.js",
            format: "cjs",
        },
        plugins,
        external,
        globals,
    },
    {
        input: "src/main.ts",
        output: {
            file: "main.js",
            format: "cjs",
            banner: "#!/usr/bin/env node",
        },
        plugins,
        external,
        globals,
    }
];
