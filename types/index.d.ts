import Quill from "./quill";

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
    changelog: Changelog[];
}

interface Changelog {
    user: User;
    event: string;
    eventName: string;
    timestamp: number;
    time: string;
}


interface Cursor {
    user: User;
    cm_index: number;
    from: number;
    to: number;
}

interface LineRef {
    cm_index: number;
    from: number;
    to: number;
}

interface MessageLineRef {
    line_ref: LineRef;
    text: string;
    from: number;
    to: number;
    expanded: boolean;
    // TODO: add type
}

interface Message {
    sender: User;
    content: string;
    time: string;
    timestamp: number;
    cells: string[];
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
    changelog?: boolean;
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
    text?: any,
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
    highlight(flag: boolean, to: number): void;
}

interface IUserListWidget {
    update(any): void;
    destroy(): void;
}

interface IChatWidget {
    destroy(): void;
    broadcastMessage(message: string): void;
    onSelectCursor(cursor: Cursor): void;
    onSelectAnnotation(cell_index: number, object_index: number): void;
    onSelectDiff(label: string): void;
    bindCursorAction(callback: any): void;
    bindAnnotationAction(callback: any): void;
}

interface ICursorWidget {
    deleteCursor(user: User): void;
    destroy(): void;
    updateLineRefCursor(flag: boolean, cm_index: number, from: number, to: number): void;
    bindChatAction(callback: any): void;
}

interface IMessageBox {
    el: HTMLDivElement;
    quill_object: Quill;
    ref_list: MessageLineRef[];
}

interface IDiffTabWidget {
    destroy(): void;
    checkTab(label: string): boolean;
    addTab(label: string, type: string, timestamp: number): void;
    addDiff(new_timestamp: number, old_timestamp: number, title: string): void;
    addVersion(timestamp: number, title: string): void;
    bindChatAction(callback: any): void;
}

interface IChangelogWidget {
    destroy(): void;
}

interface IDiffWidget {
    destroy(): void;
}
