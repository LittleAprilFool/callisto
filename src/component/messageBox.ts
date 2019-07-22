import { joinDoc } from '../action/sharedbAction';
import * as Quill_lib from '../external/quill';
import Quill from 'types/quill';

export class MessageBox implements IMessageBox {
    public el: HTMLDivElement;
    public highlight: HTMLDivElement;
    public backdrop: HTMLDivElement;
    public text_area: HTMLTextAreaElement;
    public ref_list: MessageLineRef[];
    public quill_object: Quill;

    private prev_text: string;

    constructor() {
        this.ref_list = new Array();
        this.prev_text = '';
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
            submission_string = submission_string.slice(0, message_line_ref.from - 1) + ' ['+ message_line_ref.text + '](C' + line_ref.cm_index.toString() + ', L' + (line_ref.from === -1 ? '*' : line_ref.from.toString()) + ', L' +(line_ref.from === -1 ? '' : line_ref.to.toString()) + ') ' + submission_string.slice(message_line_ref.to + 1, submission_string.length);
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
        const span = document.createElement('span');
        span.setAttribute('class', 'line_ref_unsend');
        const message_line_ref = {
            line_ref,
            text,
            from: this.text_area.textLength,
            to: this.text_area.textLength + text.length,
            expanded: false,
            span
        };
        this.text_area.value = this.text_area.value + text + ' ';
        this.ref_list.push(message_line_ref);
        this.updateDisplayContent();
        this.el.dispatchEvent(new Event('append_ref'));
        this.prev_text = this.text_area.value;
    }

    public initQuill(): void {
        this.quill_object = new Quill_lib('#editor', {
            modules: {
                toolbar: false
            },
            placeholder: 'write your message',
            theme: 'snow',
        });
    }

