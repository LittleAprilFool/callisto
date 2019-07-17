import { SDBDoc } from "sdb-ts";
import { getNotebookMirror} from '../action/notebookAction';
import { getUserName } from '../action/userAction';
import { generateUUID, getRandomColor, getTime, getTimestamp } from '../action/utils';
import { AnnotationWidget } from './annotationWidget';
import { CellBinding } from './cellBinding';
import { ChangelogWidget } from './changelogWidget';
import { ChatWidget } from './chatWidget';
import { CursorWidget } from "./cursorWidget";
import { DiffTabWidget } from './diffTabWidget';
import { UserListWidget } from './userListWidget';

const Jupyter = require('base/js/namespace');

// TODO: I need a better way to check the Op type
const checkOpType = (op): string => {
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
    if (op.p.length === 4 && op.p[0] === 'notebook' && op.p[1] === 'cells' && typeof op.p[2] === 'number' && op.p[3] === 'outputs' && op.oi) return 'UpdateOutputs';

    // TypeChange
    // { p: ['notebook', 'cells', index], li, ld]}
    if (op.p.length === 3 && op.p[0] === 'notebook' && op.p[1] === 'cells' && typeof op.p[2] === 'number' && op.li && op.ld) return 'TypeChange';

    // EditCell
    if (op.p.length === 4 && op.p[0] === 'notebook' && op.p[1] === 'cells' && typeof op.p[2] === 'number' && op.p[3] === 'source' && op.t === 'text0' && op.o) return 'EditCell';

    // RenderMarkdown and UnrenderMarkdown
    // {p: ['event', 'render_markdown'], na]}
    if (op.p.length === 2 && op.p[0] === 'event' && op.p[1] === 'render_markdown' && op.na!==null) return 'RenderMarkdown';
    if (op.p.length === 2 && op.p[0] === 'event' && op.p[1] === 'unrender_markdown' && op.na!==null) return 'UnrenderMarkdown';

    // Other users join the channel
    if (op.p.length === 2 && op.p[0] === 'users' && typeof op.p[1] === 'number' && op.li!==null && !op.ld ) return 'JoinChannel';
    if (op.p.length === 2 && op.p[0] === 'users' && typeof op.p[1] === 'number' && !op.li && op.ld!==null ) return 'LeaveChannel';

    // UpdateHost
    if (op.p.length === 1 && op.p[0] === 'host' && op.oi!==null) return 'UpdateHost';

    // UpdateAnnotation
    // { p:['notebook', 'cells', index, 'outputs', outputs.length-1, 'metadata'], od, oi}
    if (op.p.length === 6 && op.p[0] === 'notebook' && op.p[1] === 'cells' && typeof op.p[2] === 'number' && op.p[3] === 'outputs' && typeof op.p[4] === 'number' && op.p[5] === 'metadata' && op.oi) return 'UpdateAnnotation';

    return 'Else';
};

