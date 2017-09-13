import * as path from "path";

export function noop() {}

export function emptyString() { return ""; }

export function toArray<T>(value: T | T[]): T[] {
    return Array.isArray(value) ? value : [value];
}

export function dashCamel(value: any): string {
    return String(value).replace(/(^|-)(\w|$)/g, (full: string, dash: string, c: string) => c.toUpperCase());
}

export function file2tag(fileName: string): string {
    return dashCamel(path.parse(fileName).name);
}
