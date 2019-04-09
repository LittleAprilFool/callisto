define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    ;
    const Jupyter = require('base/js/namespace');
    class SharedButton {
        constructor() {
            this.button = {
                label: 'Share',
                icon: 'fa-share',
                id: 'share-notebook',
                callback: this.displaySharedDialog
            };
        }
        ;
        displaySharedDialog() {
            Jupyter.notebook.insert_cell_above('code').set_text('# little april fool');
            Jupyter.notebook.select_prev();
            Jupyter.notebook.execute_cell_and_select_below();
        }
        ;
    }
    exports.SharedButton = SharedButton;
    ;
});