export class NotebookBinding implements INotebookBinding {
    private suppressChanges: boolean = false;
    private sharedCells: ICellBinding[];
    private user: User;
    private isHost: boolean = false;
    private userListWidget: IUserListWidget;
    private chatWidget: IChatWidget;
    private cursorWidget: ICursorWidget;
    private changelogWidget: IChangelogWidget;
    private isChanged: boolean = false;
    private diffTabWidget: IDiffTabWidget;
    constructor(private sdbDoc: SDBDoc<SharedDoc>, private client: any, private ws: WebSocket, private option: SharedDocOption = {
        annotation: true,
        chat: true,
        userlist: true,
        cursor: true,
        changelog: true
    }) {
        this.sdbDoc.subscribe(this.onSDBDocEvent);
        this.eventsOn();
        
        const newUser: User = {
            user_id: generateUUID(),
            username: getUserName(),
            color: getRandomColor()
        };
        this.user = newUser;

        this.diffTabWidget = new DiffTabWidget();

        if(option.chat) {
            const chatDoc = this.sdbDoc.subDoc(['chat']);
            this.chatWidget = new ChatWidget(this.user, chatDoc);
        }

        if(option.changelog) {
            const changelogDoc = this.sdbDoc.subDoc(['changelog']);
            const identifier = this.sdbDoc.getIdentifier();
            this.changelogWidget = new ChangelogWidget(changelogDoc, this.client, identifier, this.diffTabWidget);
        } 

        this.sharedCells = [];
        getNotebookMirror().map((cellMirror, index) => {
            const p = ['notebook', 'cells', index];
            const subDoc = this.sdbDoc.subDoc(p);
            cellMirror.index = index;
            const cellBinding = new CellBinding(cellMirror, subDoc);

            if(option.annotation) {
                const cell = Jupyter.notebook.get_cell(index);
                const doc_data = subDoc.getData();
                const output_data = doc_data['outputs'];
                let widget_data = null;
                if(output_data.length >= 1) {
                    const last_output = output_data[output_data.length - 1];
                    if (last_output.hasOwnProperty('metadata')) {
                        if (last_output.metadata.hasOwnProperty('annotation')) {
                            widget_data = last_output.metadata;
                        }
                    }
                }
                const widget = new AnnotationWidget(cell, this.onUpdateAnnotation.bind(this), widget_data);
                widget.bindChatAction(this.chatWidget.onSelectAnnotation.bind(this.chatWidget));
                cellBinding.annotationWidget = widget;    
            }

            this.sharedCells.push(cellBinding);
        });

        this.onJoinChannel();

        // pull initial user list
        if(option.userlist) {
            this.userListWidget = new UserListWidget();
            const user_list = this.sdbDoc.getData().users;
            this.userListWidget.update(user_list);
        }

        if(option.cursor) {
            const cursorDoc = this.sdbDoc.subDoc(['cursor']);
            this.cursorWidget = new CursorWidget(this.user, this.sharedCells, cursorDoc);
        }

        if(option.chat && option.cursor) {
            this.cursorWidget.bindChatAction(this.chatWidget.onCursorChange.bind(this.chatWidget));
            this.chatWidget.bindCursorAction(this.cursorWidget.updateLineRefCursor.bind(this.cursorWidget));
        }

        if(option.chat && option.annotation) {
            this.chatWidget.bindAnnotationAction(this.annotationHighlight);
        }


    }

