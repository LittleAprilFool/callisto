import { getTime } from '../action/utils';
const Jupyter = require('base/js/namespace');

function checkOpType(op): string {

    if (op.p.length === 1 && typeof op.p[0] === 'number' && op.li) return 'NewMessage';
    
    return 'Else';
}

export class ChatWidget implements IChatWidget {
    private container: HTMLElement;
    private messageBox: HTMLTextAreaElement;
    private inputButton: HTMLButtonElement;
    private folded: boolean;
    private isNew: boolean;
    private toolContainer: HTMLElement;
    private messageContainer: HTMLElement;
    private lastCursor: Cursor;
    private cursorCallback: any;

    constructor(private user: User, private doc: any) {
        this.container = document.createElement('div');
        this.container.setAttribute('style', 'height: 400px; width: 300px; float:right; margin-right: 50px; position: fixed; bottom: -360px; right: 0px; z-index:2; border-radius:10px; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); background: whitesmoke;  transition: bottom .5s');
        this.initContainer();
        const main_container = document.querySelector('#notebook');
        main_container.appendChild(this.container);
        this.folded = true;
        this.isNew = false;
        
        // disable Jupyter notebook shortcuts while in the Chat
        Jupyter.keyboard_manager.register_events(this.container);
        this.doc.subscribe(this.onSDBDocEvent);

        this.loadHistory();
        this.initStyle();
    }

    public destroy(): void {
        this.container.parentNode.removeChild(this.container);
        this.doc.unsubscribe(this.onSDBDocEvent);
    }

    public broadcastMessage(message: string): void {
        const broadcastMessageEL = document.createElement('div');
        broadcastMessageEL.innerText = message;
        broadcastMessageEL.setAttribute('style', 'text-align: center; font-size: 12px; color: #b7b7b7');
        this.messageContainer.appendChild(broadcastMessageEL);
    }

    public bindCursorAction(callback): void {
        this.cursorCallback = callback;
    }

