import { SDBDoc } from "sdb-ts";
import { getNotebookMirror} from '../action/notebookAction';
import { getUserName } from '../action/userAction';
import { openWS } from '../action/utils';
import { CellBinding } from './cellBinding';


const Jupyter = require('base/js/namespace');

// TODO: I need a better way to check the Op type
function checkOpType(op): string {
    // InsertCell and DeleteCell
    // { p: ['notebook', 'cells', info.index], li}
    // { p: ['notebook', 'cells', info.index], ld}
    if (op.p.length === 3 && op.p[0] === 'notebook' && op.p[1] === 'cells' && typeof op.p[2] === 'number' && op.li && !op.ld) return 'InsertCell';
    if (op.p.length === 3 && op.p[0] === 'notebook' && op.p[1] === 'cells' && typeof op.p[2] === 'number' && op.ld && !op.li) return 'DeleteCell';
    
    // ExecutionCount
    // { p:['notebook', 'cells', index, 'execution_count'], od, oi }
    if (op.p.length === 4 && op.p[0] === 'notebook' && op.p[1] === 'cells' && typeof op.p[2] === 'number' && op.p[3] === 'execution_count' && op.oi) return 'ExecutionCount';

    // Outputs
    // { p:['notebook', 'cells', index, 'outputs'], od, oi }
    if (op.p.length === 4 && op.p[0] === 'notebook' && op.p[1] === 'cells' && typeof op.p[2] === 'number' && op.p[3] === 'outputs' && op.oi) return 'Outputs';

    // TypeChange
    // { p: ['notebook', 'cells', index], li, ld]}
    if (op.p.length === 3 && op.p[0] === 'notebook' && op.p[1] === 'cells' && typeof op.p[2] === 'number' && op.li && op.ld) return 'TypeChange';


    // RenderMarkdown and UnrenderMarkdown
    // {p: ['event', 'render_markdown'], na]}
    if (op.p.length === 2 && op.p[0] === 'event' && op.p[1] === 'render_markdown' && op.na!==null) return 'RenderMarkdown';
    if (op.p.length === 2 && op.p[0] === 'event' && op.p[1] === 'unrender_markdown' && op.na!==null) return 'UnrenderMarkdown';

    // Other users join the channel
    if (op.p.length === 2 && op.p[0] === 'users' && typeof op.p[1] === 'number' && op.li!==null && !op.ld ) return 'JoinChannel';
    if (op.p.length === 2 && op.p[0] === 'users' && typeof op.p[1] === 'number' && !op.li && op.ld!==null ) return 'LeaveChannel';

    // UpdateHost
    if (op.p.length === 1 && op.p[0] === 'host' && op.oi!==null) return 'UpdateHost';


    return 'Else';
}

export class NotebookBinding {
    private suppressChanges: boolean = false;
    private sharedCells: any[];
    private userName: string;
    private isHost: boolean;
    constructor(private sdbDoc: SDBDoc<SharedDoc>, private ws: WebSocket) {
        this.sdbDoc.subscribe(this.onSDBDocEvent);
        this.eventsOn();
        this.sharedCells = [];
        getNotebookMirror().map((cellMirror, index) => {
            const p = ['notebook', 'cells', index];
            const subDoc = this.sdbDoc.subDoc(p);
            cellMirror.index = index;
            this.sharedCells.push(new CellBinding(cellMirror, subDoc));
        });
        this.isHost = false;
        this.onJoinChannel();
    }

    public destroy = (): void => {
        this.sdbDoc.unsubscribe(this.onSDBDocEvent);
        this.eventsOff();
        this.sharedCells.forEach(cell => {
            cell.destroy();
        });
        this.ws.close();
    }