    public destroy = (): void => {
        this.sdbDoc.unsubscribe(this.onSDBDocEvent);
        this.eventsOff();
        this.sharedCells.forEach(cell => {
            cell.destroy();
        });
        if(this.userListWidget) this.userListWidget.destroy();
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
        // onUpdateAnnotation
        // this recall function is passed into each annotation widget
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
            ops.forEach(op => {
                if(source !== this) this.applyOp(op);
                if(source === this) this.applyThisOp(op);
            });
        }
    }

    private applyThisOp = (op): void => {
        switch(checkOpType(op)) {
            case 'InsertCell': {
                // send a modification log
                const log_index = this.sdbDoc.getData().changelog.length;
                const log: Changelog = {
                    user: this.user,
                    eventName: 'inserted a cell',
                    event: 'insert',
                    time: getTime(),
                    timestamp: getTimestamp() + 100
                };
                const op_log = {
                    p: ['changelog', log_index],
                    li: log
                };
                this.sdbDoc.submitOp([op_log], this);
                break;
            }
            case 'DeleteCell': {
                // send a delete log
                // todo: there is a lag between sending the delete log, and changing the sharedb snapshot
                // current solution, manually add a 100 ms delay
                const log_index = this.sdbDoc.getData().changelog.length;
                const log: Changelog = {
                    user: this.user,
                    eventName: 'deleted a cell',
                    event: 'delete',
                    time: getTime(),
                    timestamp: getTimestamp() + 100
                };
                const op_log = {
                    p: ['changelog', log_index],
                    li: log
                };
                this.sdbDoc.submitOp([op_log], this);
                break;
            }
            case 'UpdateOutputs': {
                // todo: isChanged can be also output results changed
                if(this.isChanged) {
                    this.isChanged = false;
                    const log_index = this.sdbDoc.getData().changelog.length;
                    const log: Changelog = {
                        user: this.user,
                        eventName: 'edited the notebook',
                        event: 'edit',
                        time: getTime(),
                        timestamp: getTimestamp() + 100
                    };
                    const op_log = {
                        p: ['changelog', log_index],
                        li: log
                    };
                    this.sdbDoc.submitOp([op_log], this);
                }
                break;
            }
            case 'JoinChannel': {
                // update log
                const log_index = this.sdbDoc.getData().changelog.length;
                const log: Changelog = {
                    user: this.user,
                    eventName: 'joined the channel',
                    event: 'join',
                    time: getTime(),
                    timestamp: getTimestamp()
                };
                const op_log = {
                    p: ['changelog', log_index],
                    li: log
                };
                this.sdbDoc.submitOp([op_log], this);
                break;
            }
            default: {
                break;
            }
        }
    }
        
    // apply the operations to the local Code Mirror Cells
    private applyOp = (op): void => {
        this.suppressChanges = true;
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
            case 'UpdateOutputs': {
                const {p, od, oi} = op;
                const [, , index, ] = p;
                const cell = Jupyter.notebook.get_cell(index);
                cell.clear_output();
                oi.forEach(element => {
                    cell.output_area.append_output(element);
                });
                const widget = new AnnotationWidget(cell, this.onUpdateAnnotation.bind(this), null);
                this.sharedCells[index].annotationWidget = widget;
                break;
            }
            case 'UpdateAnnotation': {
                const {p, od, oi} = op;
                const [, , index, , output_index, ] = p;
                this.sharedCells[index].annotationWidget.reloadCanvas(oi);
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
                this.chatWidget.broadcastMessage(li.username + ' joined the channel');
                const user_list = this.sdbDoc.getData().users;
                this.userListWidget.update(user_list);
                break;
            }
            case 'LeaveChannel': {
                const {p, ld} = op;
                const [, index] = p;
                this.chatWidget.broadcastMessage(ld.username + ' leaved the channel');
                const user_list = this.sdbDoc.getData().users;
                this.userListWidget.update(user_list);
                this.cursorWidget.deleteCursor(ld);
                break;
            }
            case 'UpdateHost': {
                const {p, od, oi} = op;
                this.chatWidget.broadcastMessage('The new host is ' + oi.username);
                const theHost = this.sdbDoc.getData().host;
                if (theHost === this.user) this.isHost = true;
                break;
            }
            case 'EditCell': {
                this.isChanged = true;
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
            // update user list
            const user_index = this.sdbDoc.getData().users.length;
        
            const op_user = {
                p: ['users', user_index],
                li: this.user
            };

            this.sdbDoc.submitOp([op_user], this);

            // update cursor list
            const cursor_index = this.sdbDoc.getData().cursor.length;
            const op_cursor = {
                p: ['cursor', cursor_index],
                li: {user: this.user}
            };
            this.sdbDoc.submitOp([op_cursor], this);

            // check if the notebook has host
            const oldHost = this.sdbDoc.getData().host;
            if(oldHost == null) {
                this.isHost = true;
                console.log('This is the host');
                const op_host = {
                    p: ['host'],
                    od: oldHost,
                    oi: this.user
                };
                this.sdbDoc.submitOp([op_host], this);
            }

            // send the client doc and client name to server
            this.ws.send(JSON.stringify({
                'type': 'join_room',
                'doc_name': this.sdbDoc.getIdentifier(), 
                'user': this.user 
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

        this.addAnnotation(info.cell);
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

    private onSyncInputPrompt = (cell): void => {
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

    private onUpdateAnnotation(cell): void {
        if(!this.suppressChanges) {
            const index = cell.code_mirror.index;
            const outputs = this.sharedCells[index].doc.getData().outputs;
            const last_output = outputs[outputs.length - 1];

            const remoteMetadata = last_output.metadata;
            const newMetadata = cell.metadata;    
            
            const op = {
                p:['notebook', 'cells', index, 'outputs', outputs.length-1, 'metadata'], 
                od: remoteMetadata, 
                oi: newMetadata
            };
            
            this.sdbDoc.submitOp([op], this);        
        }
    }

    // when change type, Jupyter Notebook would delete the original cell, and insert a new cell
    private createTypeChangeEvent = (): void => {
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

    private createUnrenderedMarkdownCellEvent = (): void => {
        const TextCell = require('notebook/js/textcell');
        Jupyter.ignoreRender = false;

        TextCell.MarkdownCell.prototype.unrender = function () {
            const cont = TextCell.TextCell.prototype.unrender.apply(this);
            this.notebook.set_insert_image_enabled(true);
            this.events.trigger('unrendered.MarkdownCell', this);
        };
    }

    // update shared cell bindings
    private insertSharedCell = (index: number, codeMirror): void => {
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

    private deleteSharedCell = (index: number): void => {
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

    private addAnnotation = (cell): void => {
        const index = cell.code_mirror.index;
        const widget = new AnnotationWidget(cell, this.onUpdateAnnotation.bind(this), null);
        widget.bindChatAction(this.chatWidget.onSelectAnnotation.bind(this.chatWidget));
        this.sharedCells[index].annotationWidget = widget;
    }

    private annotationHighlight = (flag, cell_index, object_index): void => {
        const widget = this.sharedCells[cell_index].annotationWidget;
        widget.highlight(flag, object_index);
        if(flag) {
            const focus_cell = document.querySelectorAll('.cell')[cell_index];
            focus_cell.scrollIntoView();
        }
    }
}
