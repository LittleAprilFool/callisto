import { threadId } from "worker_threads";

export class MessageBox implements IMessageBox {
    public el: HTMLDivElement;
    public highlight: HTMLDivElement;
    public backdrop: HTMLDivElement;
    public text_area: HTMLTextAreaElement;
    public ref_list: MessageLineRef[];

    constructor() {
        this.ref_list = new Array();
        this.initTextArea();
        this.initStyle();
    }

    public getValue(): string {
        return this.text_area.value;
    }

    public getSubmissionValue(): string {
        let submission_string = this.text_area.value;
        for (let index = this.ref_list.length - 1; index >= 0; index -= 1) {
            const message_line_ref = this.ref_list[index];
            const line_ref = message_line_ref.line_ref;
            submission_string = submission_string.slice(0, message_line_ref.from - 1) + ' ['+ message_line_ref.text + '](C' + line_ref.cm_index + ', L' + line_ref.from+ ', L' + line_ref.to+ ') ' + submission_string.slice(message_line_ref.to + 1, submission_string.length) + ' ';
        }
        return submission_string;
    }
    public setValue(new_value: string): void {
        this.text_area.value = new_value;
        this.updateDisplayContent();
    }

    public clear(): void {
        this.text_area.value = '';
        this.ref_list = new Array();
        this.updateDisplayContent();
    }

    public appendRef(text: string, line_ref: LineRef): void {
        this.text_area.value = this.text_area.value + ' ';
        const message_line_ref = {
            line_ref,
            text,
            from: this.text_area.textLength,
            to: this.text_area.textLength + text.length,
            expanded: false
        };
        this.text_area.value = this.text_area.value + text + ' ';
        this.ref_list.push(message_line_ref);
        this.updateDisplayContent();
        this.el.dispatchEvent(new Event('append_ref'));
    }

    private initTextArea(): void {
        this.el = document.createElement('div');
        this.el.id = 'message-box';
        this.backdrop = document.createElement('div');
        this.backdrop.id = 'message-backdrop';
        this.highlight = document.createElement('div');
        this.highlight.id = 'message-highlight';
        this.el.append(this.backdrop);
        this.backdrop.append(this.highlight);

        this.text_area = document.createElement('textarea');
        this.text_area.id = 'input-box';
        this.text_area.addEventListener('input', this.updateDisplayContent.bind(this));
        this.text_area.addEventListener('scroll', this.handleScroll.bind(this));
        // this.text_area.addEventListener('keyup', this.handleCaretMove.bind(this));
        // this.text_area.addEventListener('click', this.handleCaretMove.bind(this));
        this.text_area.placeholder = 'write your message';

        this.el.append(this.text_area);

        // init style
        // TODO: height: 44px is a workaround
        this.backdrop.setAttribute('style', 'overflow: auto; width: 220px; height: 44px;');
        this.highlight.setAttribute('style', 'white-space: pre-wrap; word-wrap: break-word; font-size: 12px; position: absolute; padding: 2px 10px; width: inherit; height: inherit; overflow: auto;');
        this.text_area.setAttribute('style', 'color: transparent; caret-color: black; background-color: transparent; margin: 0; border-radius: 0; top: -44px; position: relative;');
    }

    private initStyle(): void {
        // TODO: add style.

    }

    private updateDisplayContent(): void {
        let display_html = this.text_area.value;
        for (let index = this.ref_list.length - 1; index >= 0; index -= 1) {
            const message_line_ref = this.ref_list[index];
            const line_ref = message_line_ref.line_ref;
            display_html = display_html.slice(0, message_line_ref.from) + "<span class='line_ref_unsend' cell_index=" + line_ref.cm_index.toString() + "from=" + line_ref.from + " to=" + line_ref.to + ">" + message_line_ref.text + "</span>" + display_html.slice(message_line_ref.to, display_html.length) + ' ';
        }
        this.highlight.innerHTML = display_html;
    }

    private handleScroll(): void {
        const scrollTop = this.text_area.scrollTop;
        this.highlight.scrollTop = scrollTop;
    }

    private handleCaretMove(e): void {
        // // falls in ref area
        // const caret = e.target.selectionStart;
        // let in_ref = false;
        // for (let index = 0; index < this.ref_list.length; index += 1) {
        //     if (this.ref_list[index].from < in)
        // }
        // this.ref_list.forEach(message_line_ref => {
        // })
        // falls out of ref area
    }

}