    public onCursorChange(cursor: Cursor): void {
        if(JSON.stringify(cursor) === JSON.stringify(this.lastCursor)) {
            return;
        }
        else {
            this.lastCursor = cursor;
        }
        if(!this.folded) {
            if(cursor.from!==cursor.to) {
                const cell = Jupyter.notebook.get_cell(cursor.cm_index);
                const text = cell.code_mirror.getSelection();
                const appended_text = '['+text+'](C'+cursor.cm_index+'L'+cursor.from+'L'+cursor.to+') ';
                this.messageBox.value = this.messageBox.value + appended_text;
            }
        }
    }

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            ops.forEach(op => this.applyOp(op));
        }
    }

    private applyOp(op): void {
        if(checkOpType(op) === 'NewMessage') {
            const newMessageEL = this.createNewMessage(op.li);
            this.messageContainer.appendChild(newMessageEL);
            newMessageEL.scrollIntoView();
            if(this.folded) this.notifyNewMessage(true);
            this.updateLineRefListener();
        }
    } 

    private notifyNewMessage(flag: boolean): void {
        if(flag) {
            while(this.toolContainer.firstChild) {
                this.toolContainer.removeChild(this.toolContainer.firstChild);
            }
            const el = document.createElement('div');
            const icon = document.createElement('i');
            el.innerText = 'New Message!';
            el.style.display = 'inline';
            el.style.marginLeft = '8px';
            icon.innerHTML = '<i class="fa fa-ellipsis-h"></i>';
            this.toolContainer.appendChild(icon);
            this.toolContainer.appendChild(el);
            this.isNew = true;
        }
        else {
            while(this.toolContainer.firstChild) {
                this.toolContainer.removeChild(this.toolContainer.firstChild);
            }
            const el = document.createElement('div');
            const icon = document.createElement('i');
            el.innerText = 'Chat';
            el.style.display = 'inline';
            el.style.marginLeft = '8px';
            icon.innerHTML = '<i class="fa fa-comment"></i>';
            this.toolContainer.appendChild(icon);
            this.toolContainer.appendChild(el);
            this.isNew = false;
        }
    }

    private loadHistory(): void {
        const history = this.doc.getData();
        history.forEach(message=> {
            const newMessageEL = this.createNewMessage(message);
            this.messageContainer.appendChild(newMessageEL);
            newMessageEL.scrollIntoView();
        });

        this.updateLineRefListener();
    }

    private updateLineRefListener() {
        const tag = document.getElementsByClassName('line_ref');
        for(const item of tag) {
            const el = item as HTMLElement;
            if(!el.onclick) el.addEventListener('click', this.handleLineRef.bind(this));
        }
    }

    private handleLineRef(e) {
        const line_url = e.target.getAttribute('line_ref');
        const re = /C(.*)L(.*)L(.*)/;
        const result = line_url.match(re);
        this.cursorCallback(true, result[1], result[2], result[3]);
    }


    private initStyle() {
        // update style
        const sheet = document.createElement('style');
        sheet.innerHTML += '.line_highlight {background-color: yellow }\n';
        sheet.innerHTML += '.line_ref { color: #aa1111; cursor: pointer; font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}\n';
        sheet.innerHTML += '.line_ref:hover { color: #971616; text-decoration: underline; }\n';
        sheet.innerHTML += '.message_content { display: inline-block; background: #e8e8e8; padding: 10px; border-radius: 12px; min-width: 100px; font-size: 12px; } \n';
        document.body.appendChild(sheet);
    }

    private createNewMessage(message: Message): HTMLDivElement {
        const message_container = document.createElement('div');
        message_container.setAttribute('style', 'margin: 10px 20px;');

        if(this.user.user_id === message.sender.user_id) {
            message_container.style.textAlign = 'right';
        }

        // replace the original text into formatted text
        // [text](URL)
        // [text](C0L1L5)
        const re = /\[(.*?)\]\((.*?)\)/g;
        const origin_text = message.content;
        const timestamp = getTime();
        const formated_text = origin_text.replace(re, "<span class='line_ref' line_ref=$2 timestamp="+timestamp+" source="+message.sender.user_id+" >$1</span>");

        const message_content = document.createElement('div');
        message_content.innerHTML = formated_text;
        message_content.classList.add('message_content');
        
        const message_sender = document.createElement('div');
        message_sender.innerText = message.sender.username;
        message_sender.setAttribute('style', 'display:inline; font-size: 10px; font-weight: bold; color: ' + message.sender.color);
        
        const message_time = document.createElement('div');
        message_time.innerText = message.time;
        message_time.setAttribute('style', 'font-size: 10px; display:inline; margin-left: 10px; color: #b7b7b7');

        const time_sender = document.createElement('div');
        time_sender.appendChild(message_sender);
        time_sender.appendChild(message_time);

        message_container.appendChild(time_sender);
        message_container.appendChild(message_content);

        return message_container;
    }

    private initContainer(): void {
        const tool_container = document.createElement('div');
        const message_container = document.createElement('div');
        const input_container = document.createElement('div');
        tool_container.setAttribute('style', 'height: 40px; color: #516766; font-weight: bold; padding-top: 8px; text-align: center; background-color: #9dc5a7; border-radius: 10px 10px 0px 0px;');
        tool_container.addEventListener('click', this.handleFolding.bind(this));

        const el = document.createElement('div');
        const icon = document.createElement('i');
        el.innerText = 'Chat';
        el.style.display = 'inline';
        el.style.marginLeft = '8px';
        icon.innerHTML = '<i class="fa fa-comment"></i>';
        tool_container.appendChild(icon);
        tool_container.appendChild(el);

        message_container.setAttribute('style', 'height: 300px; background-color: whitesmoke; overflow:scroll');
        input_container.setAttribute('style', 'height: 50px; width: 280px; background-color: white; border: solid 2px #ececec; border-radius: 10px; margin:auto');
        
        const input_box = document.createElement('textarea');
        input_box.setAttribute('placeholder', 'write your message');
        input_box.setAttribute('style', 'padding-left: 10px; padding-right: 10px; font-size: 12px; color: #7d7d7d; width: 220px; border: none; background-color: transparent; resize: none;outline: none;');

        const input_button = document.createElement('button');
        const button_icon = document.createElement('i');
        button_icon.innerHTML = '<i class="fa fa-paper-plane"></i>';
        input_button.appendChild(button_icon);
        input_button.setAttribute('style', 'color: #868686; display:inline; height:46px; width: 50px; position: relative; top: -17px; background: transparent; border: none; border-left: solid 2px #ececec');
        
        input_button.addEventListener('click', this.handleSubmitting.bind(this));
        input_button.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
        input_button.addEventListener('mouseout', this.handleMouseOut.bind(this));

        input_container.appendChild(input_box);
        input_container.appendChild(input_button);
        
        this.container.appendChild(tool_container);
        this.container.appendChild(message_container);
        this.container.appendChild(input_container);
        this.toolContainer = tool_container;
        this.messageBox = input_box;
        this.inputButton = input_button;
        this.messageContainer = message_container;
    }

    private handleMouseEnter(): void {
        // this ---> refers to the button
        this.inputButton.style.color = '#484848';
    }

    private handleMouseOut(): void {
        // this ---> refers to the button
        this.inputButton.style.color = '#868686';
    }

    private handleFolding(flag: boolean): void {
        this.folded = !this.folded;
        if(this.folded) {
            this.container.style.bottom = '-360px';
        }
        else {
            this.container.style.bottom = '20px';
            if(this.isNew) this.notifyNewMessage(false);
        }
    }

    private handleSubmitting(): void {
        this.inputButton.blur();
        if(this.messageBox.value) {
            const newMessage: Message = {
                sender: this.user,
                content: this.messageBox.value,
                time: getTime()
            };
            const index = this.doc.getData().length;

            const op = {
                p: [index],
                li: newMessage
            };

            this.doc.submitOp([op], this);
            this.messageBox.value = '';
        }
    }
}
