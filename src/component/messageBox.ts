import Delta = require('quill-delta');
import { IMessageBox, LineRef, MessageLineRef } from 'types';
import { Quill } from 'types/quill';
import * as Quill_lib from '../external/quill';

export class MessageBox implements IMessageBox {

    public el: HTMLDivElement;
    public highlight: HTMLDivElement;
    public backdrop: HTMLDivElement;
    public text_area: HTMLTextAreaElement;
    public ref_list: MessageLineRef[];
    public quill_object: Quill;

    // todo: remove this mock stuff after fixing everything
    public value: string;

    constructor() {
        this.ref_list = new Array();
        this.initElement();
    }

    public getSubmissionValue(): string {
        const delta: Delta = this.quill_object.getContents(0, this.quill_object.getLength() - 1);
        let submission_string = "";
        let index = 0;
        delta.ops.forEach(insertion => {
            if ('attributes' in insertion) {
                // references
                if (index < this.ref_list.length) {
                    const message_line_ref = this.ref_list[index];
                    const line_ref = message_line_ref.line_ref;
                    index += 1;
                    submission_string += '['+ message_line_ref.text + '](C' + line_ref.cm_index.toString() + ', L' + (line_ref.from === -1 ? '*' : line_ref.from.toString()) + ', L' +(line_ref.from === -1 ? '' : line_ref.to.toString()) + ')';
                }
            } else {
                // plain text
                const re = /\[(.*?)\]\(C([0-9]*?), L([0-9]*\*), L([0-9]*)\)/g; 
                // console.log(match);
                submission_string += insertion.insert;
            }
        });
        return submission_string;
    }

    public clear(): void {
        this.quill_object.deleteText(0, this.quill_object.getLength() - 1);
        this.ref_list = new Array();
    }

    public appendRef(text: string, line_ref: LineRef): void {
        const delta: Delta = {
            ops: [
                { retain: this.quill_object.getLength() - 1 },
                { insert: ' ' },
                { insert: text, attributes: {'color': '#d10d2a', 'bold': true} },
                { insert: ' ' },
            ]
        };
        if (this.quill_object.getLength() === 1) {
            delta.ops.splice(0,1);
        }
        this.quill_object.updateContents(delta);
        const message_line_ref = {
            line_ref,
            text,
            from: this.quill_object.getLength() - text.length - 2,
            to: this.quill_object.getLength() - 2,
            expanded: false,
        };
        this.ref_list.push(message_line_ref);
    }

    public initQuill(): void {
        console.log('initting quill');
        this.quill_object = new Quill_lib('#editor', {
            modules: {
                toolbar: false
            },
            placeholder: 'write your message',
            theme: 'bubble',
        });
    }

    private initElement(): void {
        this.el = document.createElement('div');
        this.el.id = 'message-box';

        const quill_div = document.createElement('div');
        quill_div.id = 'editor';
        this.el.append(quill_div);

        const quill_link_ref = document.createElement('link');
        quill_link_ref.href = 'https://cdn.quilljs.com/1.3.6/quill.bubble.css';
        quill_link_ref.rel = 'stylesheet';
        this.el.append(quill_link_ref);

        quill_div.addEventListener('click', this.handleCaretMove);
        quill_div.addEventListener('keyup', this.handleCaretMove);

        quill_div.setAttribute('style', 'height: 50px; width: 220px;');
        this.el.setAttribute('style', 'height: 50px; width: 220px;');
    }

