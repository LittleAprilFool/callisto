 
interface Dialog {
    title: string;
    body: HTMLElement;
    buttons: any;
    keyboard_manager: any;
}

interface SharedDoc {
    count: number; 
    notebook: Notebook;
}

interface Notebook {
    cells: Array<Cell>,
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
}

interface Cell{
    cell_type: string;
    execution_count: number;
    metadata: any;
    outputs: Array<any>;
    source: Array<any>;
}

interface Button {
    readonly label: string;
    readonly icon: string;
    readonly id: string;
    callback(): any;
}