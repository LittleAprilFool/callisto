import { SDBDoc } from "sdb-ts";
import { getNotebookMirror } from '../action/notebookAction';
const Jupyter = require('base/js/namespace');


export class SharedNotebook {
    public notebookMirror: Array<any>;
    private suppressChanges: boolean = false;
    constructor(private sdbDoc: SDBDoc<SharedDoc>){
        this.notebookMirror = getNotebookMirror();
        this.sdbDoc.subscribe(this.onSDBDocEvent);
        this.eventsOn();
    }

    public destroy = (): void => {
        this.sdbDoc.unsubscribe(this.onSDBDocEvent)
        this.eventsOff();
    }

    private eventsOn = (): void => {
        Jupyter.notebook.events.on('create.Cell', this.insertCell);
        Jupyter.notebook.events.on('delete.Cell', this.deleteCell);

    }

    private eventsOff = (): void => {
        Jupyter.notebook.events.off('create.Cell', this.insertCell);
        Jupyter.notebook.events.off('delete.Cell', this.deleteCell);

    }

    private onSDBDocEvent = (type, ops, source):void =>{
        if(type === 'op') {
            if(source !== this) {
                ops.forEach((op) => this.applyOp(op))
            }
        }
    }
        
    // apply the operations to the local Code Mirror Cells
    private applyOp = (op): void => {
        this.suppressChanges = true;
        const {p, li, ld} = op;
        const [, , index] = p;
        // insert cell
        if(li){
            // insert cell into notebook
            let cell = Jupyter.notebook.insert_cell_above(li.cell_type, index);
            // add cell to notebookMirror
            this.notebookMirror.splice(index, 0, cell.code_mirror)
        }
        // delete cell
        else if (ld)
        {
            // delete cell from notebook
            Jupyter.notebook.delete_cell(index);

            // delete cell from notebookMirror
            this.notebookMirror.splice(index, 1)
        }
        this.suppressChanges = false;
    }

    private deleteCell = (evt, info): void => {
        if(!this.suppressChanges) {
            console.log('insert cell')

            this.notebookMirror.splice(info.index, 1);
        
            // op = {p:[path,idx], li:obj}	
            // inserts the object obj before the item at idx in the list at [path].
            let op = [{
                p:['notebook', 'cells', info.index],
                ld: JSON.parse(JSON.stringify(info.cell))
            }];

            this.sdbDoc.submitOp(op, this);
        };
    }

    private insertCell = (evt, info): void => {
        // info contains the following:
        //      * cell: Jupyter notebook cell javascript object
        //      * index: notebook index where cell was inserted
        if(!this.suppressChanges) {
            console.log('insert cell')

            this.notebookMirror.splice(info.index, 0, info.codeMirror);
        
            // op = {p:[path,idx], li:obj}	
            // inserts the object obj before the item at idx in the list at [path].
            let op = [{
                p:['notebook', 'cells', info.index],
                li: JSON.parse(JSON.stringify(info.cell))
            }];

            this.sdbDoc.submitOp(op, this);
        };
    }
}
