// require('./external/sdb');
define(["require", "exports", "./component/sharedButton", "./action/notebookAction", "./external/sdb"], function (require, exports, sharedButton_1, notebookAction_1) {
    "use strict";
    const Jupyter = require('base/js/namespace');
    function load_ipython_extension() {
        const sharedButton = new sharedButton_1.SharedButton;
        Jupyter.toolbar.add_buttons_group([sharedButton.button]);
        if (Jupyter.notebook.metadata.shared === true) {
            notebookAction_1.loadNotebook();
        }
    }
    ;
    return {
        "load_ipython_extension": load_ipython_extension
    };
});
