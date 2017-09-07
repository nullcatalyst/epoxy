import tsc from "rollup-plugin-typescript";
import node from "rollup-plugin-node-resolve";
// import cjs from "rollup-plugin-commonjs";
import typescript from "typescript";

const plugins = [
    tsc({ typescript }),
    // cjs(),
    node(),
];

const external = [
    // node
    "events",
    "fs",
    "path",

    // npm
    "bluebird",
    "glob",
    "html-minifier",
    "sax",
];

const globals = {
    // node
    "events": "require('events')",
    "fs": "require('fs')",
    "path": "require('path')",

    // npm
    "bluebird": "require('bluebird')",
    "glob": "require('glob')",
    "html-minifier": "require('html-minifier')",
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
        },
        plugins,
        external,
        globals,
    }
];
