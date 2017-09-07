export function escapeNone(value: any): string {
    return String(value);
}

const XML = {
    ">": "&gt;",
    "<": "&lt;",
    "'": "&apos;",
    '"': "&quot;",
    "&": "&amp;",
};

export function escapeXml(value: any): string {
    return String(value).replace(/[&"<>\']/g, (c: string) => (c in XML ? XML[c] : c))
}

const TMPL = {
    "`": "\\`",
    "\\": "\\\\",
    "$": "\\$",
};

export function escapeTmpl(value: any): string {
    return String(value).replace(/[`\\$]/g, (c: string) => (c in TMPL ? TMPL[c] : c));
}

const TMPL_XML = {
    ">": "&gt;",
    "<": "&lt;",
    "'": "&apos;",
    '"': "&quot;",
    "&": "&amp;",
    "`": "\\`",
    "\\": "\\\\",
    "$": "\\$",
};

export function escapeTmplXml(value: any): string {
    return String(value).replace(/[&"<>\'`\\$]/g, (c: string) => (c in TMPL_XML ? TMPL_XML[c] : c));
}
