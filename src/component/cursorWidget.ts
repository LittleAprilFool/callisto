import {CodeMirror} from 'codemirror';
import { Cursor, ICellBinding, ICursorWidget, User } from 'types';
const Jupyter = require('base/js/namespace');

const checkOpType = (op): string => {
    if (op.p.length === 1 && typeof op.p[0] === 'number' && op.li && op.ld) return 'UpdateCursor';    
    return 'Else';
};

export class CursorWidget implements ICursorWidget {
    private markers;
    private mouseDown: number;
    private lineref: any;
    private chatCallback: any;
    constructor(private user: User, private sharedCells: ICellBinding[], private doc: any) {
        this.initCursorListener();
        this.doc.subscribe(this.onSDBDocEvent);
        this.markers = {};
        this.initMouseDown();
    }
    public destroy = (): void => {
        this.doc.unsubscribe(this.onSDBDocEvent);
    }

    public updateLineRefCursor = (flag, cm_index, from, to): void => {
        if(flag) {
            if(this.lineref) this.lineref.clear();
            const cm: CodeMirror = this.sharedCells[cm_index].codeMirror;
            const stPos = cm.posFromIndex(from);
            const edPos = cm.posFromIndex(to);
            const cursor_type = 'line_highlight';
            this.lineref= cm.markText(stPos, edPos, {className: cursor_type});
            // scroll to the line
            const focus_cell = document.querySelectorAll('.cell')[cm_index];
            focus_cell.scrollIntoView();
        }
        else {
            if(this.lineref) this.lineref.clear();
            ++this.mouseDown;
        }

    }

    public deleteCursor = (user: User): void => {
        const id = user.user_id;
        if(this.markers[id]) {
            this.markers[id].clear();
            delete this.markers[id];
        }

        // delete label, if have
        const old_cell_container = document.querySelector('#cell-users-' + user.user_id);
        if(old_cell_container) old_cell_container.parentNode.removeChild(old_cell_container);
    }
    public bindChatAction = (callback): void => {
        this.chatCallback = callback;
    }

    private initMouseDown = (): void => {
        this.mouseDown = 0;
        document.body.onmouseup = ()=> {
            --this.mouseDown;
        };
    }

