const dialog = require('base/js/dialog');
const i18n = require('base/js/i18n');
const Jupyter = require('base/js/namespace');

import { joinDoc } from '../action/sharedbAction';
import { openNotebook } from '../action/notebookAction'

export class JoinButton {
    public button: HTMLDivElement;
    constructor() {
        let form = document.createElement('div');
        form.setAttribute('class', 'pull-right sort-button');
        let button = document.createElement('button');
        button.setAttribute('type', 'button');
        button.setAttribute('id', 'join_notebook');
        button.setAttribute('class', 'btn btn-default btn-xs');
        button.setAttribute('data-toggle', 'button');
        button.setAttribute('title', 'Join Notebook');
        button.setAttribute('style', 'font-weight:bold;');
        button.innerText = 'Join Notebook';
        button.onclick = this.displayJoinDialog.bind(this);
        form.appendChild(button);
        this.button = form;
    };

    private displayJoinDialog():void{
        let join_dialog = this.createJoinDialog();
        dialog.modal(join_dialog);
    };

    private joinHandler(doc_name:string):void {
        // check if doc exists
        joinDoc(doc_name).then(sdbDoc => {
            // if exists, open notebook
            if(sdbDoc) {
                openNotebook(doc_name, sdbDoc);
                let close_button:HTMLButtonElement = document.querySelector('#join-close')
                close_button.click();
            }
            else {
                let error_dialog = this.createErrorDialog(doc_name);
                dialog.modal(error_dialog);
            }
        })
    }

    private createErrorDialog(wrong_value:string):Dialog {
        let form = document.createElement('form')
        form.setAttribute('id', 'join_form')
        form.setAttribute('onSubmit', 'return false;')

        let form_input = document.createElement('input')
        form_input.setAttribute('id', 'join_code')
        form_input.setAttribute('style', 'width:100%')
        form_input.setAttribute('value', wrong_value)
        form.appendChild(form_input)

        let form_label = document.createElement('label');
        form_label.setAttribute('for', 'join_code');
        form_label.setAttribute('style', 'color:red');
        form_label.innerText = 'Invalid Notebook code. Please try again.';
        form.appendChild(form_label);

        return {
            title: i18n.msg._('Join Notebook'),
            body: form,
            buttons: {
                'Join': {
                    'id': 'join-button',
                    'class': 'btn-primary', 
                    'click': () => {
                        let doc_name = form_input.value;
                        this.joinHandler(doc_name)
                    }
                },
                'Cancel': {
                    'id': 'join-close',
                    'class': 'btn-default',
                    'click': () => {
                    }
                }
            },
            keyboard_manager: Jupyter.keyboard_manager
        }
    }

    private createJoinDialog():Dialog{
        let form = document.createElement('form')
        form.setAttribute('id', 'join_form')
        form.setAttribute('onSubmit', 'return false;')
        
        let form_input = document.createElement('input')
        form_input.setAttribute('id', 'join_code')
        form_input.setAttribute('style', 'width:100%')
        form.appendChild(form_input)
        
        let join_button = document.querySelector('#join_notebook');
        join_button.classList.toggle('active');
        
        let form_label = document.createElement('label');
        form_label.setAttribute('for', 'join_code');
        form_label.innerText = 'Please enter notebook code to join.';
        form.appendChild(form_label);

        return {
            title: i18n.msg._('Join Notebook'),
            body: form,
            buttons: {
                'Join': {
                    'id': 'join-button',
                    'class': 'btn-primary', 
                    'click': () => {
                        let doc_name = form_input.value;
                        this.joinHandler(doc_name)
                    }
                },
                'Cancel': {
                    'id': 'join-close',
                    'class': 'btn-default',
                    'click': () => {
                    }
                }
            },
            keyboard_manager: Jupyter.keyboard_manager
        }
    }

}