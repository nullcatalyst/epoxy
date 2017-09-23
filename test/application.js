const assert = require("assert");
const { Library, Application } = require("../lib");

describe("ParseTemplates", () => {
    it("Demo", (done) => {
        const lib = new Library({ sources: "test/templates/**/*.html" });
        const app = new Application(lib, "Demo", { minify: true });

        app.on("output", (output) => {
            assert.strictEqual(output, "<!doctype html><html><head></head><body><p>Hello World</p><p>test</p></body></html>")
            done();
        });
    }).timeout(10000);
});
