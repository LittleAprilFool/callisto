define(["require", "exports", "../action/utils", "../action/sharedbAction", "./sharedNotebook"], function (require, exports, utils_1, sharedbAction_1, sharedNotebook_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Jupyter = require('base/js/namespace');
    const i18n = require('base/js/i18n');
    const dialog = require('base/js/dialog');
    class SharedButton {
        constructor() {
            this.button = {
                label: 'Share',
                icon: 'fa-share',
                id: 'share-notebook',
                callback: this.displaySharedDialog.bind(this)
            };
        }
        ;
        displaySharedDialog() {
            // If the notebook is already shared, display the code, allow for canceling
            if (Jupyter.notebook.metadata.shared == true) {
                let code_dialog = this.createCodeDialog(Jupyter.notebook.metadata.doc_name, this.cancelHandler);
                dialog.modal(code_dialog);
            }
            // If the notebook is not shared, establish the sharing process
            else {
                let new_code_dialog = this.createNewCodeDialog(this.shareHandler.bind(this));
                dialog.modal(new_code_dialog);
            }
            ;
        }
        ;
        createNewCodeDialog(shareHandler) {
            let form = document.createElement('form');
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
        ;
        createCodeDialog(code, cancelHandler) {
            let form = document.createElement('div');
            form.setAttribute('id', 'code_dialog');
            form.innerHTML += '<h4>Send the following code to other users to enable collaborative editing:';
            form.innerHTML += '<h4 align="center">' + code + '</h4>';
            return {
                title: i18n.msg._('Sharing Code'),
                body: form,
                buttons: {
                    'OK': {
                        'id': 'ok-btn',
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
        ;
        cancelHandler() {
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
        ;
        shareHandler() {
            console.log('start sharing!!');
            // set share flag to true
            Jupyter.notebook.metadata.shared = true;
            // add doc name
            Jupyter.notebook.metadata.doc_name = utils_1.generateUUID();
            // save after changing metadata
            Jupyter.notebook.save_notebook();
            let code_dialog = this.createCodeDialog(Jupyter.notebook.metadata.doc_name, this.cancelHandler);
            dialog.modal(code_dialog);
            sharedbAction_1.createDoc(Jupyter.notebook.metadata.doc_name).then(sdbDoc => {
                this.sharedNotebook = new sharedNotebook_1.SharedNotebook(sdbDoc);
            });
            //this.binding = new SharedbBinding(Jupyter.notebook.metadata.doc_name);
            updateSharedButton(true);
        }
        ;
    }
    exports.SharedButton = SharedButton;
    function updateSharedButton(flag) {
        let share_button = document.querySelector('#share-notebook');
        share_button.firstElementChild.classList.toggle("fa-share");
        share_button.firstElementChild.classList.toggle("fa-check");
        if (flag) {
            share_button.setAttribute("style", "background-color:#d4edda; color:#155724; border-color: #c3e6cb");
        }
        else {
            share_button.setAttribute("style", "background-color:#fff; border-color: #ccc");
        }
        ;
    }
    exports.updateSharedButton = updateSharedButton;
    ;
});
