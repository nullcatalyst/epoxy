import { Library } from "./library";
import { Application } from "./application";

const library = new Library("test/**/*.html");
const application = new Application(library, "Layout");

application.on("render", (output: string) => {
    console.log(output);
});
