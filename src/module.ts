import * as path from "path";
import { escapeXml } from "./escape";

export class Module {
    private _fileName: string;
    private _name: string;

    private _style: string;
    private _script: string;
    private _template: TemplateFunction;

    constructor(fileName: string, name: string, style: string, script: string, template: TemplateFunction) {
        this._fileName  = fileName;
        this._name      = name;
        this._style     = style;
        this._script    = script;
        this._template  = template;
    }

    get fileName(): string {
        return this._fileName;
    }

    get name(): string {
        return this._name;
    }

    get style(): string {
        return this._style;
    }

    get script(): string {
        return this._script;
    }

    get template(): TemplateFunction {
        return this._template;
    }
}
