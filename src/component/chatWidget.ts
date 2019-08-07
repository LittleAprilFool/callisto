import { Cursor, IChatWidget, IDiffTabWidget, Message, MessageItem, User } from 'types';
import { getSafeIndex } from '../action/notebookAction';
import { getTime, getTimestamp, timeAgo } from '../action/utils';

import { MessageBox } from './messageBox';
const Jupyter = require('base/js/namespace');

const checkOpType = (op): string => {
    if (op.p.length === 1 && typeof op.p[0] === 'number' && op.li && !op.ld) return 'NewMessage';
    return 'Else';
};

const options = {
    item: 'message-item',
    valueNames: [ 
        'message-sender', 
        'message-time', 
        'message-content',
        { name: 'message-id', attr: 'message-id' },
        { name: 'timestamp', attr: 'timestamp' }
    ],
    fuzzySearch: {
        searchClass: "search",
        location: 0,
        distance: 100,
        threshold: 0.4,
        multiSearch: true
      }
};

export class ChatWidget implements IChatWidget {
    private container: HTMLElement;
    private messageBox: MessageBox;
    private inputButton: HTMLButtonElement;
    private filterContainer: HTMLElement;
    private isFold: boolean = true;
    private isRead: boolean = true;
    private isEditLinking: boolean = false;
    private isFilter: boolean = false;
    private isSelect: boolean = false;
    private titleContainer: HTMLElement;
    private messageContainer: HTMLElement;
    private lastCursor: Cursor;
    private cursorCallback: any;
    private annotationCallback: any;
    private currentAnnotationHighlight: any;
    private sender: User;
    private messageList: any;

    constructor(private user: User, private doc: any, private tabWidget: IDiffTabWidget) {
        this.messageBox = new MessageBox();
        this.initContainer();
        this.initStyle();
        this.initMessageList();        

        // disable Jupyter notebook shortcuts while in the Chat
        Jupyter.keyboard_manager.register_events(this.container);
        Jupyter.notebook.events.on('select.Cell', this.onSelectCell);
        this.doc.subscribe(this.onSDBDocEvent);
        this.initMouseListener();
        this.messageBox.initQuill();
        this.initKeyboardListener();
    }

    public destroy = (): void => {
        this.container.parentNode.removeChild(this.container);
        Jupyter.notebook.events.off('select.Cell', this.onSelectCell);
        this.doc.unsubscribe(this.onSDBDocEvent);
    }

    public reload = (): void => {
        // reload chat
        this.container.parentNode.removeChild(this.container);
        this.initContainer();
        this.initMessageList();
        Jupyter.keyboard_manager.register_events(this.container);        
        this.initMouseListener();
        this.initKeyboardListener();
    }

    public broadcastMessage = (message: string): void => {
        const broadcastMessageEL = document.createElement('div');
        broadcastMessageEL.innerText = message;
        broadcastMessageEL.classList.add('broadcast-message');
        this.messageContainer.appendChild(broadcastMessageEL);
    }

    public bindCursorAction = (callback): void => {
        this.cursorCallback = callback;
    }

    public bindAnnotationAction = (callback): void => {
        this.annotationCallback = callback;
    }

    public onSelectAnnotation = (cell_index: number, object_index: number): void => {
        if(!this.isFold && this.isSelect) {
            this.handleMagicToggle();
            const cuid = Jupyter.notebook.get_cell(cell_index).uid;
            this.messageBox.appendRef('marker', {
                type: "MARKER",
                cell_index,
                marker_index: object_index
            });
        }
    }

    public onSelectCursor = (cursor: Cursor): void => {
        if(JSON.stringify(cursor) === JSON.stringify(this.lastCursor)) {
            return;
        }
        else {
            this.lastCursor = cursor;
        }
        if(!this.isFold && this.isSelect) {
            if(cursor.from!==cursor.to) {
                const cell = Jupyter.notebook.get_cell(cursor.cm_index);
                const cuid = cell.uid;
                const text = cell.code_mirror.getSelection();
                this.messageBox.appendRef(text, {
                    type: "CODE",
                    cell_index: cursor.cm_index,
                    code_from: cursor.from,
                    code_to: cursor.to
                });
                this.handleMagicToggle();
            }
        }
    }

    public onSelectDiff = (label: string): void => {
        if (!this.isFold && this.isSelect) {
            this.handleMagicToggle();
            if(label === 'version-current') {
                const timestamp = getTimestamp().toString();
                this.messageBox.appendRef('notebook-snapshot', {
                    type: "SNAPSHOT",
                    version: timestamp.toString()
                });
            }
            else if(label.includes('version')) {
                const tag = label.split('-');
                this.messageBox.appendRef('notebook-snapshot', {
                    type: "SNAPSHOT",
                    version: tag[1]
                });
            }
            else if (label.includes('diff')) {
                const tag = label.split('-');
                this.messageBox.appendRef('notebook-diff', {
                    type: "DIFF",
                    version: tag[1],
                    version_diff: tag[2]
                });
            }
        }
    }

