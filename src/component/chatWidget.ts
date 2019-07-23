import { Cursor, IChatWidget, IDiffTabWidget, Message, User } from 'types';
import { getTime, getTimestamp, timeAgo } from '../action/utils';
import { MessageBox } from './messageBox';
const Jupyter = require('base/js/namespace');

const checkOpType = (op): string => {
    if (op.p.length === 1 && typeof op.p[0] === 'number' && op.li && !op.ld) return 'NewMessage';
    return 'Else';
};

export class ChatWidget implements IChatWidget {
    private container: HTMLElement;
    private messageBox: MessageBox;
    private inputButton: HTMLButtonElement;
    private filterContainer: HTMLElement;
    private isFold: boolean = true;
    private isRead: boolean = true;
    private isEdit: boolean = true;
    private isEditLinking: boolean = false;
    private isFilter: boolean = false;
    private titleContainer: HTMLElement;
    private messageContainer: HTMLElement;
    private lastCursor: Cursor;
    private cursorCallback: any;
    private annotationCallback: any;
    private currentAnnotationHighlight: any;
    private sender: User;

    constructor(private user: User, private doc: any, private tabWidget: IDiffTabWidget) {
        this.messageBox = new MessageBox();
        this.initContainer();
        this.initStyle();
        this.loadHistory();
        

        // disable Jupyter notebook shortcuts while in the Chat
        Jupyter.keyboard_manager.register_events(this.container);
        Jupyter.notebook.events.on('select.Cell', this.onSelectCell);
        this.doc.subscribe(this.onSDBDocEvent);
        this.initMouseListener();

        this.messageBox.initQuill();
    }

    public destroy = (): void => {
        this.container.parentNode.removeChild(this.container);
        Jupyter.notebook.events.off('select.Cell', this.onSelectCell);
        this.doc.unsubscribe(this.onSDBDocEvent);
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
        if(!this.isFold) {
            // TODO: fix the appending ref for markers
            const appended_text = '[marker](C' + cell_index + ', M' + object_index + ') ';
            this.messageBox.appendRef('marker', {
                cm_index: cell_index,
                from: -1,
                to: -1
            });
            this.messageBox.value = this.messageBox.value + appended_text;
        }
    }

    public onSelectCursor = (cursor: Cursor): void => {
        if(JSON.stringify(cursor) === JSON.stringify(this.lastCursor)) {
            return;
        }
        else {
            this.lastCursor = cursor;
        }
        if(!this.isFold) {
            if(cursor.from!==cursor.to) {
                const cell = Jupyter.notebook.get_cell(cursor.cm_index);
                const text = cell.code_mirror.getSelection();
                const line_ref = {
                    cm_index: cursor.cm_index,
                    from: cursor.from,
                    to: cursor.to
                };
                this.messageBox.appendRef(text, line_ref);
            }
        }
    }

    public onSelectDiff = (label: string): void => {
        if (!this.isFold) {
            let appended_text;
            if(label === 'version-current') {
                const timestamp = getTimestamp().toString();
                appended_text = '[notebook-snapshot](V'+ timestamp + ')';
            }
            else if(label.includes('version')) {
                const tag = label.split('-');
                appended_text = '[notebook-snapshot](V'+ tag[1] + ')';
            }
            else if (label.includes('diff')) {
                const tag = label.split('-');
                appended_text = '[notebook-diff](V'+ tag[1] + ', V'+tag[2] +')';
            }
            this.messageBox.value = this.messageBox.value + appended_text;
        }
    }

    private onSelectCell = (evt, info): void => {
        const cell = info.cell;

        if(this.isFold) return;
        if(this.isEdit) {
            const cm_index = info.cell.code_mirror.index;
            const appended_text = '[cell](C'+cm_index + ')';
            this.messageBox.value = this.messageBox.value + appended_text;
        }
        if(this.isEditLinking) {
            const cellEl_list = document.querySelectorAll('.cell');
            const cellEl_select = cellEl_list[cell.code_mirror.index];
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
            const newMessageEL = this.createNewMessage(op.li, this.doc.getData().length);
            this.messageContainer.appendChild(newMessageEL);
            newMessageEL.scrollIntoView();
            if(this.isFold) this.notifyNewMessage(true);
            this.updateLineRefListener();
        }
    } 

