define(["require", "exports", "component/sharedButton"], function (require, exports, sharedButton_1) {
    "use strict";
    const Jupyter = require('base/js/namespace');
    function load_ipython_extension() {
        const sharedButton = new sharedButton_1.SharedButton;
        Jupyter.toolbar.add_buttons_group([sharedButton.button]);
    }
    ;
    return {
        "load_ipython_extension": load_ipython_extension
    };
});
