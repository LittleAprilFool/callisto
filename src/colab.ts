import { loadNotebook } from './action/notebookAction';
import { SharedButton } from './component/sharedButton';
// import './external/diff';
import './external/diff2html';
import './external/list';
import './external/sdb';

const Jupyter = require('base/js/namespace');

const load_ipython_extension = () => {
    const sharedButton = new SharedButton;
    Jupyter.toolbar.add_buttons_group([sharedButton.button]);
    if (Jupyter.notebook.metadata.shared === true) {
        loadNotebook().then(notebook => {
            sharedButton.attachNotebook(notebook);
        });
    }
};

export = {
    "load_ipython_extension": load_ipython_extension
};