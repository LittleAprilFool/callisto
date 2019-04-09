import {SharedButton} from 'component/sharedButton';

const Jupyter = require('base/js/namespace');

function load_ipython_extension() {
    const sharedButton = new SharedButton;
    Jupyter.toolbar.add_buttons_group([sharedButton.button]);
};

export = {
    "load_ipython_extension": load_ipython_extension
};