    private handleLineRef = (e): void => {
        const line_refs = e.target.getAttribute('ref');
        const line_ref = line_refs.split('-');
        const ref1 = line_ref[0];
        if(line_ref.length === 1) {
            if(ref1[0] === 'C') {
                const cell_index = parseInt(ref1.slice(1), 0);
                this.tabWidget.checkTab('version-current');
                Jupyter.notebook.select(cell_index);
                this.updateCellHighlight(true);
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
                const cell_index = parseInt(ref1.slice(1), 0);
                const ref2 = line_ref[1];
                const object_index = parseInt(ref2.slice(1), 0);
                this.currentAnnotationHighlight = {cell_index, object_index};
                this.tabWidget.checkTab('version-current');
                this.annotationCallback(true, cell_index, object_index);
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
                const cell_index = parseInt(ref1.slice(1), 0);
                const ref2 = line_ref[1]; 
                const ref3 = line_ref[2];
                const from = parseInt(ref2.slice(1), 0);
                const to = parseInt(ref3.slice(1), 0);
                this.cursorCallback(true, cell_index, from, to);
            }
        }
        e.stopPropagation();
    }

    private handleSnapshot = (e): void => {
        const selected_messages = document.querySelectorAll('.message-wrapper.select');
        selected_messages.forEach(message => {
            message.classList.remove('select');
        });
        this.updateInputStatus();

        const selected_message = selected_messages[0];
        const timestamp = parseInt(selected_message.getAttribute('timestamp'), 0);
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

        const timestamp1 = parseInt(selected_messages[0].getAttribute('timestamp'), 0);
        const timestamp2 = parseInt(selected_messages[1].getAttribute('timestamp'), 0);
        const old_timestamp = timestamp1 > timestamp2? timestamp1: timestamp2;
        const new_timestamp = timestamp1 > timestamp2? timestamp2: timestamp1;

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
                this.loadHistory();
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

        if(this.isFilter) {
            this.loadFilteredMessages();
            this.updateCellHighlight(true);
        }
        else {
            this.loadHistory();
            this.updateCellHighlight(false);
        }
        this.tabWidget.checkTab('version-current');
    }

    private handleSubmitting = (): void => {
        this.inputButton.blur();
        
        const related_cells = [];

        // a naive way to connect cells with messages

        // link chat message with related cells
        const re = /\[(.*?)\]\((.*?)\)/g;
        const origin_text = this.messageBox.value;
        const line_refs = origin_text.match(re);

        // TODO: replace the value above with submitting value from messagebox
        if(line_refs!==null) {
            line_refs.forEach(line_ref => {
                const re2 = /C(.*), L(.*), L(.*)/;
                const result = line_ref.match(re2);
                if(result) {
                    const cell_index = Number(result[1]);
                    if(cell_index !== null) related_cells.push(cell_index);
                }
            });
        }
        else {
            // link chat message with the cell that someone clicks on
            const current_cell = Jupyter.notebook.get_selected_cell();
           if(current_cell) related_cells.push(current_cell.code_mirror.index);
        }

        const newMessage: Message = {
            sender: this.user,
            content: this.messageBox.getSubmissionValue(),
            time: getTime(),
            timestamp: getTimestamp(),
            cells: related_cells
        };
        const index = this.doc.getData().length;

        const op = {
            p: [index],
            li: newMessage
        };

        if (this.messageBox.getSubmissionValue()) this.doc.submitOp([op], this);
        this.messageBox.clear();
    }

    private handleMessageSelect = (e): void => {
        // change UI
        this.tabWidget.checkTab('version-current');
        e.currentTarget.classList.toggle('select');
        this.updateInputStatus();
    }