    private initCursorListener = (): void => {
        this.sharedCells.forEach(sharedCell => {
            sharedCell.codeMirror.on('cursorActivity', this.onCursorChange);
        });
        Jupyter.notebook.events.on('select.Cell', this.onSelectCell);
    }

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            ops.forEach(op => this.applyOp(op));
        }
    }

    private applyOp = (op): void => {
        if(checkOpType(op) === 'UpdateCursor') {
            this.updateCursorDisplay(op.li, op.ld);
        }
    }

    private updateCursorDisplay = (newCursor: Cursor, oldCursor: Cursor): void => {
        // if have cursor information
        // remove cursor selection and cursor bar
        if(this.markers[newCursor.user.user_id])    {
            this.markers[newCursor.user.user_id].clear();
        }

        if(newCursor.cm_index!== oldCursor.cm_index) {
            // update cursor label
            this.addCursorLabel(newCursor);
        }
        
        // update cursor bar
        if (newCursor.from === newCursor.to) {
            this.addCursorBar(newCursor);
        }
        else {
            this.addCursorSelection(newCursor);
        }
    }

    private addCursorSelection = (cursor: Cursor): void => {
        const cm: CodeMirror = this.sharedCells[cursor.cm_index].codeMirror;
        const stPos = cm.posFromIndex(cursor.from);
        const edPos = cm.posFromIndex(cursor.to);
        const cursor_type = 'selectedtext-' + cursor.user.user_id;
        const cursorEl = cm.markText(stPos, edPos, {className: cursor_type});
        const cursorHTMLEl = document.querySelector('.'+cursor_type) as HTMLElement;
        if(cursorHTMLEl) cursorHTMLEl.style.backgroundColor = cursor.user.color;
        this.markers[cursor.user.user_id] = cursorEl;
    }

    private addCursorBar = (cursor: Cursor): void => {
        const cm: CodeMirror = this.sharedCells[cursor.cm_index].codeMirror;
        const stPos = cm.posFromIndex(cursor.from-1);
        const edPos = cm.posFromIndex(cursor.from);

        // issue: will not show cursor if it is the end of the line
        const cursor_type = 'cursor cursor-right-' + cursor.user.user_id;
        const cursorEl = cm.markText(stPos, edPos, {className: cursor_type});
        const cursorHTMLEl = document.querySelector('.cursor-right-'+cursor.user.user_id) as HTMLElement;
        if(cursorHTMLEl) cursorHTMLEl.style.borderRightColor = cursor.user.color;
        this.markers[cursor.user.user_id] = cursorEl;
    }

    private addCursorLabel = (cursor: Cursor): void => {
        const cm: CodeMirror = this.sharedCells[cursor.cm_index].codeMirror;

        // delete old label, if have
        const old_cell_container = document.querySelector('#cell-users-' + cursor.user.user_id);
        if(old_cell_container) old_cell_container.parentNode.removeChild(old_cell_container);

        // add new label
        const cell_container = document.createElement('div');
        cell_container.classList.add('cell-users');
        cell_container.id = 'cell-users-' + cursor.user.user_id;

        const parent_cell_container = document.getElementsByClassName('cell')[cm.index];

        let label_container = parent_cell_container.querySelector('#cell-users-container');
        if(label_container == null) {
            label_container = document.createElement('div');
            label_container.id = 'cell-users-container';
            parent_cell_container.prepend(label_container);
        }

        label_container.append(cell_container);

        const user_box = document.createElement('div');
        user_box.textContent = cursor.user.username.toString().charAt(0).toUpperCase();
        user_box.id = 'active-cell-'+ cursor.user.user_id;
        user_box.style.color = cursor.user.color;
        user_box.classList.add('active-cell');
     

        const tooltip = document.createElement('span');
        tooltip.textContent = cursor.user.username;
        tooltip.id = 'tooltip-text-'+ cursor.user.user_id;
        tooltip.classList.add('tooltip-text');
        user_box.appendChild(tooltip);

        user_box.addEventListener('mouseover', () => {
            const tt: HTMLElement = document.querySelector('#tooltip-text-' + cursor.user.user_id);
            tt.style.display = "block";
        });

        user_box.addEventListener('mouseout', () => {
            const tt: HTMLElement = document.querySelector('#tooltip-text-' + cursor.user.user_id);
            tt.style.display = "none";
        });

        cell_container.appendChild(user_box);
    }

    private onSelectCell = (evt, info): void => {
        this.onCursorChange(info.cell.code_mirror);
    }

    private onCursorChange = (cm: CodeMirror): void => {
        // ignore cursor change if it is not in active 
        if(cm.index === Jupyter.notebook.get_selected_cells_indices()[0]) {
            const stPos = cm.getCursor('start');
            const edPos = cm.getCursor('end');
    
            const stindex = cm.indexFromPos(stPos);
            const edindex = cm.indexFromPos(edPos);

            const currentDoc = this.doc.getData();
            let targetIndex = currentDoc.length;
            currentDoc.forEach((data, index) => {
                if (data.user.user_id === this.user.user_id) {
                    targetIndex = index;
                }
            });

            const targetCursor = currentDoc[targetIndex];

            const newCursor: Cursor = {
                user: this.user,
                cm_index: cm.index,
                from: stindex,
                to: edindex
            };
            const op = {
                p: [targetIndex],
                ld: targetCursor,
                li: newCursor
            };
            this.doc.submitOp([op], this);
            if(this.mouseDown===0 && this.chatCallback) this.chatCallback(newCursor);
            else console.log('No chatcallback in cursor widget');
        }
    }
}