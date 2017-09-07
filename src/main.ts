const { Library, Application } = require("./lib");

const lib = new Library(["test/**/*.html"], { watch: true });
const app = new Application(lib, "Demo", { minify: true });

app.on("output", (output: string) => {
    console.log(output);
});
