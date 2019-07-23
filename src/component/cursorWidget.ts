import {CodeMirror} from 'codemirror';
import { ICursorWidget, User, ICellBinding, Cursor } from 'types';
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
        // todo: delete style
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
            if(source !== this) {
                ops.forEach(op => this.applyOp(op));
            }
        }
    }

    private applyOp = (op): void => {
        if(checkOpType(op) === 'UpdateCursor') {
            this.updateCursorDisplay(op.li, op.ld);
        }
    }

    private initStyle = (user: User): void => {
        // update style
        const sheet = document.createElement('style');
        sheet.innerHTML += '.selectedtext-' + user.user_id + '{ background-color:' + user.color + '}\n';
        sheet.innerHTML += '.cursor-right-' + user.user_id + '{ border-right: 2px solid'+ user.color + '}\n';
        // todo: 2 more users, overlap
        sheet.innerHTML += '#cell-users-' + user.user_id + '{position: absolute; right: 8px; top: 10px; width: 20px; text-align: center; font-weight: bold; z-index:2;} \n';
        sheet.innerHTML += '#active-cell-' + user.user_id + '{width:100%; margin-left:5px; float:right; color:'+user.color+';} \n';
        sheet.innerHTML += '#tooltip-text-' + user.user_id + '{z-index: 101; position:absolute; display:none; bottom: 100%; right: 0%; padding: 5px;} \n';
        document.body.appendChild(sheet);
    }

    private updateCursorDisplay = (newCursor: Cursor, oldCursor: Cursor): void => {
        // if have cursor information
        // remove cursor selection and cursor bar
        if(this.markers[newCursor.user.user_id])    {
            this.markers[newCursor.user.user_id].clear();
        }
        // if not, initialize style
        else this.initStyle(newCursor.user);

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
        this.markers[cursor.user.user_id] = cursorEl;
    }

    private addCursorBar = (cursor: Cursor): void => {
        const cm: CodeMirror = this.sharedCells[cursor.cm_index].codeMirror;
        const stPos = cm.posFromIndex(cursor.from-1);
        const edPos = cm.posFromIndex(cursor.from);

        // issue: will not show cursor if it is the end of the line
        const cursor_type = 'cursor cursor-right-' + cursor.user.user_id;
        const cursorEl = cm.markText(stPos, edPos, {className: cursor_type});
        this.markers[cursor.user.user_id] = cursorEl;
    }

    private addCursorLabel = (cursor: Cursor): void => {
        const cm: CodeMirror = this.sharedCells[cursor.cm_index].codeMirror;

        // delete old label, if have
        const old_cell_container = document.querySelector('#cell-users-' + cursor.user.user_id);
        if(old_cell_container) old_cell_container.parentNode.removeChild(old_cell_container);

        // add new label
        const cell_container = document.createElement('div');
        cell_container.setAttribute('class','cell-users');
        cell_container.setAttribute('id', 'cell-users-' + cursor.user.user_id);
        const parent_container = document.getElementsByClassName('cell')[cm.index];
        parent_container.prepend(cell_container);

        const user_box = document.createElement('div');
        user_box.textContent = cursor.user.username.toString().charAt(0).toUpperCase();
        user_box.setAttribute('id', 'active-cell-'+ cursor.user.user_id);
     

        const tooltip = document.createElement('span');
        tooltip.textContent = cursor.user.username;
        tooltip.setAttribute('id', 'tooltip-text-'+ cursor.user.user_id);
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
            if(this.mouseDown===0) this.chatCallback(newCursor);
        }
    }
}