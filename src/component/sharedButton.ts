interface Button {
    readonly label: string;
    readonly icon: string;
    readonly id: string;
    callback(): any;
};

const Jupyter = require('base/js/namespace');

export class SharedButton {
    button: Button;

    constructor() {
        this.button = {
            label: 'Share',
            icon: 'fa-share',
            id: 'share-notebook',
            callback: this.displaySharedDialog
        };
    };

    displaySharedDialog() {
        Jupyter.notebook.insert_cell_above('code').set_text('# little april fool');
        Jupyter.notebook.select_prev();
        Jupyter.notebook.execute_cell_and_select_below();
    };

};