    private onSelectCell = (evt, info): void => {
        const cell = info.cell;
        const id = getSafeIndex(cell);

        if(this.isFold) return;
        if(this.isSelect) {
            const cuid = info.cell.uid;
            this.messageBox.appendRef("cell", {
                type: "CELL",
                cell_index: id
            });
            this.handleMagicToggle();
        }
        if(this.isEditLinking) {
            const cellEl_list = document.querySelectorAll('.cell');
            const cellEl_select = cellEl_list[id];
            const flag = cellEl_select.classList.contains('highlight');
            if(flag) {
                cellEl_select.classList.remove('highlight');
                cell.unselect();
            }
            else {
                cell.select();
                cellEl_select.classList.add('highlight');
            }
            cellEl_list.forEach((cellEl, index) => {
                if(cellEl.classList.contains('highlight')) {
                    const cell_mr = Jupyter.notebook.get_cell(index);
                    cell_mr.select();
                }
            });
        }
        else {
            // display filter
            if(this.isFilter) {
                this.loadFilteredMessages();
                this.updateCellHighlight(true);
            }
            else {
                const selected_cells = Jupyter.notebook.get_selected_cells();
                if (selected_cells.length > 1) {
                    selected_cells.forEach(c => {
                        c.unselect();
                    });
                    cell.select();
                }
                this.updateCellHighlight(false);
            }
        }
    }

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            ops.forEach(op => this.applyOp(op));
        }
    }

    private applyOp = (op): void => {
        if(checkOpType(op) === 'NewMessage') {
            this.updateMessageList(op.li, this.doc.getData().length -1);
            if(this.isFold) this.notifyNewMessage(true);
        }
    } 

    private handleLineRef = (e): void => {
        e.stopPropagation();
        const line_refs = e.currentTarget.getAttribute('ref');
        const line_ref = line_refs.split('|');
        const ref1 = line_ref[0];
        if(line_ref.length === 1) {
            if(ref1[0] === 'C') {
                const cuid = ref1.slice(1);
                const cell_index = this.uidToId(cuid);
                // console.log(cuid);
                // const cell_index = parseInt(ref1.slice(1), 0);
                this.tabWidget.checkTab('version-current');
                if(cell_index !== -1) {
                    Jupyter.notebook.select(cell_index);
                    this.updateCellHighlight(true);    
                }
            }
            if(ref1[0] === 'V') {
                const timestamp = parseInt(ref1.slice(1), 0);
                const label = 'version-'+timestamp.toString();
                if(this.tabWidget.checkTab(label)) return;
    
                this.tabWidget.addTab(label, 'version', timestamp);
                const title = timeAgo(timestamp);
                this.tabWidget.addVersion(timestamp, title);
            }
        }
        if(line_ref.length === 2) {
            if(ref1[0] === 'C') {
                const cuid = ref1.slice(1);
                const cell_index = this.uidToId(cuid);
                if (cell_index !== -1) {
                    const ref2 = line_ref[1];
                    const object_index = parseInt(ref2.slice(1), 0);
                    this.currentAnnotationHighlight = {cell_index, object_index};
                    this.tabWidget.checkTab('version-current');
                    this.annotationCallback(true, cell_index, object_index);
                }
                // const cell_index = parseInt(ref1.slice(1), 0);
            }
            if(ref1[0] === 'V') {
                const new_timestamp = parseInt(ref1.slice(1), 0);
                const ref2 = line_ref[1];
                const old_timestamp = parseInt(ref2.slice(1), 0);
                const label = 'diff-'+new_timestamp.toString()+ '-' + old_timestamp.toString();
                if(this.tabWidget.checkTab(label)) return;

                this.tabWidget.addTab(label, 'diff', new_timestamp);
                this.tabWidget.addDiff(new_timestamp, old_timestamp, new_timestamp.toString());
            }
        }
        if(line_ref.length === 3) {
            if(ref1[0] === 'C') {
                this.tabWidget.checkTab('version-current');
                const cuid = ref1.slice(1);
                const cell_index = this.uidToId(cuid);
                // const cell_index = parseInt(ref1.slice(1), 0);
                if(cell_index!== -1) {
                    const ref2 = line_ref[1]; 
                    const ref3 = line_ref[2];
                    const from = parseInt(ref2.slice(1), 0);
                    const to = parseInt(ref3.slice(1), 0);
                    this.cursorCallback(true, cell_index, from, to);
                }
            }
        }
    }

    private uidToId = (uid: string): number => {
        const cells = Jupyter.notebook.get_cells();
        let id = -1;
        cells.forEach((cell, index) => {
            if (cell.uid === uid) id = index;
        });
        return id;
    }

    private handleSnapshot = (e): void => {
        const selected_messages = document.querySelectorAll('.message-wrapper.select');
        selected_messages.forEach(message => {
            message.classList.remove('select');
        });
        this.updateInputStatus();

        const selected_message = selected_messages[0];
        const selected_message_child = selected_message.lastChild as HTMLElement;
        const timestamp = parseInt(selected_message_child.getAttribute('timestamp'), 0);
        const label = 'version-'+timestamp.toString();
        if(this.tabWidget.checkTab(label)) return;

        this.tabWidget.addTab(label, 'version', timestamp);
        this.tabWidget.addVersion(timestamp, timestamp.toString());
    }

    private handleDiff = (e): void => {
        const selected_messages = document.querySelectorAll('.message-wrapper.select');
        selected_messages.forEach(message => {
            message.classList.remove('select');
        });
        this.updateInputStatus();

        const selected_message1 = selected_messages[0];
        const selected_message_child1 = selected_message1.lastChild as HTMLElement;
        const timestamp1 = parseInt(selected_message_child1.getAttribute('timestamp'), 0);
        
        const selected_message2 = selected_messages[1];
        const selected_message_child2 = selected_message2.lastChild as HTMLElement;
        const timestamp2 = parseInt(selected_message_child2.getAttribute('timestamp'), 0);

        const old_timestamp = timestamp1 > timestamp2? timestamp2: timestamp1;
        const new_timestamp = timestamp1 > timestamp2? timestamp1: timestamp2;

        const label = 'diff-'+new_timestamp.toString()+ '-' + old_timestamp.toString();
        if(this.tabWidget.checkTab(label)) return;

        this.tabWidget.addTab(label, 'diff', new_timestamp);
        this.tabWidget.addDiff(new_timestamp, old_timestamp, new_timestamp.toString());
    }

    private handleFolding = (): void => {
        this.isFold = !this.isFold;
        if(this.isFold) {
            // fold container, turn off filter
            this.container.style.bottom = '-460px';
            this.filterContainer.style.display = 'none';
            if(this.isFilter) {
                // turn off filter
                this.updateFilter(false);
                this.updateTitle('chat');
                this.updateCellHighlight(false);
            }
        }
        else {
            this.container.style.bottom = '20px';
            if(!this.isRead) this.notifyNewMessage(false);
            this.filterContainer.style.display = 'inline-block';
        }
    }

    private handleFiltering = (e): void => {
        
        this.isFilter = !this.isFilter;
        const filter_button = document.querySelector('#tool-filter');
        filter_button.classList.toggle('active');
        const message_container = document.querySelector('#message-container') as HTMLElement;

        if(this.isFilter) {
            this.loadFilteredMessages();
            this.updateCellHighlight(true);
            message_container.classList.add('filtermode');
        }
        else {
            this.messageList.filter();
            this.updateCellHighlight(false);
            message_container.classList.remove('filtermode');
        }
        this.tabWidget.checkTab('version-current');
    }

    private handleSubmitting = (): void => {
        this.inputButton.blur();
        
        const related_cells = [];

        // a naive way to connect cells with messages

        // link chat message with related cells
        const re = /\[(.*?)\]\((.*?)\)/g;
        const origin_text = this.messageBox.getSubmissionValue();
        const line_refs = origin_text.match(re);

        if(line_refs!==null) {
            line_refs.forEach(line_ref => {
                line_ref.match(re);
                const line_ref_list = RegExp.$2.split(', ');
                const first_el = line_ref_list[0];
                if(first_el[0] === 'C') {
                    const cell_index = first_el.slice(1);
                    if(cell_index !== null && !related_cells.includes(cell_index)) related_cells.push(cell_index);
                }
            });
        }
        else {
            // link chat message with the cell that someone clicks on
            const current_cell = Jupyter.notebook.get_selected_cell();
            if(current_cell) related_cells.push(current_cell.uid);
        }
        getTimestamp().then(data=> {
            const newMessage: Message = {
                sender: this.user,
                content: this.messageBox.getSubmissionValue(),
                time: getTime(),
                timestamp: parseInt(data, 0),
                cells: related_cells
            };
            const index = this.doc.getData().length;
    
            const op = {
                p: [index],
                li: newMessage
            };
    
            if (this.messageBox.getSubmissionValue()) this.doc.submitOp([op], this);
            this.messageBox.clear();
        });
    }

    private handleMessageSelect = (e): void => {
        if ((window as any).study_condition === 'control') return;
        // change UI
        this.tabWidget.checkTab('version-current');
        e.currentTarget.classList.toggle('select');
        this.updateInputStatus();
    }

    private loadFilteredMessages = (): void => {
        const cell = Jupyter.notebook.get_selected_cell();
        if(cell) {
            const cell_index = cell.uid;
            const chat_data = this.doc.getData();
            let flag = false;
            const filter_list = [];
            chat_data.forEach((element, index) => {
                const message: Message = element;
                if(message.cells.includes(cell_index)) {
                    flag = true;
                    filter_list.push(index);
                }
            });

            this.messageList.filter(item => {
                const data = item.values();
                const id = parseInt(data['message-id'], 0);
                if(filter_list.includes(id)) return true;
                else return false;
            });
            
            if(!flag) {
                this.broadcastMessage('No relevant chat messages');
            }
        }
    }

    private getMessageInfo = (message: Message, index: number): MessageItem => {
        const re = /\[(.*?)\]\((.*?)\)/g;
        const url_re = /(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+/g;
        const line_break_re = /\n/g;
        this.sender = message.sender;
        const origin_text = message.content;    
        const formated_text = origin_text.replace(re, this.replaceLR).replace(url_re, this.replaceURL).replace(line_break_re, '<br/>');
    
        const message_info: MessageItem = {
            'message-sender': message.sender.username,
            'message-content': formated_text,
            'message-time': message.time,
            'message-id': index.toString(),
            'timestamp': message.timestamp.toString(),
        };
        return message_info;
    }

    private initMessageList = (): void => {
        const values = [];
        const history = this.doc.getData();
        history.forEach((message, index) => {
            const message_info = this.getMessageInfo(message, index);
            values.push(message_info);
        });
        this.messageList = new window['List']('message-list', options, values);
        const last = this.messageContainer.lastChild as HTMLElement;
        if(last) last.scrollIntoView();
        this.updateListener();
    }

    private updateMessageList = (message: Message, id: number): void => {
        const message_info = this.getMessageInfo(message, id);
        this.messageList.add(message_info);
        const last = this.messageContainer.lastChild as HTMLElement;
        if(last) last.scrollIntoView();
        this.updateListener();
    }

    private notifyNewMessage = (flag: boolean): void => {
        if(flag) {
            this.updateTitle('new');
            this.isRead = false;
        }
        else {
            this.updateTitle('chat');
            this.isRead = true;
        }
    }

    private updateInputStatus = (status?: string): void => {
        const snapshot = document.querySelector('#input-snapshot');
        const diff = document.querySelector('#input-diff');
        const other = document.querySelector('#input-other');
        const input = document.querySelector('#input-container');
        const save = document.querySelector('#input-save');

        snapshot.setAttribute('style', 'display:none');
        diff.setAttribute('style', 'display:none');
        other.setAttribute('style', 'display:none');
        save.setAttribute('style', 'display:none');
        input.setAttribute('style', 'display: none');
        this.isSelect = false;
        this.isEditLinking = false;

        if(status === 'save') {
            this.isEditLinking = true;
            this.handleLinkingDisplay();
            save.setAttribute('style', 'display: block');
            return;
        }

        const selected_messages = document.querySelectorAll('.message-wrapper.select');
        switch(selected_messages.length) {
            case 0:
                input.setAttribute('style', 'display: block');
                const selected_cells = Jupyter.notebook.get_selected_cells();
                if (selected_cells.length > 1) {
                    selected_cells.forEach(c => { c.unselect();});
                }
                const highlighted_cells = document.querySelectorAll('.cell.highlight');
                highlighted_cells.forEach(c => { c.classList.remove('highlight'); });
                break;
            case 1:
                snapshot.setAttribute('style', 'display: block');
                this.handleLinkingDisplay();
                break;
            case 2:
                diff.setAttribute('style', 'display: block');
                this.handleLinkingDisplay();
                break;
            default:
                other.setAttribute('style', 'display: block');
                this.handleLinkingDisplay();
                break;
        }
    }

    private replaceLR = (p1: string, p2: string, p3: string): string => {
        const refEl = document.createElement('span');
        refEl.innerText = p2;
        refEl.setAttribute('timestamp', getTimestamp().toString());
        refEl.setAttribute('source', this.sender.user_id);
        const tag = p3.replace(/, /g, '|');
        refEl.setAttribute('ref', tag);
        let ref_type = '';
        const line_ref = tag.split('|');
        const ref1 = line_ref[0];
        if(line_ref.length === 1) {
            if(ref1[0] === 'C') {
                ref_type = 'cell';
            }
            if(ref1[0] === 'V') {
                ref_type = 'snapshot';
            }
        }
        if(line_ref.length === 2) {
            if(ref1[0] === 'C') {
                ref_type = 'marker';
            }
            if(ref1[0] === 'V') {
                ref_type = 'diff';
            }
        }
        if(line_ref.length === 3) {
            if(ref1[0] === 'C') {
                ref_type = 'code';
            }
        }
        refEl.setAttribute('ref_type', ref_type);
        if((window as any).study_condition === 'experiment') {
            refEl.classList.add(ref_type);
            refEl.classList.add('line_ref');    
        }
        return refEl.outerHTML;
    }

    private replaceURL = (p1: string, p2: string, p3: string): string => {
        const URL_el = document.createElement('a');
        URL_el.href = p1;
        URL_el.innerHTML = p1;
        URL_el.target = '_blank';
        return URL_el.outerHTML;
    }

    private updateCellHighlight = (flag: boolean): void => {
        const old_cells = document.querySelectorAll('.cell.highlight');
        old_cells.forEach(cell => {
            cell.classList.remove('highlight');
        });
        
        if(flag) {
            const cells = document.querySelectorAll('.cell.selected');
            if (cells[0] && !this.isEditLinking) {
                cells[0].scrollIntoView();
            }
            cells.forEach(cell => {
                cell.classList.add('highlight');
            });
        }

        const highlighted_cells = document.querySelectorAll('.cell.highlight');
        const tool_linking = document.getElementById('tool-linking');
        tool_linking.childNodes[0].nodeValue = 'EDIT LINK (' + highlighted_cells.length.toString() + ')';
    }

    private updateFilter = (flag: boolean): void => {
        this.isFilter = flag;
        const input = this.filterContainer.firstChild as HTMLInputElement;
        input.checked = flag;
    }

    private updateListener = (): void => {
        this.updateLineRefListener();
        this.updateSelectionListener();
    }

    private updateLineRefListener = (): void => {
        const tags = document.querySelectorAll('.line_ref');
        tags.forEach(tag => {
            const el = tag as HTMLElement;
            if(!el.onclick) el.addEventListener('click', this.handleLineRef);
        });
    }

    private updateSelectionListener = (): void => {
        const messages = document.querySelectorAll('.message-wrapper');
        messages.forEach(message => {
            const el = message as HTMLElement;
            if(!el.onclick) message.addEventListener('click', this.handleMessageSelect);
        });
    }

    private updateTitle = (flag): void => {
        const el = this.titleContainer.childNodes[1] as HTMLElement;
        const icon = this.titleContainer.childNodes[0] as HTMLElement;

        switch (flag) {
            case 'chat':
                    el.innerText = 'Chat';
                    icon.innerHTML = '<i class="fa fa-comment"></i>';
                    break;
            case 'new':
                    el.innerText = 'New Message!';
                    icon.innerHTML = '<i class="fa fa-ellipsis-h"></i>';
                    break;

            case 'filter':
                    el.innerText = 'Filter: On';
                    icon.innerHTML = '<i class="fa fa-filter"></i>';
                    break;
            default:
        }
    }

    private initMouseListener = (): void => {
        if ((window as any).study_condition === 'control') return;
        document.body.onmousedown = ()=> {
            this.cursorCallback(false);
            if(this.currentAnnotationHighlight) {
                this.annotationCallback(false, this.currentAnnotationHighlight.cell_index, this.currentAnnotationHighlight.object_index);
                this.currentAnnotationHighlight = null;
            }
        };

    }

    private handleCancel = (e?): void => {
        const selected_messages = document.querySelectorAll('.message-wrapper.select');
        selected_messages.forEach(message => {
            message.classList.remove('select');
        });
        const old_cells = Jupyter.notebook.get_selected_cells();
        old_cells.forEach(cell => {
            cell.unselect();
        });

        if(!this.isFilter) this.updateCellHighlight(false);
        this.updateInputStatus();
    }

    private getCurrentList = (): string[] => {
        const selected_messages = document.querySelectorAll('.message-wrapper.select');
        const history = this.doc.getData();
        const contentEl0 = selected_messages[0].lastChild as HTMLElement;
        const id0 = parseInt(contentEl0.getAttribute('message-id'), 0);
        const message0 = history[id0];
        let cell_list = message0.cells;

        selected_messages.forEach(messageEl => {
            const contentEl = messageEl.lastChild as HTMLElement;
            const id = contentEl.getAttribute('message-id');
            const message = history[id];
            if(message) {
                const cells = message.cells;
                const intersection = cell_list.filter(v => cells.indexOf(v) > -1);
                cell_list = intersection;
            }
        });
        return cell_list;
    }

    private handleLinking = (e): void => {
        this.updateInputStatus('save');
    }

    private handleMagicToggle = (e?): void => {
        const magic_button = document.querySelector('#magic-button');
        const notebook = document.querySelector('#notebook');
        notebook.classList.toggle('select');
        magic_button.classList.toggle('active');
        this.isSelect = !this.isSelect;
    }

    private getNewList= (): string[] => {
        const selected_cells = Jupyter.notebook.get_selected_cells();
        const selected_cells_list = [];
        selected_cells.forEach(cell => {
            selected_cells_list.push(cell.uid);
        });
        return selected_cells_list;

    }

    private handleLinkingSave = (): void => {
        const cell_list = this.getCurrentList();
        const new_list = this.getNewList();
        const messages = document.querySelectorAll('.message-wrapper');
        const history = this.doc.getData();
        messages.forEach((message, id) => {
            if(message.classList.contains('select')) {
                const old_message= history[id-1];
                const new_message = Object.assign({}, old_message);
                const diff_list = new_message.cells.filter(v => cell_list.indexOf(v) === -1);
                const union_list = diff_list.concat(new_list.filter(v => diff_list.indexOf(v) === -1));                
                new_message.cells = union_list;

                if(old_message.cells !== new_message.cells) {
                    const op = {
                        p: [id-1],
                        ld: old_message,
                        li: new_message
                    };
                    this.doc.submitOp([op], this);
                }
            }
        });

        this.handleCancel();
    }

    private handleLinkingDisplay = (): void => {
        const cell_list = this.getCurrentList();

        this.tabWidget.checkTab('version-current');
        const old_cells = Jupyter.notebook.get_selected_cells();
        old_cells.forEach(cell => {
            cell.unselect();
        });
        cell_list.forEach(uid => {
            const index = this.uidToId(uid);
            const cell = Jupyter.notebook.get_cell(index);
            cell.select();
        });
        this.updateCellHighlight(true);
    }

    private handleSearch = (): void => {
        const input = document.querySelector('#search-input') as HTMLInputElement;
        const keyword = input.value;
        const message_container = document.querySelector('#message-container') as HTMLElement;
        
        if(keyword === '') {
            this.messageList.search();
            message_container.classList.remove('searchmode');
        }
        else {
            this.messageList.search(keyword, ['message-content']);
            message_container.classList.add('searchmode');
        }
    }

    private handleEnterKey = (e: KeyboardEvent): void => {
        if(e.which === 13 && !e.shiftKey) {
            this.handleSubmitting();
            e.preventDefault();
        }
    }

    private initContainer = (): void => {
        this.container = document.createElement('div');
        this.container.id = 'chat-container';

        const head_container = document.createElement('div');
        head_container.id = 'head-container';

        const title_container = document.createElement('div');
        title_container.id = 'title-container';

        title_container.addEventListener('click', this.handleFolding);

        head_container.appendChild(title_container);

        const tool_container = document.createElement('div');
        tool_container.id = 'tool-container';
        
        const tool_search = document.createElement('div');
        tool_search.classList.add('head-tool');
        tool_search.id = 'tool-search';
        const search_icon = document.createElement('i');
        search_icon.innerHTML = '<i class="fa fa-search">';
        const search_input = document.createElement('input');
        search_input.classList.add('search');
        search_input.placeholder = 'Search';
        search_input.id = 'search-input';
        search_input.addEventListener('input', this.handleSearch);
        tool_search.appendChild(search_input);
        tool_search.appendChild(search_icon);

        const tool_filter = document.createElement('div');
        tool_filter.innerHTML = '<i class="fa fa-filter">';
        tool_filter.classList.add('head-tool');
        tool_filter.id = 'tool-filter';
        tool_filter.addEventListener('click', this.handleFiltering);
        tool_container.appendChild(tool_search);
        if ((window as any).study_condition === 'experiment') tool_container.appendChild(tool_filter);

        head_container.appendChild(tool_container);

        const message_container_wrapper = document.createElement('div');
        message_container_wrapper.id = 'message-list';

        const message_container = document.createElement('ul');
        message_container.classList.add('list');
        message_container.id = 'message-container';

        const message_item_template = document.createElement('div');
        message_item_template.setAttribute('style', 'display: none');
        const message_item = document.createElement('li');
        message_item.id = 'message-item';
        message_item.classList.add('message-wrapper');

        const message_tick = document.createElement('i');
        message_tick.innerHTML = '<i class="fa fa-check-circle tick"></i>';
        if ((window as any).study_condition === 'experiment') message_item.appendChild(message_tick);

        const message_content = document.createElement('div');
        message_content.classList.add('message-content');
        message_content.classList.add('message-id');
        message_content.classList.add('timestamp');


        const message_sender = document.createElement('div');
        message_sender.classList.add('message-sender');
        
        const message_time = document.createElement('div');
        message_time.classList.add('message-time');

        const time_sender = document.createElement('div');
        time_sender.appendChild(message_sender);
        time_sender.appendChild(message_time);

        message_item.appendChild(time_sender);
        message_item.appendChild(message_content);

        message_item_template.appendChild(message_item);
        
        this.container.appendChild(message_item_template);
        
        message_container_wrapper.appendChild(message_container);

        const input_container = document.createElement('div');
        input_container.id = 'input-container';

        const el = document.createElement('div');
        const icon = document.createElement('i');
        el.innerText = 'Chat';
        el.id = 'chat-title';
        icon.innerHTML = '<i class="fa fa-comment"></i>';
        title_container.appendChild(icon);
        title_container.appendChild(el);
        
        const button_icon = document.createElement('i');
        button_icon.innerHTML = '<i class="fa fa-paper-plane"></i>';

        const input_button = document.createElement('button');
        input_button.appendChild(button_icon);
        input_button.id = 'send-button';
        input_button.classList.add('input-button');

        const magic_icon = document.createElement('i');
        magic_icon.innerHTML = '<i class="fa fa-magic"></i>';

        const magic_button = document.createElement('button');
        magic_button.appendChild(magic_icon);
        magic_button.id = 'magic-button';
        magic_button.classList.add('input-button');
        const button_group = document.createElement('div');
        if ((window as any).study_condition === 'experiment') button_group.appendChild(magic_button);
        // button_group.appendChild(input_button);

        const input_and_button_div = document.createElement('div');
        input_and_button_div.appendChild(this.messageBox.el);
        
        input_button.addEventListener('click', this.handleSubmitting);
        if ((window as any).study_condition === 'experiment') magic_button.addEventListener('click', this.handleMagicToggle);
       
        input_container.appendChild(input_and_button_div);
        input_container.appendChild(button_group);

        const input_snapshot = document.createElement('div');
        input_snapshot.id = 'input-snapshot';
        input_snapshot.classList.add('input-label');
        
        const cancel_button = document.createElement('button');
        cancel_button.innerText = 'CANCEL';
        cancel_button.classList.add('cancel-selection');
        cancel_button.addEventListener('click', this.handleCancel);

        const tool_snapshot = document.createElement('div');
        tool_snapshot.innerText = 'SNAPSHOT';
        const snapshot_icon = document.createElement('i');
        snapshot_icon.innerHTML = '<i class="fa fa-code">';
        tool_snapshot.appendChild(snapshot_icon);
        tool_snapshot.classList.add('tool-button');
        tool_snapshot.id = 'tool-version';
        tool_snapshot.addEventListener('click', this.handleSnapshot);

        const tool_linking = document.createElement('div');
        tool_linking.id = 'tool-linking';
        tool_linking.innerText = 'EDIT LINK';
        const linking_icon = document.createElement('i');
        linking_icon.innerHTML = '<i class="fa fa-link">';
        tool_linking.appendChild(linking_icon);
        tool_linking.classList.add('tool-button', 'tool-linking');
        tool_linking.addEventListener('click', this.handleLinking);


        input_snapshot.appendChild(tool_snapshot);
        input_snapshot.appendChild(tool_linking);
        input_snapshot.appendChild(cancel_button);
        input_snapshot.setAttribute('style', 'display: none');

        const input_diff = document.createElement('div');

        input_diff.id = 'input-diff';
        input_diff.classList.add('input-label');

        const tool_diff = document.createElement('div');
        tool_diff.innerText = 'DIFF';
        const diff_icon = document.createElement('i');
        diff_icon.innerHTML = '<i class="fa fa-history">';
        tool_diff.appendChild(diff_icon);
        tool_diff.classList.add('tool-button');
        tool_diff.id = 'tool-diff';
        tool_diff.addEventListener('click', this.handleDiff);

        const cancel_button2 = cancel_button.cloneNode(true);
        cancel_button2.addEventListener('click', this.handleCancel);

        const tool_linking2 = tool_linking.cloneNode(true);
        tool_linking2.addEventListener('click', this.handleLinking);

        input_diff.appendChild(tool_diff);
        input_diff.appendChild(tool_linking2);
        input_diff.appendChild(cancel_button2);
        input_diff.setAttribute('style', 'display: none');

        const input_other = document.createElement('div');
        input_other.id = 'input-other';
        input_other.classList.add('input-label');

        const cancel_button3 = cancel_button.cloneNode(true);
        cancel_button3.addEventListener('click', this.handleCancel);

        const tool_linking3 = tool_linking.cloneNode(true);
        tool_linking3.addEventListener('click', this.handleLinking);

        input_other.appendChild(tool_linking3);
        input_other.appendChild(cancel_button3);
        input_other.setAttribute('style', 'display:none');

        const input_save = document.createElement('div');
        input_save.id = 'input-save';
        input_save.classList.add('input-label');

        const cancel_button4 = cancel_button.cloneNode(true);
        cancel_button4.addEventListener('click', this.handleCancel);

        const tool_save = document.createElement('div');
        tool_save.innerText = 'SAVE CHANGE';
        const save_icon = document.createElement('i');
        save_icon.innerHTML = '<i class="fa fa-save">';
        tool_save.appendChild(save_icon);
        tool_save.classList.add('tool-button', 'tool-save');
        tool_save.addEventListener('click', this.handleLinkingSave);

        input_save.appendChild(tool_save);
        input_save.appendChild(cancel_button4);
        input_save.setAttribute('style', 'display: none');
        
        this.container.appendChild(head_container);
        this.container.appendChild(message_container_wrapper);
        this.container.appendChild(input_snapshot);
        this.container.appendChild(input_diff);
        this.container.appendChild(input_other);
        this.container.appendChild(input_save);
        this.container.appendChild(input_container);

        const main_container = document.querySelector('#notebook_panel');
        main_container.appendChild(this.container);

        this.titleContainer = title_container;
        this.inputButton = input_button;
        this.messageContainer = message_container;
        this.filterContainer = tool_filter;
    }

    private initStyle = (): void => {
        // update style
        const sheet = document.createElement('style');
        sheet.innerHTML += '#notebook.select * {cursor: crosshair}\n';
        sheet.innerHTML += '#chat-container { height: 500px; width: 300px; float:right; margin-right: 50px; position: fixed; bottom: -460px; right: 0px; z-index:100; border-radius:10px; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); background: white;  transition: bottom .5s; } \n';
        sheet.innerHTML += '#head-container { color: #516766; font-weight: bold; text-align: center; background-color: #9dc5a7; border-radius: 10px 10px 0px 0px; } \n';
        sheet.innerHTML += '#tool-container { text-align: center; margin-top: 5px; padding: 5px; background: white; border-bottom: 1px solid #eee}\n';
        sheet.innerHTML += '.tool-button {font-size:10px; margin-left: 10px; display: inline-block; padding: 5px 10px; background: #709578;color: white; border-radius: 3px; cursor: pointer; }\n';
        sheet.innerHTML += '.tool-button i {margin-left: 1px; }\n';

        sheet.innerHTML += '.head-tool { height: 22px; margin-right: 10px; border: 1px solid #eee; padding: 0px 10px; display: inline-block}\n';
        sheet.innerHTML += '#tool-filter.active {background: #dae4dd; color: #516766}\n';
        sheet.innerHTML += '#tool-search input { font-weight: normal; color: #aaa; outline: none; border: none; width: 185px; font-size: 10px; margin-right: 5px;}\n';
        sheet.innerHTML += '#title-container {padding: 8px; cursor: pointer; }\n';
        sheet.innerHTML += '#message-container { height: 370px; background-color: white; overflow:scroll; } \n';
        sheet.innerHTML += '#message-container.searchmode::before {content: "Search Mode"; display: block; font-weight: bold; color: #bbb; padding-top: 5px; text-align: center;}\n';
        sheet.innerHTML += '#message-container.filtermode::before {content: "Filter Mode"; display: block; font-weight: bold; color: #bbb; padding-top: 5px; text-align: center;}\n';
        sheet.innerHTML += '.select.message-content {cursor: pointer; transition: .4s}\n';
        sheet.innerHTML += '.selected.message-content {background:#dae5dd; }\n';
        sheet.innerHTML += '.cancel-selection {background: none; border: none; color: #155725ab; float: right; }\n';

        sheet.innerHTML += '.select.message-content:hover {background:#dae5dd; }\n';
        sheet.innerHTML += '#input-container { height: 50px; width: 280px; background-color: white; border: solid 2px #ececec; border-radius: 10px; margin:auto;} \n';
        sheet.innerHTML += '.input-label { color: #bbb; font-size: 12px; font-weight: bold; padding: 15px 15px; height: 50px; width: 300px; border-top: 1px solid #eee; margin:auto;} \n';
        sheet.innerHTML += '#input-box { padding-left: 10px; padding-right: 10px; font-size: 12px; color: #7d7d7d; width: 220px; border: none; background-color: transparent; resize: none;outline: none; } \n';
        sheet.innerHTML += '.input-button { font-size: 14px; padding: 0px 0px; color: #868686; display:inline; height:46px; width: 25px; position: relative; background: transparent; border: none;} \n';
        sheet.innerHTML += '.input-button.active {color: #9dc5a7;}\n';
        sheet.innerHTML += '.input-button:focus {outline:none}\n';
        sheet.innerHTML += '#chat-title { display: inline; margin-left: 8px; } \n';

        sheet.innerHTML += '.message-wrapper { list-style: none; padding: 8px 20px; margin: 4px 0px;} \n';
        sheet.innerHTML += '.message-wrapper.select {background: #9dc5a73d;}\n';
        sheet.innerHTML += '#message-container {padding: 0px 0px; margin: 0px 0px; }\n';
        sheet.innerHTML += '#message-box strong {font-weight: normal; font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}\n';
        sheet.innerHTML += '.message-sender { display:inline; font-size: 10px; font-weight: bold; } \n';
        sheet.innerHTML += '.message-content { display: inline-block; background: whitesmoke; left: 5px; position: relative; padding: 10px; border-radius: 12px; min-width: 100px; font-size: 12px; } \n';
        sheet.innerHTML += '.message-time { float: right; font-size: 10px; display:inline; margin-left: 10px; color: #b7b7b7; } \n';
        sheet.innerHTML += '.broadcast-message { text-align: center; font-size: 12px; color: #b7b7b7; } \n';
        sheet.innerHTML += '.tick {float: left; position: relative; top: 3px; left: -12px; color: white; font-size: 15px;}\n';
        sheet.innerHTML += '.message-wrapper:hover .tick {color: #9dc5a73d;}\n';
        sheet.innerHTML += '.message-wrapper.select .tick {color: #9dc5a7;}\n';

        sheet.innerHTML += '.line_highlight { background-color: yellow; } \n';

        sheet.innerHTML += '.line_ref { display: inline-block; margin: 0px 2px; cursor: pointer; font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; } \n';
        sheet.innerHTML += '.line_ref:hover { text-decoration: underline; } \n';
        sheet.innerHTML += '.line_ref.cell { color: #008000; }\n';
        sheet.innerHTML += '.line_ref.code { color: #aa1111; }\n';
        sheet.innerHTML += '.line_ref.marker { color: #9d00e8; }\n';
        sheet.innerHTML += '.line_ref.snapshot { color: #0e66dc; }\n';
        sheet.innerHTML += '.line_ref.diff { color: #ff7a00; }\n';

        sheet.innerHTML += '#message-box { float: left; } \n';
        sheet.innerHTML += '.ql-editor {padding: 2px 10px; font-size: 12px;}';

        sheet.innerHTML += '#slider {border-radius: 20px; position: absolute; cursor: pointer; background-color: #516666; transition: .4s; top: 0; left: 0; right: 0; bottom: 0; } \n';
        sheet.innerHTML += '#slider:before {position:absolute; content:" ";height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: #9cc4a6; transition:.4s; border-radius: 50%; } \n';
        sheet.innerHTML += '#switch {display: none; position: relative; bottom: 378px; left: 20px; width: 40px; height: 20px; } \n';
        sheet.innerHTML += '#switch input {opacity: 0; width: 0; height: 0; } \n';
        sheet.innerHTML += 'input:checked + #slider { background-color: #dae4dd; } \n';
        sheet.innerHTML += 'input:focus + #slider { box-shadow: 0 0 1px #dae4dd; } \n';
        sheet.innerHTML += 'input:checked + #slider:before { transform: translateX(20px); } \n';
        sheet.innerHTML += '.cell.highlight {background: #e8f1eb;} \n';

        sheet.innerHTML += '[data-title] {position: relative;}\n';
        sheet.innerHTML += '[data-title]:hover::before {content: attr(data-title);position: absolute;bottom: -30px;display: inline-block;padding: 3px 6px;border-radius: 2px;background: #000;color: #fff;font-size: 10px;font-family: sans-serif;white-space: nowrap;}\n';
        sheet.innerHTML += '[data-title]:hover::after {content: "";position: absolute;bottom: -10px;left: 17px;display: inline-block;color: #fff;border: 8px solid transparent;	border-bottom: 8px solid #000;}\n';
        document.body.appendChild(sheet);
    }

    private initKeyboardListener = () => {
        const message_box = document.querySelector('#editor');
        message_box.addEventListener('keydown', this.handleEnterKey);
    }
}