    private loadFilteredMessages = (): void => {
        const cell = Jupyter.notebook.get_selected_cell();
        if(cell) {
            const cell_index = cell.code_mirror.index;
            const chat_data = this.doc.getData();
            while(this.messageContainer.firstChild) this.messageContainer.removeChild(this.messageContainer.firstChild);
            let flag = false;
            chat_data.forEach((element, index) => {
                const message: Message = element;
                if(message.cells.includes(cell_index)) {
                    flag = true;
                    const newMessageEL = this.createNewMessage(message, index);
                    this.messageContainer.appendChild(newMessageEL);
                    newMessageEL.scrollIntoView();
                }
            });
            this.updateLineRefListener();

            if(!flag) {
                this.broadcastMessage('No relevant chat messages');
            }
        }
    }

    private loadHistory = (): void => {
        while(this.messageContainer.firstChild) this.messageContainer.removeChild(this.messageContainer.firstChild);
        const history = this.doc.getData();
         history.forEach((message, index) => {
            const newMessageEL = this.createNewMessage(message, index);
            this.messageContainer.appendChild(newMessageEL);
            newMessageEL.scrollIntoView();
        });
        this.updateLineRefListener();
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
        this.isEdit = false;
        this.isEditLinking = false;

        if(status === 'save') {
            this.handleLinkingDisplay();
            save.setAttribute('style', 'display: block');
            this.isEditLinking = true;
            return;
        }

        const selected_messages = document.querySelectorAll('.message-wrapper.select');
        switch(selected_messages.length) {
            case 0:
                input.setAttribute('style', 'display: block');
                this.isEdit = true;
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

    private createNewMessage = (message: Message, id: number): HTMLDivElement => {
        const message_wrapper = document.createElement('div');
        message_wrapper.classList.add('message-wrapper');
        message_wrapper.addEventListener('click', this.handleMessageSelect);

        if(this.user.user_id === message.sender.user_id) {
            message_wrapper.classList.add('right');
        }
        // add selection tick
        const message_tick = document.createElement('i');
        message_tick.innerHTML = '<i class="fa fa-check-circle tick"></i>';
        message_wrapper.appendChild(message_tick);

        // replace the original text into formatted text
        // [text](URL)
        // [text](C0,L1,L5) -> to a code range
        // [text](C0) -> to a cell
        // [text](C0, M1) -> to an annotation marker
        // [text](V12345) -> to a version
        // [text](V12345, V54321) -> to a code diff

        // todo: fix ahh
        const re = /\[(.*?)\]\((.*?)\)/g;
        const origin_text = message.content;
        this.sender = message.sender;

        const formated_text = origin_text.replace(re, this.replaceLR);

        const message_content = document.createElement('div');
        message_content.innerHTML = formated_text;
        message_content.classList.add('message-content');
        message_content.setAttribute('timestamp', message.timestamp.toString());
        message_wrapper.setAttribute('timestamp', message.timestamp.toString());
        message_wrapper.setAttribute('message-id', id.toString());


        const message_sender = document.createElement('div');
        message_sender.innerText = message.sender.username;
        message_sender.classList.add('message-sender');
        message_sender.style.color = message.sender.color;
        
        const message_time = document.createElement('div');
        message_time.innerText = message.time;
        message_time.classList.add('message-time');

        const time_sender = document.createElement('div');
        time_sender.appendChild(message_sender);
        time_sender.appendChild(message_time);

        message_wrapper.appendChild(time_sender);
        message_wrapper.appendChild(message_content);

        return message_wrapper;
    }

    private replaceLR = (p1: string, p2: string, p3: string): string => {
        const refEl = document.createElement('span');
        refEl.innerText = p2;
        refEl.setAttribute('timestamp', getTimestamp().toString());
        refEl.setAttribute('source', this.sender.user_id);
        const tag = p3.replace(/, /g, '-');
        refEl.setAttribute('ref', tag);
        let ref_type = '';
        const line_ref = tag.split('-');
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
        refEl.classList.add(ref_type);

        refEl.classList.add('line_ref');
        return refEl.outerHTML;
    }

    private updateCellHighlight = (flag: boolean): void => {
        const old_cells = document.querySelectorAll('.cell.highlight');
        old_cells.forEach(cell => {
            cell.classList.remove('highlight');
        });
        
        if(flag) {
            const cells = document.querySelectorAll('.cell.selected');
            cells.forEach(cell => {
                cell.classList.add('highlight');
            });
        }
    }

    private updateFilter = (flag: boolean): void => {
        this.isFilter = flag;
        const input = this.filterContainer.firstChild as HTMLInputElement;
        input.checked = flag;
    }

    private updateLineRefListener = (): void => {
        const tag = document.getElementsByClassName('line_ref');
        for(const item of tag) {
            const el = item as HTMLElement;
            if(!el.onclick) el.addEventListener('click', this.handleLineRef);
        }
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

    private getCurrentList = (): number[] => {
        const selected_messages = document.querySelectorAll('.message-wrapper.select');
        const history = this.doc.getData();
        const id0 = selected_messages[0].getAttribute('message-id');
        const message0 = history[id0];
        let cell_list = message0.cells;

        selected_messages.forEach(messageEl => {
            const id = messageEl.getAttribute('message-id');
            const message = history[id];
            const cells = message.cells;
            const intersection = cell_list.filter(v => cells.indexOf(v) > -1);
            cell_list = intersection;
        });
        return cell_list;
    }

    private handleLinking = (e): void => {
        this.updateInputStatus('save');
    }
    private getNewList= (): number[] => {
        const selected_cells = Jupyter.notebook.get_selected_cells();
        const messages = document.querySelectorAll('.message-wrapper');
        const selected_cells_list = [];
        selected_cells.forEach(cell => {
            selected_cells_list.push(cell.code_mirror.index);
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
                const old_message= history[id];
                const new_message = Object.assign({}, old_message);
                const diff_list = new_message.cells.filter(v => cell_list.indexOf(v) === -1);
                const union_list = diff_list.concat(new_list.filter(v => diff_list.indexOf(v) === -1));                
                new_message.cells = union_list;

                if(old_message.cells !== new_message.cells) {
                    const op = {
                        p: [id],
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
        cell_list.forEach(index => {
            const cell = Jupyter.notebook.get_cell(index);
            cell.select();
        });
        this.updateCellHighlight(true);
    }

    private handleSearch = (): void => {
        const input = document.querySelector('#search-input') as HTMLInputElement;
        const keyword = input.value;
        // todo: https://github.com/LittleAprilFool/jupyter-sharing/issues/20
        console.log(keyword);
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
        search_input.id = 'search-input';
        search_icon.addEventListener('click', this.handleSearch);
        tool_search.appendChild(search_input);
        tool_search.appendChild(search_icon);

        const tool_filter = document.createElement('div');
        tool_filter.innerHTML = '<i class="fa fa-filter">';
        tool_filter.classList.add('head-tool');
        tool_filter.id = 'tool-filter';
        // tool_filter.setAttribute('data-title', 'filter messages related to the selected cell');
        tool_filter.addEventListener('click', this.handleFiltering);
        tool_container.appendChild(tool_search);
        tool_container.appendChild(tool_filter);

        head_container.appendChild(tool_container);

        const message_container = document.createElement('div');
        message_container.id = 'message-container';
        
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
        input_button.id = 'input-button';

        const input_and_button_div = document.createElement('div');
        input_and_button_div.appendChild(this.messageBox.el);
        input_and_button_div.appendChild(input_button);
        
        input_button.addEventListener('click', this.handleSubmitting);
       
        input_container.appendChild(input_and_button_div);

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
        // tool_snapshot.setAttribute('data-title', 'notebook snapshot');
        tool_snapshot.addEventListener('click', this.handleSnapshot);

        const tool_linking = document.createElement('div');
        tool_linking.innerText = 'EDIT LINK';
        const linking_icon = document.createElement('i');
        linking_icon.innerHTML = '<i class="fa fa-link">';
        tool_linking.appendChild(linking_icon);
        tool_linking.classList.add('tool-button', 'tool-linking');
        // tool_snapshot.setAttribute('data-title', 'notebook snapshot');
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
        // tool_diff.setAttribute('data-title', 'notebook diff');
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
        // tool_snapshot.setAttribute('data-title', 'notebook snapshot');
        tool_save.addEventListener('click', this.handleLinkingSave);

        input_save.appendChild(tool_save);
        input_save.appendChild(cancel_button4);
        input_save.setAttribute('style', 'display: none');



        // input_container.appendChild(input_box);

        input_container.appendChild(input_button);
        
        this.container.appendChild(head_container);
        this.container.appendChild(message_container);
        this.container.appendChild(input_snapshot);
        this.container.appendChild(input_diff);
        this.container.appendChild(input_other);
        this.container.appendChild(input_save);
        this.container.appendChild(input_container);

        const main_container = document.querySelector('#notebook_panel');
        main_container.appendChild(this.container);

        this.titleContainer = title_container;
        // this.messageBox = input_box;
        this.inputButton = input_button;
        this.messageContainer = message_container;
        this.filterContainer = tool_filter;
    }

    private initStyle = (): void => {
        // update style
        const sheet = document.createElement('style');
        sheet.innerHTML += '#chat-container { height: 500px; width: 300px; float:right; margin-right: 50px; position: fixed; bottom: -460px; right: 0px; z-index:2; border-radius:10px; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); background: white;  transition: bottom .5s; } \n';
        sheet.innerHTML += '#head-container { color: #516766; font-weight: bold; text-align: center; background-color: #9dc5a7; border-radius: 10px 10px 0px 0px; } \n';
        sheet.innerHTML += '#tool-container { text-align: right; margin-top: 5px; padding: 5px; background: white; border-bottom: 1px solid #eee}\n';
        sheet.innerHTML += '.tool-button {font-size:10px; margin-left: 10px; display: inline-block; padding: 5px 10px; background: #709578;color: white; border-radius: 3px; cursor: pointer; }\n';
        sheet.innerHTML += '.tool-button i {margin-left: 1px; }\n';

        // sheet.innerHTML += '.tool-button:hover {color: #ddd;}\n';
        sheet.innerHTML += '.head-tool { height: 22px; margin-right: 10px; border: 1px solid #eee; padding: 0px 10px; display: inline-block}\n';
        sheet.innerHTML += '#tool-filter.active {background: #dae4dd; color: #516766}\n';
        sheet.innerHTML += '#tool-search input { font-weight: normal; color: #aaa; outline: none; border: none; width: 185px; font-size: 10px; margin-right: 5px;}\n';
        sheet.innerHTML += '#title-container {padding: 8px; cursor: pointer; }\n';
        sheet.innerHTML += '#message-container { height: 370px; background-color: white; overflow:scroll; } \n';
        sheet.innerHTML += '.select.message-content {cursor: pointer; transition: .4s}\n';
        sheet.innerHTML += '.selected.message-content {background:#dae5dd; }\n';
        sheet.innerHTML += '.cancel-selection {background: none; border: none; color: #155725ab; float: right; }\n';

        sheet.innerHTML += '.select.message-content:hover {background:#dae5dd; }\n';
        sheet.innerHTML += '#input-container { height: 50px; width: 280px; background-color: white; border: solid 2px #ececec; border-radius: 10px; margin:auto;} \n';
        sheet.innerHTML += '.input-label { color: #bbb; font-size: 12px; font-weight: bold; padding: 15px 15px; height: 50px; width: 300px; border-top: 1px solid #eee; margin:auto;} \n';
        sheet.innerHTML += '#input-box { padding-left: 10px; padding-right: 10px; font-size: 12px; color: #7d7d7d; width: 220px; border: none; background-color: transparent; resize: none;outline: none; } \n';
        sheet.innerHTML += '#input-button { color: #868686; display:inline; height:46px; width: 50px; position: relative; background: transparent; border: none; border-left: solid 2px #ececec; } \n';
        sheet.innerHTML += '#input-button:hover { color: #484848;} \n';
        sheet.innerHTML += '#chat-title { display: inline; margin-left: 8px; } \n';

        sheet.innerHTML += '.message-wrapper { padding: 8px 20px; margin: 4px 0px;} \n';
        sheet.innerHTML += '.message-wrapper.select {background: #9dc5a73d;}\n';
        // sheet.innerHTML += '.right { text-align: right;} \n';
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
}