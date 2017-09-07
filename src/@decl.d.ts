interface MapLike<T> {
    [id: string]: T;
}

type EscapeFunction = (value: any) => string;
type InsertFunction = ($name: string, $locals: any) => string;
type TemplateFunction = ($esc: EscapeFunction, $ins: InsertFunction, $locals: any) => string;
type RenderFunction = ($locals: any) => string;
