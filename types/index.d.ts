// import { SDBSubDoc } from "sdb-ts";

interface Dialog {
    title: string;
    body: HTMLElement;
    buttons: any;
    keyboard_manager: any;
}

interface Button {
    readonly label: string;
    readonly icon: string;
    readonly id: string;
    callback(): any;
}

interface SharedDoc {
    count: number; 
    notebook: Notebook;
    event: {
        render_markdown: number;
        unrender_markdown: number;
    };
    host: string;
    users: string[];
}

interface SharedDocOption {
    annotation?: boolean;
    chat?: boolean;
}

interface Notebook {
    cells: Cell[],
    metadata: {
        doc_name: string,
        kernelspec: {
            display_name: string;
            language:string;
            name:string;
        }
        language_info: any,
        shared: boolean,
    },
    nbformat: number,
    nbformat_minor: number,
    annotation: Annotation[],
}
interface Annotation{
    widget_index: number,
}

interface Cell {
    cell_type?: string;
    execution_count?: number;
    metadata?: any;
    outputs?: Output[];
    source?: string[];
    rendered?: boolean;
}

interface Output{
    name?: string,
    output_type?: string,
    text?: string[],
    data?: any,
    metadata?: any
}

interface NotebookSDB{
    destroy(): void, 
}

interface CellSDB{
    index: number;
    doc: any;
    annotationWidget?: AnnotationInterface;
    destroy(): void;
    updateDoc(newDoc: any): void;
}

interface AnnotationInterface{
    reloadCanvas(any): void;
}