    private eventsOn = (): void => {
        // https://github.com/jupyter/notebook/blob/master/notebook/static/notebook/js/notebook.js#L1325
        Jupyter.notebook.events.on('create.Cell', this.onInsertCell);
        
        // https://github.com/jupyter/notebook/blob/master/notebook/static/notebook/js/notebook.js#L1184
        Jupyter.notebook.events.on('delete.Cell', this.onDeleteCell);
        
        Jupyter.notebook.events.on('execute.CodeCell', this.onExecuteCodeCell);
        Jupyter.notebook.events.on('finished_execute.CodeCell', this.onFinishedExecuteCodeCell);
        Jupyter.notebook.events.on('rendered.MarkdownCell', this.onRenderedMarkdownCell);

        this.createUnrenderedMarkdownCellEvent();
        Jupyter.notebook.events.on('unrendered.MarkdownCell', this.onUnrenderedMarkdownCell);
        
        // customized event type change
        this.createTypeChangeEvent();
        Jupyter.notebook.events.on('type.Change', this.onTypeChange);
    }

    private eventsOff = (): void => {
        Jupyter.notebook.events.off('create.Cell', this.onInsertCell);
        Jupyter.notebook.events.off('delete.Cell', this.onDeleteCell);
        Jupyter.notebook.events.off('execute.CodeCell', this.onExecuteCodeCell);
        Jupyter.notebook.events.off('finished_execute.CodeCell', this.onFinishedExecuteCodeCell);
        Jupyter.notebook.events.off('rendered.MarkdownCell', this.onRenderedMarkdownCell);
        Jupyter.notebook.events.off('type.Change', this.onTypeChange);
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
        console.log(checkOpType(op));
        switch(checkOpType(op)) {
            case 'InsertCell': {
                const {p, li} = op;
                const [, , index] = p;
                const cell = Jupyter.notebook.insert_cell_above(li.cell_type, index);            
                this.insertSharedCell(index, cell.code_mirror);
                // when deleting the only cell, Jupyter will automatically insert a cell
                // when a remote notebook deletes the only cell, the current notebook will first delete its only cell. Then the current notebook will automatically insert a cell. Then the remote notebook will insert a cell as well.
                if(index === 0) {
                    Jupyter.notebook.delete_cell(1);
                }
                break;
            }
            case 'DeleteCell': {
                const {p, ld} = op;
                const [, , index] = p;
                Jupyter.notebook.delete_cell(index);
                this.deleteSharedCell(index);
                break;
            }
            case 'ExecutionCount': {
                const {p, od, oi} = op;
                const [, , index, ] = p;
                const cell = Jupyter.notebook.get_cell(index);
                cell.set_input_prompt(oi);
                
                // if host receives the execution operation from the client
                if(oi==="*" && this.isHost) {
                    // Jupyter.notebook.execute_cell(index) wouldn't call event trigger 'onExecuteCodeCell'
                    // change it to Jupyter.notebook.get_cell(index).execute()
                    Jupyter.notebook.get_cell(index).execute();
                }
                break;
            }
            case 'Outputs': {
                const {p, od, oi} = op;
                const [, , index, ] = p;
                const cell = Jupyter.notebook.get_cell(index);
                cell.clear_output();
                oi.forEach(element => {
                    cell.output_area.append_output(element);
                });
                break;
            }
            case 'TypeChange': {
                const {p, li, ld} = op;
                const [, , index] = p;
                Jupyter.ignoreInsert = true;

                switch (li.cell_type) {
                    case 'markdown': {
                        Jupyter.notebook.to_markdown(index);
                        break;
                    }
                    case 'code': {
                        Jupyter.notebook.to_code(index);
                        break;
                    }
                    case 'raw': {
                        Jupyter.notebook.to_raw(index);
                        break;
                    }
                    default:
                        console.log("Unrecognized cell type: " + li.cell_type);
                }
                Jupyter.ignoreInsert = false;
                break;
            }
            case 'RenderMarkdown': {
                Jupyter.ignoreRender = true;
                const index = this.sdbDoc.getData().event.render_markdown;
                Jupyter.notebook.get_cell(index).render();
                Jupyter.ignoreRender = false;
                break;
            }
            case 'UnrenderMarkdown': {
                Jupyter.ignoreRender = true;
                const index = this.sdbDoc.getData().event.unrender_markdown;
                Jupyter.notebook.get_cell(index).unrender();
                Jupyter.ignoreRender = false;
                break;
            }
            case 'JoinChannel': {
                const {p, li} = op;
                const [, index] = p;
                console.log(li + ' joined the channel');
                break;
            }
            case 'LeaveChannel': {
                const {p, ld} = op;
                const [, index] = p;
                console.log(ld + ' leaved the channel');
                break;
            }
            case 'UpdateHost': {
                const {p, od, oi} = op;
                console.log('The new host is ' + oi);
                const theHost = this.sdbDoc.getData().host;
                if (theHost === this.userName) this.isHost = true;
                break;
            }
            default: {
                break;
            }
        }
        this.suppressChanges = false;
    }

