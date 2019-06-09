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
    host: User;
    users: User[];
    chat: Message[];
    cursor: Cursor[];
}


interface Cursor {
    user: User;
    cm_index: number;
    from: number;
    to: number;
}

interface Message {
    sender: User;
    content: string;
    time: string;
}

interface User {
    user_id: string;
    username: string;
    color: string;
}

interface SharedDocOption {
    annotation?: boolean;
    chat?: boolean;
    userlist?: boolean;
    cursor?: boolean;
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

interface INotebookBinding {
    destroy(): void, 
}

interface ICellBinding {
    index: number;
    doc: any;
    annotationWidget?: IAnnotationWidget;
    codeMirror: any;
    destroy(): void;
    updateDoc(newDoc: any): void;
}

interface IAnnotationWidget {
    reloadCanvas(any): void;
}

interface IUserListWidget {
    update(any): void;
    destroy(): void;
}

interface IChatWidget {
    destroy(): void;
    broadcastMessage(message: string): void;
}

interface ICursorWidget {
    deleteCursor(user: User): void;
    destroy(): void;
}