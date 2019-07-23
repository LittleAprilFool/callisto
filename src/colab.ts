import { loadNotebook } from './action/notebookAction';
import { SharedButton } from './component/sharedButton';
import './external/sdb';
// import './external/luxon';
// import './external/javascript-time-ago';
// import './external/javascript-time-ago/locale/en/index';

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