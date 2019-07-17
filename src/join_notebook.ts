import { JoinButton } from './component/joinButton';
import './external/sdb';

const load_ipython_extension = () => {
    const joinButton = new JoinButton;
    const notebook_header = document.querySelector('#notebook_list_header');
    if (notebook_header !== null) {
        notebook_header.appendChild(joinButton.button);
    }
};

export = {
    "load_ipython_extension": load_ipython_extension
};