    private initTextArea(): void {
        this.el = document.createElement('div');
        this.el.id = 'message-box';

        const quill_div = document.createElement('div');
        quill_div.id = 'editor';
        this.el.append(quill_div);
        const quill_link_ref = document.createElement('link');
        quill_link_ref.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
        quill_link_ref.rel = 'stylesheet';
        this.el.append(quill_link_ref);

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
        this.text_area.addEventListener('keyup', this.handleCaretMove.bind(this));
        this.text_area.addEventListener('keydown', this.handleCaretMove.bind(this));
        this.text_area.addEventListener('click', this.handleCaretMove.bind(this));
        this.text_area.placeholder = 'write your message';

        this.el.append(this.text_area);

        // init style
        // TODO: height: 44px is a workaround
        quill_div.setAttribute('style', 'height: 44px;');
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
            if (!this.ref_list[index].expanded) {
                const message_line_ref = this.ref_list[index];
                const line_ref = message_line_ref.line_ref;
                display_html = display_html.slice(0, message_line_ref.from) + "<span class='line_ref_unsend' cell_index=" + line_ref.cm_index.toString() + "from=" + line_ref.from + " to=" + line_ref.to + ">" + message_line_ref.text + "</span>" + display_html.slice(message_line_ref.to, display_html.length) + ' ';
            }
        }
        this.highlight.innerHTML = display_html;
    }

    private handleScroll(): void {
        const scrollTop = this.text_area.scrollTop;
        this.highlight.scrollTop = scrollTop;
    }

    private handleCaretMove(e): void {
        // handles deletion and insertion, etc
        const caret_pos = e.target.selectionStart;
        if (this.prev_text !== this.text_area.value.toString()) {
            let diff_from = 0;
            const min_length = this.prev_text.length > this.text_area.value.length ? this.text_area.value.length : this.prev_text.length;
            for (; diff_from < min_length; diff_from += 1) {
                if (this.prev_text[diff_from] !== this.text_area.value.toString()[diff_from]) {
                    break;
                }
            }
            let diff_to = 0;
            for (; diff_to < min_length; diff_to += 1) {
                if (this.prev_text[this.prev_text.length - 1 - diff_to] !== this.text_area.value.toString()[this.text_area.value.length - 1 - diff_to]) {
                    break;
                }
            }
            const gap_length = this.text_area.value.length - this.prev_text.length;
            this.ref_list.forEach(message_line_ref => {
                if (message_line_ref.from >= this.prev_text.length - diff_to) {
                    message_line_ref.from += gap_length;
                    message_line_ref.to += gap_length;
                } else if (message_line_ref.to <= diff_from) {
                    // message_line_ref.from += gap_length;
                    // message_line_ref.to += gap_length;
                } else if (message_line_ref.from <= diff_from && message_line_ref.to >= this.prev_text.length - diff_to) {
                    message_line_ref.to += gap_length;
                } else {
                    message_line_ref.from = message_line_ref.from < diff_from ? message_line_ref.from : diff_from;
                    message_line_ref.to = message_line_ref.to  < this.prev_text.length - diff_to ? this.text_area.value.length - diff_to : message_line_ref.to + gap_length;
                }
                
            });
            this.prev_text = this.text_area.value;
            this.updateDisplayContent();
        }

        // falls in ref area
        let in_ref = false;
        let folding = false;
        const invalid_refs = new Array();
        for (const message_line_ref of this.ref_list) {
            if (message_line_ref.from <= caret_pos && message_line_ref.to >= caret_pos) {
                in_ref = true;
                if (!message_line_ref.expanded) {
                    // highlight and expand current stuff
                    message_line_ref.expanded = true;
                    const exp_index = this.ref_list.indexOf(message_line_ref);
                    const line_ref = message_line_ref.line_ref;
                    const new_exp = '['+ message_line_ref.text + '](C' + line_ref.cm_index + ', L' + (line_ref.from === -1 ? '*' : line_ref.from) + ', L' +(line_ref.from === -1 ? '' : line_ref.to) + ')';
                    this.text_area.value = this.text_area.value.slice(0, message_line_ref.from) + new_exp + this.text_area.value.slice(message_line_ref.to, this.text_area.value.length);
                    this.text_area.selectionEnd = message_line_ref.from;
                    const gap_length = new_exp.length - message_line_ref.text.length;
                    message_line_ref.to += gap_length;
                    for (let index = exp_index + 1; index < this.ref_list.length; index += 1) {
                        this.ref_list[index].from += gap_length;
                        this.ref_list[index].to += gap_length;
                    }
                }
            } else {
                if (message_line_ref.expanded) {
                    // if it was expanded then fold it
                    const re = /\[(.*?)\]\(C([0-9]*?), L([0-9\*]*), L([0-9]*)\)/;
                    const index = this.ref_list.indexOf(message_line_ref);
                    const match = this.text_area.value.slice(index === 0 ? 0 : this.ref_list[index - 1].to, index === this.ref_list.length - 1 ? this.text_area.value.length : this.ref_list[index + 1].from).match(re);
                    if (match) {
                        folding = true;
                        const gap_length = match[0].length - match[1].length;
                        message_line_ref.expanded = false;
                        message_line_ref.text = match[1];
                        message_line_ref.line_ref.cm_index = +match[2];
                        message_line_ref.line_ref.from = match[3] === '*' ? -1 : +match[3];
                        message_line_ref.line_ref.to = match[4] === '' ? -1 : +match[4];
                        message_line_ref.from = this.text_area.value.indexOf(match[0]);
                        message_line_ref.to = message_line_ref.from + message_line_ref.text.length;
                        this.text_area.value = this.text_area.value.replace(match[0], message_line_ref.text);
                        this.text_area.selectionEnd = caret_pos > message_line_ref.to ? caret_pos - gap_length : caret_pos;
                        for (let i = index + 1; i < this.ref_list.length; i += 1) {
                            this.ref_list[i].from -= gap_length;
                            this.ref_list[i].to -= gap_length;
                        }
                        this.updateDisplayContent();
                    } else {
                        // check if it still fits the re, if not  add it to invalid refs
                        invalid_refs.push(message_line_ref);
                    }

                }
            }
        }
        this.prev_text = this.text_area.value;
        // update invalid refs, and update the from and tos of valid refs
        // doesn't handle hand-typing new refs yet
        invalid_refs.forEach(invalid_ref => {
            const index = this.ref_list.indexOf(invalid_ref);
            if (index > 0) {
                this.ref_list.splice(index, 1);
            }
        });
        if (invalid_refs.length > 0 || in_ref || folding) {
            this.updateDisplayContent();
        }
    }

}