    // add user into connected user
    private onJoinChannel = (): void => {
        if(!this.suppressChanges) {
            const index = this.sdbDoc.getData().users.length;
            this.userName = getUserName();
            
            const op_user = {
                p: ['users', index],
                li: this.userName
            };

            this.sdbDoc.submitOp([op_user], this);

            // check if the notebook has host
            const oldHost = this.sdbDoc.getData().host;
            if(oldHost == null) {
                this.isHost = true;
                console.log('This is the host');
                const op_host = {
                    p: ['host'],
                    od: oldHost,
                    oi: this.userName
                };
                this.sdbDoc.submitOp([op_host], this);
            }

            // send the client doc and client name to server
            this.ws.send(JSON.stringify({
                'type': 'join_room',
                'doc_name': this.sdbDoc.getIdentifier(), 
                'username': this.userName 
            }));
        }
    }

    // when the local notebook deletes a cell
    private onDeleteCell = (evt, info): void => {
        if(!this.suppressChanges) {

            this.deleteSharedCell(info.index);
        
            // op = {p:[path,idx], li:obj}	
            // inserts the object obj before the item at idx in the list at [path].
            const op = {
                p:['notebook', 'cells', info.index],
                ld: JSON.parse(JSON.stringify(info.cell))
            };

            this.sdbDoc.submitOp([op], this);
        }
    }

    // when the local notebook inserts a cell
    private onInsertCell = (evt, info): void => {
        // info contains the following:
        //      * cell: Jupyter notebook cell javascript object
        //      * index: notebook index where cell was inserted

        // Jupyter.ignoreInsert is true when the code type is changed
        // Jupyter will create an insert event by default when the code type is changed
        if(!this.suppressChanges && !Jupyter.ignoreInsert) {
            this.insertSharedCell(info.index, info.cell.code_mirror);

            // op = {p:[path,idx], li:obj}	
            // inserts the object obj before the item at idx in the list at [path].

            const op = {
                p: ['notebook', 'cells', info.index],
                li: JSON.parse(JSON.stringify(info.cell))
            };

            this.sdbDoc.submitOp([op], this);
        }
    }

    private onExecuteCodeCell = (evt, info): void => {
        if(!this.suppressChanges) {
            // update the input prompt
            this.onSyncInputPrompt(info.cell);
        }
    }

    private onFinishedExecuteCodeCell = (evt, info): void => {
        if(!this.suppressChanges && this.isHost) {
            const index = info.cell.code_mirror.index;
            const remoteOutputs = this.sharedCells[index].doc.getData().outputs;
            const newOutputs = info.cell.output_area.outputs;

            const op = {
                p:['notebook', 'cells', index, 'outputs'], 
                od: remoteOutputs, 
                oi: newOutputs
            };

            this.sdbDoc.submitOp([op], this);

            // the input_prompt_number is not updated the same time as the output
            // thus we need to update it from the current Jupyter notebook after 20 msec
            // need a better solution rather than setTimeout
            setTimeout(()=> {
                this.onSyncInputPrompt(Jupyter.notebook.get_cell(index));
            }, 20);
        }
    }

    private onRenderedMarkdownCell = (evt, info): void => {
        const index = info.cell.code_mirror.index;
        // when cell type changes to markdown, Jupyter will render once. 
        // In this case, index will be undefined.
        if(!this.suppressChanges) {
            if(index!==null && !Jupyter.ignoreRender) {
                const old_number = this.sdbDoc.getData().event.render_markdown;
                const op = {
                    p: ['event', 'render_markdown'],
                    na: index - old_number 
                };
                this.sdbDoc.submitOp([op], this);
            }
        }
    }

