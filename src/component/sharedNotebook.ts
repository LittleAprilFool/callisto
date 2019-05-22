import { SDBDoc } from "sdb-ts";
import { getNotebookMirror } from '../action/notebookAction';
import { SharedCell } from './sharedCell';

const Jupyter = require('base/js/namespace');


export class SharedNotebook {
    private suppressChanges: boolean = false;
    private sharedCells: any[];
    constructor(private sdbDoc: SDBDoc<SharedDoc>) {
        this.sdbDoc.subscribe(this.onSDBDocEvent);
        this.eventsOn();
        this.sharedCells = [];
        getNotebookMirror().map((cellMirror, index) => {
            const p = ['notebook', 'cells', index];
            const subDoc = this.sdbDoc.subDoc(p);
            this.sharedCells.push(new SharedCell(cellMirror, subDoc));
        });
    }

    public destroy = (): void => {
        this.sdbDoc.unsubscribe(this.onSDBDocEvent);
        this.eventsOff();
    }

    private eventsOn = (): void => {
        Jupyter.notebook.events.on('create.Cell', this.onInsertCell);
        Jupyter.notebook.events.on('delete.Cell', this.onDeleteCell);
    }

    private eventsOff = (): void => {
        Jupyter.notebook.events.off('create.Cell', this.onInsertCell);
        Jupyter.notebook.events.off('delete.Cell', this.onDeleteCell);
    }

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            if(source !== this) {
                ops.forEach(op => this.applyOp(op));
            }
        }
    }
        
    // apply the operations to the local Code Mirror Cells
    private applyOp = (op): void => {
        this.suppressChanges = true;
        const {p, li, ld} = op;
        const [, , index] = p;
        // insert cell
        if(li) {
            // insert cell into notebook
            const cell = Jupyter.notebook.insert_cell_above(li.cell_type, index);            
            this.insertSharedCell(index, cell.code_mirror);
        }
        // delete cell
        else if(ld) {
            // delete cell from notebook
            Jupyter.notebook.delete_cell(index);
            this.deleteSharedCell(index);
        }
        this.suppressChanges = false;
    }

    // when the local notebook deletes a cell
    private onDeleteCell = (evt, info): void => {
        if(!this.suppressChanges) {

            this.deleteSharedCell(info.index);
        
            // op = {p:[path,idx], li:obj}	
            // inserts the object obj before the item at idx in the list at [path].
            const op = [{
                p:['notebook', 'cells', info.index],
                ld: JSON.parse(JSON.stringify(info.cell))
            }];

            this.sdbDoc.submitOp(op, this);
        }
    }

    // when the local notebook inserts a cell
    private onInsertCell = (evt, info): void => {
        // info contains the following:
        //      * cell: Jupyter notebook cell javascript object
        //      * index: notebook index where cell was inserted
        if(!this.suppressChanges) {

            this.insertSharedCell(info.index, info.cell.code_mirror);

            // op = {p:[path,idx], li:obj}	
            // inserts the object obj before the item at idx in the list at [path].

            const op = [{
                p: ['notebook', 'cells', info.index],
                li: JSON.parse(JSON.stringify(info.cell))
            }];

            this.sdbDoc.submitOp(op, this);
        }
    }

    // update shared cell bindings
    private insertSharedCell(index: number, codeMirror): void {
        const path = ['notebook', 'cells', index];
        const subDoc = this.sdbDoc.subDoc(path);
        const newCell = new SharedCell(codeMirror, subDoc);
        this.sharedCells.splice(index, 0, newCell);
    
        this.sharedCells.slice(index + 1).forEach((cell, i) => {
            const newIndex = i + index + 1;
            const newPath = ['notebook', 'cells', newIndex];
            const newDoc = this.sdbDoc.subDoc(newPath);
            cell.updateDoc(newDoc);
        });
    }

    private deleteSharedCell(index: number): void {
        // destroy the cell from listening
        this.sharedCells[index].destroy();

        this.sharedCells.splice(index, 1);

        this.sharedCells.slice(index).forEach((cell, i) => {
            const newIndex = i + index;
            const newPath = ['notebook', 'cells', newIndex];
            const newDoc = this.sdbDoc.subDoc(newPath);
            cell.updateDoc(newDoc);
        });
    }
}
