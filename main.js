#!/usr/bin/env node
"use strict";const{Library:t,Application:e}=require("./lib"),i=new t(["test/**/*.html"],{watch:!0}),o=new e(i,"Demo",{minify:!0});o.on("output",t=>{console.log(t)});