    private onUnrenderedMarkdownCell = (evt, info): void => {
        const index = info.code_mirror.index;
        if(!this.suppressChanges) {
            if(index!==null && !Jupyter.ignoreRender) {
                const old_number = this.sdbDoc.getData().event.unrender_markdown;
                const op = {
                    p: ['event', 'unrender_markdown'],
                    na: index - old_number 
                };
                this.sdbDoc.submitOp([op], this);
            }
        }
    }

    private onTypeChange = (evt, index): void => {
        if(!this.suppressChanges) {
            // replace the cell with the new cell
            const remoteCell = this.sharedCells[index].doc.getData(); 
            const newCell = Jupyter.notebook.get_cell(index);
            const op = {
                p: ['notebook', 'cells', index],
                ld: remoteCell,
                li: newCell
            };

            this.deleteSharedCell(index);
            this.insertSharedCell(index, newCell.code_mirror);

            this.sdbDoc.submitOp([op], this);
        }
    }

    private onSyncInputPrompt(cell): void {
        if(!this.suppressChanges) {

            // update the execution_count of the cell
            const index = cell.code_mirror.index;
            const remoteExecutionCount = this.sharedCells[index].doc.getData().execution_count;
            const newCount = cell.input_prompt_number;
            const op = {
                p:['notebook', 'cells', index, 'execution_count'], 
                od: remoteExecutionCount, 
                oi: newCount
            };
        
            this.sdbDoc.submitOp([op], this);
        }
    }

    // when change type, Jupyter Notebook would delete the original cell, and insert a new cell
    private createTypeChangeEvent(): void {
        const Notebook = require('notebook/js/notebook');
        Jupyter.ignoreInsert = false;

        // to markdown
        // https://github.com/jupyter/notebook/blob/master/notebook/static/notebook/js/notebook.js#L1470
        Notebook.Notebook.prototype.cells_to_markdown = function (indices) {
            Jupyter.ignoreInsert = true;

            // pulled from Jupyter notebook source code
            if (indices === undefined) {
                indices = this.get_selected_cells_indices();
            }


            indices.forEach(indice => {
                this.to_markdown(indice);
                this.events.trigger('type.Change', indice);
            });

            Jupyter.ignoreInsert = false;
        };


        // to code
        Notebook.Notebook.prototype.cells_to_code = function (indices) {
            Jupyter.ignoreInsert = true;

            if (indices === undefined) {
                indices = this.get_selected_cells_indices();
            }

            indices.forEach(indice => {
                this.to_code(indice);
                this.events.trigger('type.Change', indice);
            });
            
            Jupyter.ignoreInsert = false;
        };

        // to raw
        Notebook.Notebook.prototype.cells_to_raw = function (indices) {
            Jupyter.ignoreInsert = true;

            // this.Jupyter.Notebook.prototype.cells_to_raw = function (indices) {
                if (indices === undefined) {
                    indices = this.get_selected_cells_indices();
                }
    
                indices.forEach(indice => {
                    this.to_raw(indice);
                    this.events.trigger('type.Change', indice);                    
                });
    
            Jupyter.ignoreInsert = false;
        };
    }

    private createUnrenderedMarkdownCellEvent(): void {
        const TextCell = require('notebook/js/textcell');
        Jupyter.ignoreRender = false;

        TextCell.MarkdownCell.prototype.unrender = function () {
            const cont = TextCell.TextCell.prototype.unrender.apply(this);
            this.notebook.set_insert_image_enabled(true);
            this.events.trigger('unrendered.MarkdownCell', this);
        };
    }

    // update shared cell bindings
    private insertSharedCell(index: number, codeMirror): void {
        const path = ['notebook', 'cells', index];
        const subDoc = this.sdbDoc.subDoc(path);
        codeMirror.index = index;
        const newCell = new CellBinding(codeMirror, subDoc);
        this.sharedCells.splice(index, 0, newCell);
    
        this.sharedCells.slice(index + 1).forEach((cell, i) => {
            const newIndex = i + index + 1;
            const newPath = ['notebook', 'cells', newIndex];
            const newDoc = this.sdbDoc.subDoc(newPath);
            cell.index = newIndex;
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
            cell.index = newIndex;
            cell.updateDoc(newDoc);
        });
    }
}
