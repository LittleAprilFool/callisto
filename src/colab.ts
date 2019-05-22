import { loadNotebook } from './action/notebookAction';
import { SharedButton } from './component/sharedButton';
import './external/sdb';

const Jupyter = require('base/js/namespace');

function load_ipython_extension() {
    const sharedButton = new SharedButton;
    Jupyter.toolbar.add_buttons_group([sharedButton.button]);
    if (Jupyter.notebook.metadata.shared === true) {
        loadNotebook();
    }
}

export = {
    "load_ipython_extension": load_ipython_extension
};