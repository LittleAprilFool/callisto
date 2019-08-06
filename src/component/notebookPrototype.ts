const Jupyter = require('base/js/namespace');
const dialog = require('base/js/dialog');
const i18n = require('base/js/i18n');

export const overwritePrototype = (): void => {
    createUnrenderedMarkdownCellEvent();
    createTypeChangeEvent();
    createKernelRestartEvent();
    createCellExecutionEvent();
};

const createUnrenderedMarkdownCellEvent = (): void => {
    const TextCell = require('notebook/js/textcell');
    Jupyter.ignoreRender = false;

    TextCell.MarkdownCell.prototype.unrender = function () {
        const cont = TextCell.TextCell.prototype.unrender.apply(this);
        this.notebook.set_insert_image_enabled(true);
        this.events.trigger('unrendered.MarkdownCell', this);
    };
};

// when change type, Jupyter Notebook would delete the original cell, and insert a new cell
const createTypeChangeEvent = (): void => {
    Jupyter.ignoreInsert = false;
    const Notebook = require('notebook/js/notebook');
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
};

const createKernelRestartEvent = (): void => {
    const Notebook = require('notebook/js/notebook');
    Notebook.Notebook.prototype._restart_kernel = function (options) {
        if(!(window as any).isHost) {
            console.log("Forwarding the request to the host notebook");
            const new_dialog = (window as any).getKernelDialog(options.dialog.title);
            dialog.modal(new_dialog);
            return;
        }
        console.log("This host is restarting the kernel!");
        // const that = this;
        options = options || {};
        let resolve_promise;
        let reject_promise;
        const promise = new Promise((resolve, reject) => {
            resolve_promise = resolve;
            reject_promise = reject;
        });
        
        const restart_and_resolve = () => {
            this.kernel.restart(() => {
                // resolve when the kernel is *ready* not just started
                this.events.one('kernel_ready.Kernel', resolve_promise);
            }, reject_promise);
        };

        const do_kernel_action = options.kernel_action || restart_and_resolve;
       
        // no need to confirm if the kernel is not connected
        if (options.confirm === false || !this.kernel.is_connected()) {
            const default_button = options.dialog.buttons[Object.keys(options.dialog.buttons)[0]];
            promise.then(default_button.click);
            do_kernel_action();
            return promise;
        }
        options.dialog.notebook = this;
        options.dialog.keyboard_manager = this.keyboard_manager;
        // add 'Continue running' cancel button
        const buttons = {
            "Continue Running": {},
        };
        // hook up button.click actions after restart promise resolves
        Object.keys(options.dialog.buttons).map(key => {
            const button = buttons[key] = options.dialog.buttons[key];
            const click = button.click;
            button.click = () => {
                promise.then(click);
                do_kernel_action();
            };
        });
        options.dialog.buttons = buttons;
        dialog.modal(options.dialog);
        return promise;
    };
};

const createCellExecutionEvent = (): void => {
    const CC = require('notebook/js/codecell');
    const CodeCell = CC.CodeCell;
    CodeCell.prototype.execute = function (stop_on_error) {
        if (!(window as any).isHost) {
            this.set_input_prompt('*');
            this.events.trigger('execute.CodeCell', {cell: this});
            return;
        }
        if (!this.kernel) {
            console.log(i18n.msg._("Can't execute cell since kernel is not set."));
            return;
        }

        if (stop_on_error === undefined) {
            if (this.metadata !== undefined && 
                    this.metadata.tags !== undefined) {
                if (this.metadata.tags.indexOf('raises-exception') !== -1) {
                    stop_on_error = false;
                } else {
                    stop_on_error = true;
                }
            } else {
               stop_on_error = true;
            }
        }

        this.clear_output(false, true);
        const old_msg_id = this.last_msg_id;
        if (old_msg_id) {
            this.kernel.clear_callbacks_for_msg(old_msg_id);
            delete CodeCell.msg_cells[old_msg_id];
            this.last_msg_id = null;
        }
        if (this.get_text().trim().length === 0) {
            // nothing to do
            this.set_input_prompt(null);
            return;
        }
        this.set_input_prompt('*');
        this.element.addClass("running");
        const callbacks = this.get_callbacks();
        
        this.last_msg_id = this.kernel.execute(this.get_text(), callbacks, {silent: false, store_history: true,
            stop_on_error});
        CodeCell.msg_cells[this.last_msg_id] = this;
        this.render();
        this.events.trigger('execute.CodeCell', {cell: this});
        const handleFinished = (evt, data) => {
            if (this.kernel.id === data.kernel.id && this.last_msg_id === data.msg_id) {
                    this.events.trigger('finished_execute.CodeCell', {cell: this});
                this.events.off('finished_iopub.Kernel', handleFinished);
              }
        };
        this.events.on('finished_iopub.Kernel', handleFinished);
    };
};