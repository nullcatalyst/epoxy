import { Library } from "./library";
import { Parser } from "./parser";

import { StyleDelegate }    from "./style-delegate";
import { ScriptDelegate }   from "./script-delegate";
import { TemplateDelegate } from "./template-delegate";

export class DefaultParser extends Parser {
    constructor(library: Library, fileName: string) {
        super(library, fileName);

        this.addTagDelegate("style",      StyleDelegate);
        this.addTagDelegate("script",     ScriptDelegate);
        this.addTagDelegate("template",   TemplateDelegate);
    }
}
