import { createDoc } from '../action/sharedbAction';
import { generateUUID } from '../action/utils';
import { SharedNotebook } from './sharedNotebook';

const Jupyter = require('base/js/namespace');
const i18n = require('base/js/i18n');
const dialog = require('base/js/dialog');

export class SharedButton {
    public button: Button;
    public sharedNotebook: any;

    constructor() {
        this.button = {
            label: 'Share',
            icon: 'fa-share',
            id: 'share-notebook',
            callback: this.displaySharedDialog.bind(this)
        };
    }


    private displaySharedDialog(): void {
        // If the notebook is already shared, display the code, allow for canceling
        if (Jupyter.notebook.metadata.shared) {
            const code_dialog = this.createCodeDialog(Jupyter.notebook.metadata.doc_name, this.cancelHandler);
            dialog.modal(code_dialog);
        }
        // If the notebook is not shared, establish the sharing process
        else {
            const new_code_dialog = this.createNewCodeDialog(this.shareHandler.bind(this));
            dialog.modal(new_code_dialog);
        }
    }

    private createNewCodeDialog(shareHandler: ()=>void): Dialog {
        const form = document.createElement('form');
        form.setAttribute('id', 'share_nb');
        form.innerHTML += '<h4> Would you like to share this notebook?</h4>';
        return {
            title: i18n.msg._('Share Notebook'),
            body: form,
            buttons: {
                'Yes': {
                    'id': 'yes-btn',
                    'class': 'btn-primary', 
                    'click': () => {
                        shareHandler();
                    }
                },
                'No': {
                    'class': 'btn-default',
                    'click': () => {
                        console.log('cancelled sharing');
                    }
                }
            },
            keyboard_manager: Jupyter.keyboard_manager
        };
    }

    private createCodeDialog(code: string, cancelHandler: ()=>void): Dialog {
        const form = document.createElement('div');
        form.setAttribute('id', 'code_dialog');
        form.innerHTML += '<h4>Send the following code to other users to enable collaborative editing:';
        form.innerHTML += '<h4 align="center">' + code + '</h4>';
        return {
            title: i18n.msg._('Sharing Code'),
            body: form,
            buttons: {
                'OK': {
                    'id': 'ok-btn',
                    // 'class': 'btn-primary btn-default'
                },
                'Cancel Sharing': {
                    'id': 'cancel-btn',
                    'click': () => {
                        cancelHandler();
                    }
                }
            },
            keyboard_manager: Jupyter.keyboard_manager
        };
    }

    private cancelHandler(): void {
        console.log('cancel share!!');
        
        // set share variable to false
        Jupyter.notebook.metadata.shared = false;

        // remove doc name
        Jupyter.notebook.metadata.doc_name = '';
        
        // share after changing metadata
        Jupyter.notebook.save_notebook();

        // close websocket
        // ws.close()
    }

    private shareHandler(): void {
        console.log('start sharing!!');
       
        // set share flag to true
        Jupyter.notebook.metadata.shared = true;
        
        // add doc name
        Jupyter.notebook.metadata.doc_name = generateUUID();

        // save after changing metadata
        Jupyter.notebook.save_notebook();   

        const code_dialog = this.createCodeDialog(Jupyter.notebook.metadata.doc_name, this.cancelHandler);
        dialog.modal(code_dialog);

        createDoc(Jupyter.notebook.metadata.doc_name).then(sdbDoc=> {
                this.sharedNotebook = new SharedNotebook(sdbDoc);
        });
        // this.binding = new SharedbBinding(Jupyter.notebook.metadata.doc_name);
        updateSharedButton(true);
    }
}
export function updateSharedButton(flag: boolean): void {
    const share_button = document.querySelector('#share-notebook');
    share_button.firstElementChild.classList.toggle("fa-share");
    share_button.firstElementChild.classList.toggle("fa-check");
    if (flag) {
        share_button.setAttribute("style", "background-color:#d4edda; color:#155724; border-color: #c3e6cb");
    }
    else {
        share_button.setAttribute("style", "background-color:#fff; border-color: #ccc");
    }
}