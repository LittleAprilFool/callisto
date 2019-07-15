import { getTime } from '../action/utils';
import { MessageBox } from './messageBox';
const Jupyter = require('base/js/namespace');

function checkOpType(op): string {

    if (op.p.length === 1 && typeof op.p[0] === 'number' && op.li) return 'NewMessage';
    
    return 'Else';
}

export class ChatWidget implements IChatWidget {
    private container: HTMLElement;
    private messageBox: MessageBox;
    private inputButton: HTMLButtonElement;
    private filterContainer: HTMLElement;
    private isFold: boolean = true;
    private isRead: boolean = true;
    private isFilter: boolean = false;
    private toolContainer: HTMLElement;
    private messageContainer: HTMLElement;
    private lastCursor: Cursor;
    private cursorCallback: any;
    private currentSelectCellIndex: number;

    constructor(private user: User, private doc: any) {
        this.messageBox = new MessageBox();
        this.initContainer();
        this.initStyle();
        this.loadHistory();
        
        // disable Jupyter notebook shortcuts while in the Chat
        Jupyter.keyboard_manager.register_events(this.container);
        Jupyter.notebook.events.on('select.Cell', this.onSelectCell.bind(this));
        this.doc.subscribe(this.onSDBDocEvent);
    }

    public destroy(): void {
        this.container.parentNode.removeChild(this.container);
        Jupyter.notebook.events.off('select.Cell', this.onSelectCell.bind(this));
        this.doc.unsubscribe(this.onSDBDocEvent);
    }

    public broadcastMessage(message: string): void {
        const broadcastMessageEL = document.createElement('div');
        broadcastMessageEL.innerText = message;
        broadcastMessageEL.classList.add('broadcast-message');
        this.messageContainer.appendChild(broadcastMessageEL);
    }

    public bindCursorAction(callback): void {
        this.cursorCallback = callback;
    }

    public onSelectAnnotation(): void {
        console.log('select annotation');
    }