    private handleCaretMove = (): void => {
        const selection = this.quill_object.getSelection();
        const caret_pos = [selection.index, selection.index + selection.length];
        const content = this.quill_object.getContents();
        let char_count = 0;
        let ref_index = 0;
        const delta: Delta = {
            ops: new Array()
        };

        content.ops.forEach(op => {
            if ('attributes' in op) {
                if (this.shouldExpand(char_count, op, caret_pos[0], caret_pos[1])) {
                    // expand
                    const message_line_ref = this.ref_list[ref_index];
                    const line_ref = message_line_ref.line_ref;
                    const expanded_text = '['+ message_line_ref.text + '](C' + line_ref.cm_index.toString() + ', L' + (line_ref.from === -1 ? '*' : line_ref.from.toString()) + ', L' +(line_ref.from === -1 ? '' : line_ref.to.toString()) + ')';
                    delta.ops.push({insert: expanded_text});
                    delta.ops.push({delete: op.insert.length});
                    this.ref_list.splice(ref_index, 1);
                } else {
                    ref_index += 1;
                    if (delta.ops.length !== 0 && 'retain' in delta.ops[delta.ops.length - 1]) {
                        delta.ops[delta.ops.length - 1].retain = delta.ops[delta.ops.length - 1].retain + op.insert.length;
                    } else {
                        delta.ops.push({'retain': op.insert.length});
                    }
                }
            }
            else {
                let matches = new Array<{from: number, to: number, text: string}>();
                if (!('attributes' in op) && this.stringToCollapse(char_count, op, caret_pos[0]).length  !== 0 && this.stringToCollapse(char_count, op, caret_pos[1]).length !== 0) {
                    if (caret_pos[0] === caret_pos[1]) {
                        matches = this.stringToCollapse(char_count, op, caret_pos[0]);
                    } else {
                        matches = new Array<{from: number, to: number, text: string}>();
                        const matches_1 = this.stringToCollapse(char_count, op, caret_pos[0]);
                        const matches_2 = this.stringToCollapse(char_count, op, caret_pos[1]);
                        matches_1.forEach(match_1 => {
                            for (const match_2 of matches_2) {
                                if (match_1 === match_2) {
                                    matches.push(match_1);
                                    break;
                                }
                            }
                        });
                    }
                }
                if (matches.length === 0) {
                    // shouldn't collapse
                    if (delta.ops.length !== 0 && 'retain' in delta.ops[delta.ops.length - 1]) {
                        delta.ops[delta.ops.length - 1].retain = delta.ops[delta.ops.length - 1].retain + op.insert.length;
                    } else {
                        delta.ops.push({'retain': op.insert.length});
                    }
                } else {
                    // collapse
                    let local_char_count = 0;
                    matches.forEach((match: {from: number, to: number, text: string}) => {
                        // dealing with ref list
                        const new_message_line_ref: MessageLineRef = this.getMessageLineRefFromStr(match.text);
                        this.ref_list.splice(ref_index, 0, new_message_line_ref);
                        ref_index += 1;

                        // dealing with text
                        if (match.from > local_char_count) {
                            // padding front retain part
                            if (delta.ops.length !== 0 && 'retain' in delta.ops[delta.ops.length - 1]) {
                                delta.ops[delta.ops.length - 1].retain = delta.ops[delta.ops.length - 1].retain + match.from - local_char_count;
                            } else {
                                delta.ops.push({'retain': match.from - local_char_count});
                            }
                        }
                        local_char_count = match.to;
                        delta.ops.push({'insert': new_message_line_ref.text, 'attributes': {'color': '#d10d2a', 'bold': true}});
                        delta.ops.push({'delete': match.text.length});
                    });
                    if (op.insert.length > local_char_count) {
                        // padding rear retain part
                        if (delta.ops.length !== 0 && 'retain' in delta.ops[delta.ops.length - 1]) {
                            delta.ops[delta.ops.length - 1].retain = delta.ops[delta.ops.length - 1].retain + op.insert.length - local_char_count;
                        } else {
                            delta.ops.push({'retain': op.insert.length - local_char_count});
                        }
                    }
                }
            }
            char_count += op.insert.length;
        });

        if (delta.ops.length > 1) {
            this.quill_object.updateContents(delta);
        }
    }
    
    private getMessageLineRefFromStr(candidate: string): MessageLineRef {
        const re = /\[(.*?)\]\(C([0-9]*?), L([0-9\*]*), L([0-9]*)\)/;
        const match = candidate.match(re);
        const line_ref = {
            cm_index: +match[2],
            from: +match[3],
            to: +match[4]
        };
        const message_line_ref = {
            line_ref,
            text: match[1],
            from: -1,
            to: -1,
            expanded: false
        };
        return message_line_ref;
    }

    private shouldExpand(char_count: number, op: {insert: string, attributes: object}, caret_pos1: number, caret_pos2: number): boolean {
        if (caret_pos2 < char_count || caret_pos1 > char_count + op.insert.length) {
            return false;
        } else {
            return true;
        }
    }

    private stringToCollapse(char_count: number, op: {insert: string}, caret_pos: number): Array<{from: number, to: number, text: string}> {
        const re = /\[(.*?)\]\(C([0-9]*?), L([0-9\*]*), L([0-9]*)\)/g;
        const result = new Array();
        const match = op.insert.match(re);
        let local_char_count = 0;
        if (match !== null) {
            match.forEach(candidate => {
                const index = op.insert.slice(local_char_count, op.insert.length).indexOf(candidate);
                if (char_count + local_char_count + index > caret_pos || char_count + local_char_count + index + candidate.length < caret_pos) {
                    result.push({
                        from: local_char_count + index,
                        to: local_char_count + index + candidate.length,
                        text: candidate
                    });
                }
                local_char_count += index + candidate.length;
            });
        }
        return result;
    }
}