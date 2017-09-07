import * as path from "path";

export function dashCamel(value: any): string {
    return String(value).replace(/(^|-)(\w|$)/g, (full: string, dash: string, c: string) => c.toUpperCase());
}

export function file2tag(fileName: string): string {
    return dashCamel(path.parse(fileName).name);
}
