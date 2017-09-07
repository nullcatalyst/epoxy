import { Library, Application } from "./lib";

const lib = new Library("test/**/*.html");
const app = new Application(lib, "Demo", { minify: true });

app.on("output", (output: string) => {
    console.log(output);
});