    public onCursorChange(cursor: Cursor): void {
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
                this.messageBox.setValue(this.messageBox.getValue() + appended_text);
            }
        }
    }

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            ops.forEach(op => this.applyOp(op));
        }
    }

    private onSelectCell (evt, info): void {
        // display filter
        if(this.isFilter && !this.isFold) {
            this.loadFilteredMessages();
            this.updateCellHighlight(true);
        }
    }

    private applyOp(op): void {
        if(checkOpType(op) === 'NewMessage') {
            const newMessageEL = this.createNewMessage(op.li);
            this.messageContainer.appendChild(newMessageEL);
            newMessageEL.scrollIntoView();
            if(this.isFold) this.notifyNewMessage(true);
            this.updateLineRefListener();
        }
    } 

    private handleLineRef(e) {
        const cell_index = e.target.getAttribute('cell_index');
        const from = e.target.getAttribute('from');
        const to = e.target.getAttribute('to');
        this.cursorCallback(true, cell_index, from, to);
    }

    private handleFolding(): void {
        this.isFold = !this.isFold;
        if(this.isFold) {
            // fold container, turn off filter
            this.container.style.bottom = '-360px';
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

    private handleFiltering(e): void {
        this.isFilter = !this.isFilter;
        if(this.isFilter) {
            this.loadFilteredMessages();
            this.updateTitle('filter');
            this.updateCellHighlight(true);
        }
        else {
            this.loadHistory();
            this.updateTitle('chat');
            this.updateCellHighlight(false);
        }
    }

    private handleSubmitting(): void {
        this.inputButton.blur();
        
        const related_cells = [];

        // a naive way to connect cells with messages

        // link chat message with related cells
        const re = /\[(.*?)\]\((.*?)\)/g;
        const origin_text = this.messageBox.getValue();
        const line_refs = origin_text.match(re);

        if(line_refs!==null) {
            line_refs.forEach(line_ref => {
                const re2 = /C(.*), L(.*), L(.*)/;
                const result = line_ref.match(re2);
                const cell_index = Number(result[1]);
                if(cell_index !== null) related_cells.push(cell_index);
            });
        }
        else {
            // link chat message with the cell that someone clicks on
            const current_cell = Jupyter.notebook.get_selected_cell();
           if(current_cell) related_cells.push(current_cell.code_mirror.index);
        }

        const newMessage: Message = {
            sender: this.user,
            content: this.messageBox.getValue(),
            time: getTime(),
            cells: related_cells
        };
        const index = this.doc.getData().length;

        const op = {
            p: [index],
            li: newMessage
        };

        if (this.messageBox.getValue()) this.doc.submitOp([op], this);
        this.messageBox.setValue('');
    }

    private loadFilteredMessages(): void {
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

    private loadHistory(): void {
        while(this.messageContainer.firstChild) this.messageContainer.removeChild(this.messageContainer.firstChild);
        const history = this.doc.getData();
        history.forEach(message=> {
            const newMessageEL = this.createNewMessage(message);
            this.messageContainer.appendChild(newMessageEL);
            newMessageEL.scrollIntoView();
        });

        this.updateLineRefListener();
    }

    private notifyNewMessage(flag: boolean): void {
        if(flag) {
            this.updateTitle('new');
            this.isRead = false;
        }
        else {
            this.updateTitle('chat');
            this.isRead = true;
        }
    }

    private createNewMessage(message: Message): HTMLDivElement {
        const message_wrapper = document.createElement('div');
        message_wrapper.classList.add('message-wrapper');

        if(this.user.user_id === message.sender.user_id) {
            message_wrapper.classList.add('right');
        }

        // replace the original text into formatted text
        // [text](URL)
        // [text](C0L1L5)

        const re = /\[(.*?)\]\(C(.*?), L(.*), L(.*)\)/g;
        const origin_text = message.content;
        const timestamp = getTime();
        const formated_text = origin_text.replace(re, "<span class='line_ref' cell_index=$2 from=$3 to=$4 timestamp="+timestamp+" source="+message.sender.user_id+" >$1</span>");


        const message_content = document.createElement('div');
        message_content.innerHTML = formated_text;
        message_content.classList.add('message-content');
        
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

    private updateCellHighlight(flag: boolean): void {
        // highlight a selected cell when filter mode is on
        const old_cell = document.querySelectorAll('.cell')[this.currentSelectCellIndex] as HTMLElement;
        if(old_cell) old_cell.style.background = "";
        this.currentSelectCellIndex = null;
        
        if(flag) {
            const index = Jupyter.notebook.get_selected_cell().code_mirror.index;
            const focus_cell = document.querySelectorAll('.cell')[index] as HTMLElement;
            focus_cell.style.background = "#dae5dd";
            this.currentSelectCellIndex = index;    
        }
    }

    private updateFilter(flag: boolean): void {
        this.isFilter = flag;
        const input = this.filterContainer.firstChild as HTMLInputElement;
        input.checked = flag;
    }

    private updateLineRefListener(): void {
        const tag = document.getElementsByClassName('line_ref');
        for(const item of tag) {
            const el = item as HTMLElement;
            if(!el.onclick) el.addEventListener('click', this.handleLineRef.bind(this));
        }
    }

    private updateTitle(flag): void {
        const el = this.toolContainer.childNodes[1] as HTMLElement;
        const icon = this.toolContainer.childNodes[0] as HTMLElement;

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

    private initContainer(): void {
        this.container = document.createElement('div');
        this.container.id = 'chat-container';

        const tool_container = document.createElement('div');
        tool_container.id = 'tool-container';
        tool_container.addEventListener('click', this.handleFolding.bind(this));

        const message_container = document.createElement('div');
        message_container.id = 'message-container';
        
        const input_container = document.createElement('div');
        input_container.id = 'input-container';

        const el = document.createElement('div');
        const icon = document.createElement('i');
        el.innerText = 'Chat';
        el.id = 'chat-title';
        icon.innerHTML = '<i class="fa fa-comment"></i>';
        tool_container.appendChild(icon);
        tool_container.appendChild(el);
        
        const button_icon = document.createElement('i');
        button_icon.innerHTML = '<i class="fa fa-paper-plane"></i>';

        const input_button = document.createElement('button');
        input_button.appendChild(button_icon);
        input_button.id = 'input-button';
        
        input_button.addEventListener('click', this.handleSubmitting.bind(this));

        const filter = document.createElement('label');
        filter.id = 'switch';
        
        const filter_input = document.createElement('input');
        filter_input.type = "checkbox";
        
        const filter_span = document.createElement('span');
        filter_span.id = 'slider';
        
        filter.appendChild(filter_input);
        filter.appendChild(filter_span);
        filter_input.addEventListener('click', this.handleFiltering.bind(this));
       
        input_container.appendChild(this.messageBox.el);
        input_container.appendChild(input_button);
        input_container.appendChild(filter);
        
        this.container.appendChild(tool_container);
        this.container.appendChild(message_container);
        this.container.appendChild(input_container);

        const main_container = document.querySelector('#notebook');
        main_container.appendChild(this.container);

        this.toolContainer = tool_container;
        this.inputButton = input_button;
        this.messageContainer = message_container;
        this.filterContainer = filter;
    }

    private initStyle(): void {
        // update style
        const sheet = document.createElement('style');
        sheet.innerHTML += '#chat-container { height: 400px; width: 300px; float:right; margin-right: 50px; position: fixed; bottom: -360px; right: 0px; z-index:2; border-radius:10px; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); background: whitesmoke;  transition: bottom .5s; } \n';
        sheet.innerHTML += '#tool-container { height: 40px; color: #516766; font-weight: bold; padding-top: 8px; text-align: center; background-color: #9dc5a7; border-radius: 10px 10px 0px 0px; } \n';
        sheet.innerHTML += '#message-container { height: 300px; background-color: whitesmoke; overflow:scroll; } \n';
        sheet.innerHTML += '#input-container { height: 50px; width: 280px; background-color: white; border: solid 2px #ececec; border-radius: 10px; margin:auto;} \n';
        sheet.innerHTML += '#input-box { padding-left: 10px; padding-right: 10px; font-size: 12px; color: #7d7d7d; width: 220px; border: none; background-color: transparent; resize: none;outline: none; } \n';
        sheet.innerHTML += '#input-button { color: #868686; display:inline; height:46px; width: 50px; position: relative; top: -17px; background: transparent; border: none; border-left: solid 2px #ececec; } \n';
        sheet.innerHTML += '#input-button:hover { color: #484848;} \n';
        sheet.innerHTML += '#chat-title { display: inline; margin-left: 8px; } \n';

        sheet.innerHTML += '.message-wrapper { margin: 10px 20px;} \n';
        sheet.innerHTML += '.right { text-align: right;} \n';
        sheet.innerHTML += '.message-sender { display:inline; font-size: 10px; font-weight: bold; } \n';
        sheet.innerHTML += '.message-content { display: inline-block; background: #e8e8e8; padding: 10px; border-radius: 12px; min-width: 100px; font-size: 12px; } \n';
        sheet.innerHTML += '.message-time { font-size: 10px; display:inline; margin-left: 10px; color: #b7b7b7; } \n';
        sheet.innerHTML += '.broadcast-message { text-align: center; font-size: 12px; color: #b7b7b7; } \n';

        sheet.innerHTML += '.line_highlight { background-color: yellow; } \n';
        sheet.innerHTML += '.line_ref { color: #aa1111; cursor: pointer; font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; } \n';
        sheet.innerHTML += '.line_ref:hover { color: #971616; text-decoration: underline; } \n';
        
        sheet.innerHTML += '#slider {border-radius: 20px; position: absolute; cursor: pointer; background-color: #516666; transition: .4s; top: 0; left: 0; right: 0; bottom: 0; } \n';
        sheet.innerHTML += '#slider:before {position:absolute; content:" ";height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: #9cc4a6; transition:.4s; border-radius: 50%; } \n';
        sheet.innerHTML += '#switch {display: none; position: relative; bottom: 395px; left: 240px; width: 40px; height: 20px; } \n';
        sheet.innerHTML += '#switch input {opacity: 0; width: 0; height: 0; } \n';
        sheet.innerHTML += 'input:checked + #slider { background-color: #dae4dd; } \n';
        sheet.innerHTML += 'input:focus + #slider { box-shadow: 0 0 1px #dae4dd; } \n';
        sheet.innerHTML += 'input:checked + #slider:before { transform: translateX(20px); } \n';
        
        document.body.appendChild(sheet);
    }
}