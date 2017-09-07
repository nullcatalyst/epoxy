const assert = require("assert");
const { Library, Application } = require("../lib");

describe("Demo", () => {
    it("", (done) => {
        const lib = new Library("test/templates/**/*.html");
        const app = new Application(lib, "Demo", { minify: false });

        app.on("output", (output) => {
            console.log(output);
            done();
        });
    }).timeout(10000);
});
