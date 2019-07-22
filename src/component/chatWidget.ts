import { getTime, getTimestamp, timeAgo } from '../action/utils';
const Jupyter = require('base/js/namespace');

const checkOpType = (op): string => {
    if (op.p.length === 1 && typeof op.p[0] === 'number' && op.li) return 'NewMessage';
    return 'Else';
};

export class ChatWidget implements IChatWidget {
    private container: HTMLElement;
    private messageBox: HTMLTextAreaElement;
    private inputButton: HTMLButtonElement;
    private filterContainer: HTMLElement;
    private isFold: boolean = true;
    private isRead: boolean = true;
    private isEdit: boolean = true;
    private isFilter: boolean = false;
    private isVersion: boolean = false;
    private isDiff: boolean = false;
    private isDiff_select: number[];
    private headContainer: HTMLElement;
    private titleContainer: HTMLElement;
    private messageContainer: HTMLElement;
    private lastCursor: Cursor;
    private cursorCallback: any;
    private annotationCallback: any;
    private currentAnnotationHighlight: any;
    private changeLogHighlight: any;
    private sender: User;


    constructor(private user: User, private doc: any, private tabWidget: IDiffTabWidget) {
        this.initContainer();
        this.initStyle();
        this.loadHistory();
        
        // disable Jupyter notebook shortcuts while in the Chat
        Jupyter.keyboard_manager.register_events(this.container);
        Jupyter.notebook.events.on('select.Cell', this.onSelectCell);
        this.doc.subscribe(this.onSDBDocEvent);
        this.initMouseListener();
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
            const appended_text = '[marker](C' + cell_index + ', M' + object_index + ') ';
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
                const appended_text = '['+text+'](C'+cursor.cm_index + ', L'+cursor.from+', L'+cursor.to+') ';
                this.messageBox.value = this.messageBox.value + appended_text;
            }
        }
    }

    public onSelectDiff = (label: string): void => {
        if (!this.isFold) {
            let appended_text
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

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            ops.forEach(op => this.applyOp(op));
        }
    }

    private onSelectCell = (evt, info): void => {
        if(this.isEdit && !this.isFold) {
            const cm_index = info.cell.code_mirror.index;
            const appended_text = '[cell](C'+cm_index + ')';
            this.messageBox.value = this.messageBox.value + appended_text;
        }
        // display filter
        if(this.isFilter && !this.isFold) {
            this.loadFilteredMessages();
            this.updateCellHighlight(true);
        }
        else {
            this.updateCellHighlight(false);
        }
    }

    private applyOp = (op): void => {
        if(checkOpType(op) === 'NewMessage') {
            const newMessageEL = this.createNewMessage(op.li);
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
                const timestamp = parseInt(ref1.slice(1));
                const label = 'version-'+timestamp.toString();
                if(this.tabWidget.checkTab(label)) return;
    
                this.tabWidget.addTab(label, 'version', timestamp);
                const title = timeAgo(timestamp)
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
                const new_timestamp = parseInt(ref1.slice(1));
                const ref2 = line_ref[1];
                const old_timestamp = parseInt(ref2.slice(1));
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
                const ref2 = line_ref[1], ref3 = line_ref[2];
                const from = parseInt(ref2.slice(1), 0);
                const to = parseInt(ref3.slice(1), 0);
                this.cursorCallback(true, cell_index, from, to);
            }
        }
    }

    private handleVersion = (e): void => {
        e.target.classList.toggle('active');
        this.isVersion = !this.isVersion;
        this.clearDiff();
        document.querySelectorAll('.message-content').forEach(ele=> {
            ele.classList.toggle('select');
        });
        this.isVersion? this.toggleInputDisplay('snapshot'): this.toggleInputDisplay('input');
    }

    private handleDiff = (e): void => {
        e.target.classList.toggle('active');
        this.isDiff = !this.isDiff;
        this.clearVersion();
        document.querySelectorAll('.message-content').forEach(ele=> {
            ele.classList.toggle('select');
        });
        
        this.isDiff_select = [];
        this.isDiff? this.toggleInputDisplay('diff'): this.toggleInputDisplay('input');
        if(!this.isDiff) {
            document.querySelectorAll('.message-content').forEach(ele=> {
                ele.classList.remove('selected');
            });
        }
    }

    private handleMessageClick = (e): void => {
        if(this.isVersion) {
            this.isVersion = false;
            document.querySelector('.tool-button.active').classList.toggle('active');
            document.querySelectorAll('.message-content').forEach(ele=> {
                ele.classList.toggle('select');
            });

            const timestamp = parseInt(e.target.getAttribute('timestamp'), 0);
            const label = 'version-'+timestamp.toString();
            if(this.tabWidget.checkTab(label)) return;

            this.tabWidget.addTab(label, 'version', timestamp);
            this.tabWidget.addVersion(timestamp, timestamp.toString());
            if(this.isFilter){
                this.toggleInputDisplay('filter');
            }
            else this.toggleInputDisplay('input');
        }
        if(this.isDiff) {
            if(this.isDiff_select.length == 0) {
                const timestamp = parseInt(e.target.getAttribute('timestamp'), 0);
                e.target.classList.add('selected');
                this.isDiff_select.push(timestamp);
            }
            else {
                this.isDiff = false;

                document.querySelector('.tool-button.active').classList.toggle('active');
                document.querySelectorAll('.message-content').forEach(ele=> {
                    ele.classList.toggle('select');
                    ele.classList.remove('selected');
                });
                const timestamp = parseInt(e.target.getAttribute('timestamp'), 0);
                const old_timestamp = timestamp < this.isDiff_select[0]? timestamp: this.isDiff_select[0];
                const new_timestamp = timestamp < this.isDiff_select[0]? this.isDiff_select[0]: timestamp;
                const label = 'diff-'+new_timestamp.toString()+ '-' + old_timestamp.toString();
                if(this.tabWidget.checkTab(label)) return;

                this.tabWidget.addTab(label, 'diff', new_timestamp);
                this.tabWidget.addDiff(new_timestamp, old_timestamp, new_timestamp.toString());
                this.isDiff_select = [];
                if(this.isFilter){
                    this.toggleInputDisplay('filter');
                }
                else this.toggleInputDisplay('input');
            }
        }
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

    private clearVersion = (): void => {
        if(this.isVersion) {
            const version_button = document.querySelector('#tool-version');
            version_button.classList.toggle('active');
            this.isVersion = !this.isVersion;
            document.querySelectorAll('.message-content').forEach(ele=> {
                ele.classList.toggle('select');
            });
        }
    }

    private clearDiff = (): void => {
        if(this.isDiff) {
            const diff_button = document.querySelector('#tool-diff');
            diff_button.classList.toggle('active');
            this.isDiff = !this.isDiff;
            document.querySelectorAll('.message-content').forEach(ele=> {
                ele.classList.toggle('select');
                ele.classList.remove('selected');
            });
        }
    }

    private handleFiltering = (e): void => {
        this.isFilter = !this.isFilter;
        const filter_button = document.querySelector('#tool-filter');
        filter_button.classList.toggle('active');
        this.clearVersion();
        this.clearDiff();
        if(this.isFilter) {
            this.loadFilteredMessages();
            this.updateCellHighlight(true);
            this.toggleInputDisplay('filter');
        }
        else {
            this.loadHistory();
            this.updateCellHighlight(false);
            this.toggleInputDisplay('input');
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
            content: this.messageBox.value,
            time: getTime(),
            timestamp: getTimestamp(),
            cells: related_cells
        };
        const index = this.doc.getData().length;

        const op = {
            p: [index],
            li: newMessage
        };

        if (this.messageBox.value) this.doc.submitOp([op], this);
        this.messageBox.value = '';
    }

    private loadFilteredMessages = (): void => {
        const cell = Jupyter.notebook.get_selected_cell();
        if(cell) {
            const cell_index = cell.code_mirror.index;
            const chat_data = this.doc.getData();
            while(this.messageContainer.firstChild) this.messageContainer.removeChild(this.messageContainer.firstChild);
            let flag = false;
            chat_data.forEach(element => {
                const message: Message = element;
                if(message.cells.includes(cell_index)) {
                    flag = true;
                    const newMessageEL = this.createNewMessage(message);
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
        history.forEach(message=> {
            const newMessageEL = this.createNewMessage(message);
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

    private handleMessageSelect = (e): void => {

    }

    private createNewMessage = (message: Message): HTMLDivElement => {
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

        const re = /\[(.*?)\]\((.*?)\)/g;
        const origin_text = message.content;
        this.sender = message.sender;

        const formated_text = origin_text.replace(re, this.replaceLR);

        const message_content = document.createElement('div');
        message_content.innerHTML = formated_text;
        message_content.classList.add('message-content');
        message_content.setAttribute('timestamp', message.timestamp.toString());
        message_wrapper.setAttribute('timestamp', message.timestamp.toString());

        message_content.addEventListener('click', this.handleMessageClick);

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
        })
        
        if(flag) {
            const cells = document.querySelectorAll('.cell.selected');
            cells.forEach(cell => {
                cell.classList.add('highlight');
            })
        }
    }

    private toggleInputDisplay = (event: string): void => {
        const label = document.querySelector('#input-label');
        const input = document.querySelector('#input-container');
        switch(event){
            case 'snapshot':
                label.innerHTML = 'Select a message to view the snapshot of the notebook.';
                label.setAttribute('style', 'display: block');
                input.setAttribute('style', 'display: none');
                this.isEdit = false;
                break;
            case 'diff':
                label.innerHTML = 'Select two messages to view the diff of two snapshots.';
                label.setAttribute('style', 'display: block');
                input.setAttribute('style', 'display: none');
                this.isEdit = false;
                break;
            case 'filter':
                label.innerHTML = 'Select a cell in current notebook to view relevant messages';
                label.setAttribute('style', 'display: block');
                input.setAttribute('style', 'display: none');
                this.isEdit = false;
                break;
            case 'input':
                label.setAttribute('style', 'display: none');
                input.setAttribute('style', 'display: block');
                this.isEdit = true;
                break;
            default:
                break;
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
        
        const tool_version = document.createElement('div');
        tool_version.innerHTML = '<i class="fa fa-code">';
        tool_version.classList.add('tool-button');
        tool_version.id = 'tool-version';
        tool_version.setAttribute('data-title', 'notebook snapshot');
        tool_container.appendChild(tool_version);
        tool_version.addEventListener('click', this.handleVersion);

        const tool_diff = document.createElement('div');
        tool_diff.innerHTML = '<i class="fa fa-history">';
        tool_diff.classList.add('tool-button');
        tool_diff.id = 'tool-diff';
        tool_diff.setAttribute('data-title', 'notebook diff');
        tool_container.appendChild(tool_diff);
        tool_diff.addEventListener('click', this.handleDiff);

        const tool_filter = document.createElement('div');
        tool_filter.innerHTML = '<i class="fa fa-filter">';
        tool_filter.classList.add('tool-button');
        tool_filter.id = 'tool-filter';
        tool_filter.setAttribute('data-title', 'filter messages related to the selected cell');
        tool_filter.addEventListener('click', this.handleFiltering);
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
        
        const input_box = document.createElement('textarea');
        input_box.id = 'input-box';
        input_box.placeholder = 'write your message';

        const button_icon = document.createElement('i');
        button_icon.innerHTML = '<i class="fa fa-paper-plane"></i>';

        const input_button = document.createElement('button');
        input_button.appendChild(button_icon);
        input_button.id = 'input-button';
        
        input_button.addEventListener('click', this.handleSubmitting);
       
        const input_label = document.createElement('div');
        input_label.id = 'input-label';
        input_label.setAttribute('style', 'display:none');

        input_container.appendChild(input_box);

        input_container.appendChild(input_button);
        
        this.container.appendChild(head_container);
        this.container.appendChild(message_container);
        this.container.appendChild(input_label);
        this.container.appendChild(input_container);

        const main_container = document.querySelector('#notebook_panel');
        main_container.appendChild(this.container);

        this.titleContainer = title_container;
        this.headContainer = head_container;
        this.messageBox = input_box;
        this.inputButton = input_button;
        this.messageContainer = message_container;
        this.filterContainer = tool_filter;
    }

    private initStyle = (): void => {
        // update style
        const sheet = document.createElement('style');
        sheet.innerHTML += '#chat-container { height: 500px; width: 300px; float:right; margin-right: 50px; position: fixed; bottom: -460px; right: 0px; z-index:2; border-radius:10px; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); background: white;  transition: bottom .5s; } \n';
        sheet.innerHTML += '#head-container { color: #516766; font-weight: bold; text-align: center; background-color: #9dc5a7; border-radius: 10px 10px 0px 0px; } \n';
        sheet.innerHTML += '#tool-container { margin-top: 5px; padding: 5px; background: white; border-bottom: 1px solid #eee}'
        sheet.innerHTML += '.tool-button {display: inline-block; width: 50px; margin: 0px 10px 0px 10px; background: #fff; border-radius: 3px; border: 1px solid #eee; cursor: pointer; transition: .4s;}\n';
        sheet.innerHTML += '.tool-button:hover {color: #ddd;}\n';
        sheet.innerHTML += '.tool-button.active {background: #dae4dd; color: #516766}\n';
        sheet.innerHTML += '#title-container {padding: 8px; cursor: pointer; }\n';
        sheet.innerHTML += '#message-container { height: 370px; background-color: white; overflow:scroll; } \n';
        sheet.innerHTML += '.select.message-content {cursor: pointer; transition: .4s}\n';
        sheet.innerHTML += '.selected.message-content {background:#dae5dd; }\n';

        sheet.innerHTML += '.select.message-content:hover {background:#dae5dd; }\n';
        sheet.innerHTML += '#input-container { height: 50px; width: 280px; background-color: white; border: solid 2px #ececec; border-radius: 10px; margin:auto;} \n';
        sheet.innerHTML += '#input-label { color: #bbb; font-size: 12px; font-weight: bold; padding: 6px 6px; height: 50px; width: 280px; background-color: #f5f5f5; border: dashed 2px #bbb; border-radius: 10px; margin:auto;} \n';
        sheet.innerHTML += '#input-box { padding-left: 10px; padding-right: 10px; font-size: 12px; color: #7d7d7d; width: 220px; border: none; background-color: transparent; resize: none;outline: none; } \n';
        sheet.innerHTML += '#input-button { color: #868686; display:inline; height:46px; width: 50px; position: relative; top: -12px; background: transparent; border: none; border-left: solid 2px #ececec; } \n';
        sheet.innerHTML += '#input-button:hover { color: #484848;} \n';
        sheet.innerHTML += '#chat-title { display: inline; margin-left: 8px; } \n';

        sheet.innerHTML += '.message-wrapper { padding: 8px 20px; margin: 4px 0px;} \n';
        // sheet.innerHTML += '.message-wrapper:hover {background: #9dc5a73d;}\n';
        // sheet.innerHTML += '.right { text-align: right;} \n';
        sheet.innerHTML += '.message-sender { display:inline; font-size: 10px; font-weight: bold; } \n';
        sheet.innerHTML += '.message-content { display: inline-block; background: whitesmoke; left: 5px; position: relative; padding: 10px; border-radius: 12px; min-width: 100px; font-size: 12px; } \n';
        sheet.innerHTML += '.message-time { float: right; font-size: 10px; display:inline; margin-left: 10px; color: #b7b7b7; } \n';
        sheet.innerHTML += '.broadcast-message { text-align: center; font-size: 12px; color: #b7b7b7; } \n';
        sheet.innerHTML += '.tick {float: left; position: relative; top: 3px; left: -12px; color: white; font-size: 15px;}'
        sheet.innerHTML += '.message-wrapper:hover .tick {color: #9dc5a73d;}'
        sheet.innerHTML += '.line_highlight { background-color: yellow; } \n';
        sheet.innerHTML += '.line_ref { margin: 0px 2px; cursor: pointer; font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; } \n';
        sheet.innerHTML += '.line_ref:hover { text-decoration: underline; } \n';
        sheet.innerHTML += '.line_ref.cell { color: #008000; }\n';
        sheet.innerHTML += '.line_ref.code { color: #aa1111; }\n';
        sheet.innerHTML += '.line_ref.marker { color: #9d00e8; }\n';
        sheet.innerHTML += '.line_ref.snapshot { color: #0e66dc; }\n';
        sheet.innerHTML += '.line_ref.diff { color: #ff7a00; }\n';

        sheet.innerHTML += '#slider {border-radius: 20px; position: absolute; cursor: pointer; background-color: #516666; transition: .4s; top: 0; left: 0; right: 0; bottom: 0; } \n';
        sheet.innerHTML += '#slider:before {position:absolute; content:" ";height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: #9cc4a6; transition:.4s; border-radius: 50%; } \n';
        sheet.innerHTML += '#switch {display: none; position: relative; bottom: 395px; left: 240px; width: 40px; height: 20px; } \n';
        sheet.innerHTML += '#switch input {opacity: 0; width: 0; height: 0; } \n';
        sheet.innerHTML += 'input:checked + #slider { background-color: #dae4dd; } \n';
        sheet.innerHTML += 'input:focus + #slider { box-shadow: 0 0 1px #dae4dd; } \n';
        sheet.innerHTML += 'input:checked + #slider:before { transform: translateX(20px); } \n';
        sheet.innerHTML += '.cell.highlight {background: #dae5dd;} \n';

        sheet.innerHTML += '[data-title] {position: relative;}\n';
        sheet.innerHTML += '[data-title]:hover::before {content: attr(data-title);position: absolute;bottom: -30px;display: inline-block;padding: 3px 6px;border-radius: 2px;background: #000;color: #fff;font-size: 10px;font-family: sans-serif;white-space: nowrap;}\n';
        sheet.innerHTML += '[data-title]:hover::after {content: "";position: absolute;bottom: -10px;left: 17px;display: inline-block;color: #fff;border: 8px solid transparent;	border-bottom: 8px solid #000;}\n';
        document.body.appendChild(sheet);
    }
}