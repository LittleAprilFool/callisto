import { createDoc } from '../action/sharedbAction';
import { generateUUID } from '../action/utils';
import { NotebookBinding } from './notebookBinding';

const Jupyter = require('base/js/namespace');
const i18n = require('base/js/i18n');
const dialog = require('base/js/dialog');

export class SharedButton {
    public button: Button;
    private sharedNotebook: NotebookSDB;
    private ws: WebSocket;

    constructor() {
        this.button = {
            label: 'Share',
            icon: 'fa-share',
            id: 'share-notebook',
            callback: this.displaySharedDialog.bind(this)
        };
    }

    public attachNotebook(notebook): void {
        console.log('attach to notebook');
        this.sharedNotebook = notebook;
        disableFeatures();
    }

    private displaySharedDialog(): void {
        // If the notebook is already shared, display the code, allow for canceling
        if (Jupyter.notebook.metadata.shared) {
            const code_dialog = this.createCodeDialog(Jupyter.notebook.metadata.doc_name, this.cancelHandler.bind(this));
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
        this.sharedNotebook.destroy();
        updateSharedButton(false);
    }

    private shareHandler(): void {
        console.log('start sharing!!hahahq');
       
        // set share flag to true
        Jupyter.notebook.metadata.shared = true;
        
        // add doc name
        Jupyter.notebook.metadata.doc_name = generateUUID();

        // save after changing metadata
        Jupyter.notebook.save_notebook();   

        const code_dialog = this.createCodeDialog(Jupyter.notebook.metadata.doc_name, this.cancelHandler);
        dialog.modal(code_dialog);

        createDoc(Jupyter.notebook.metadata.doc_name).then(({doc, ws}) => {
                this.sharedNotebook = new NotebookBinding(doc, ws);
        });
        // this.binding = new SharedbBinding(Jupyter.notebook.metadata.doc_name);
        updateSharedButton(true);
        disableFeatures();
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

export function disableFeatures(): void {
    // disable move cells up and down
    const moveButton = document.getElementById('move_up_down');
    if(moveButton) moveButton.remove();

    // disable insert above
    const insertAbove = document.getElementById('insert_cell_above');
    if(insertAbove) insertAbove.remove();

    // disable copy and paste
    const cpButton = document.getElementById('cut_copy_paste').childNodes;
    if(cpButton.length === 3) {
        cpButton[2].remove();
        cpButton[1].remove();
    }
}