import { IDiffTabWidget, Notebook } from 'types';
import { timeAgo } from '../action/utils';
import { DiffWidget } from './diffWidget';

export class DiffTabWidget implements IDiffTabWidget {
    private container: HTMLElement;

    private new_timestamp: number;
    private old_timestamp: number;

    private diff_title: string;
    private chatCallback: any;
    private diffList: DiffWidget[];

    constructor(private client: any, private id: any) {
        this.initContainer();
        this.initStyle();
        this.diffList = [];
    }

    public destroy = (): void => {
        this.container.parentNode.removeChild(this.container);
        const notebook_widget = document.querySelector('#notebook-container');
        notebook_widget.setAttribute('style', 'display:block');
        this.diffList.forEach(widget => {
            if(widget.container.parentNode) widget.container.parentNode.removeChild(widget.container);
        });
    }

    public reload = (): void => {
        // if this is control group, remove all opened tabs
        if((window as any).study_condition === 'control') {
            this.container.parentNode.removeChild(this.container);
            this.diffList.forEach(widget => {
                if(widget.container.parentNode) widget.container.parentNode.removeChild(widget.container);
            });
            this.diffList = [];
            this.initContainer();
            const notebook_widget = document.querySelector('#notebook-container');
            notebook_widget.setAttribute('style', 'display:block');
        }
    }
    public checkTab = (label: string): boolean => {
        const checkTabEl = document.querySelector('.diff-tab.'+label);
        if(label === 'version-current') {
            const currentEl = document.querySelector('.diff-tab#tab-current');
            this.activeTab(currentEl as HTMLElement);
            return true;
        }
        if (checkTabEl) {
            this.activeTab(checkTabEl as HTMLElement);
            return true;
        }
        else return false;
    }
    public bindChatAction = (callback): void => {
        this.chatCallback = callback;
    }

    public addTab = (label: string, type: string, timestamp: number): void => {
        const new_tab = document.createElement('div');
        new_tab.classList.add('diff-tab', label);
        new_tab.setAttribute('label', label);
        const icon = document.createElement('i');
        icon.innerHTML = type==='diff'?'<i class="fa fa-history"></i>':'<i class="fa fa-code"></i>';
        const title = document.createElement('span');
        title.innerText = timeAgo(timestamp);
        const close_icon = document.createElement('i');
        close_icon.innerHTML = '<i class = "fa fa-times">';
        close_icon.classList.add('close-tab');
        close_icon.setAttribute('label', label);
        close_icon.addEventListener('click', this.closeTabHandler);
        new_tab.appendChild(icon);
        new_tab.appendChild(title);
        new_tab.appendChild(close_icon);

        new_tab.addEventListener('click', this.activeTabHandler);
        const tab_active = document.querySelector('.tab-active');
        if(tab_active) tab_active.classList.remove('tab-active');
        new_tab.classList.add('tab-active');
        this.container.appendChild(new_tab);

        this.activeTab(new_tab);
    }

    public diffThumb = (new_timestamp: number, old_timestamp: number): Promise<string[]> => {
        this.new_timestamp = new_timestamp;
        this.old_timestamp = old_timestamp;
        return new Promise((resolve, reject) => {
            this.fetchTwoSnapShot(this.id[0], this.id[1], new_timestamp, old_timestamp)
            .then(notebook=> {
                const new_notebook = notebook[0];
                const old_notebook = notebook[1];
                let diff_new = '';
                let diff_old = '';
                // this is not a good way to catch diff, should compare cell.uid
                new_notebook.cells.forEach((cell, index) => {
                    const old_cell = old_notebook.cells[index];
                    if (old_cell) {
                        const new_source = cell.hasOwnProperty('source')? cell.source: '';
                        const old_source = old_cell.hasOwnProperty('source')?old_cell.source : '';
                        if(new_source !== old_source) {
                            diff_new = new_source;
                            diff_old = old_source;
                        }
                    }
                });
                resolve([diff_new, diff_old]);
            });
        });
    }

    public addDiff = (new_timestamp: number, old_timestamp: number, title: string, message?: any): void => {
        this.new_timestamp = new_timestamp;
        this.old_timestamp = old_timestamp;
        this.diff_title = 'Notebook diff between old-' + old_timestamp.toString() + ' (' + timeAgo(old_timestamp) + ') and new-' + new_timestamp.toString() + ' (' + timeAgo(new_timestamp) + ')';
        this.fetchTwoSnapShot(this.id[0], this.id[1], new_timestamp, old_timestamp)
        .then(notebook=> {
            const diffWidget = new DiffWidget('diff', notebook, this.diff_title, [this.new_timestamp, this.old_timestamp], message);
            this.diffList.push(diffWidget);
        });
    }

    public addVersion = (timestamp: number, title: string, message?: any, ref?: any): void => {
        const version_timestamp = timestamp;
        const version_title = 'Notebook snapshot-' + timestamp.toString() + ' (' + timeAgo(timestamp) + ')';
        this.fetchSnapShot(this.id[0], this.id[1], timestamp).then(snapshot => {
            const version_notebook = snapshot.data.notebook;
            const versionWidget = new DiffWidget('version', [version_notebook], version_title, [version_timestamp], message, ref);
            this.diffList.push(versionWidget);
        });
    }

    private fetchTwoSnapShot = (para0, para1, new_timestamp, old_timestamp): Promise<any> => {
        let new_notebook;
        let old_notebook;
        return new Promise((resolve, reject) => {
            this.fetchSnapShot(para0, para1, new_timestamp)
            .then(new_snapshot => {new_notebook = new_snapshot.data.notebook;})
            .then(() => {
                this.fetchSnapShot(para0, para1, old_timestamp)
                .then(old_snapshot => {old_notebook = old_snapshot.data.notebook;})
                .then(() => resolve([new_notebook, old_notebook]));
            });
        });
    }

    private fetchSnapShot = (para0, para1, timestamp): Promise<any> => {
        return new Promise((resolve, reject)=> {
            this.client.connection.fetchSnapshotByTimestamp(para0, para1, timestamp, (err, snapshot) => {
                resolve(snapshot);
            });
        });
    }
    private closeTabHandler = (e): void => {
        const label = e.currentTarget.getAttribute('label');
        const related_eles = document.querySelectorAll('.diff-tab.'+ label);
        related_eles.forEach(ele=> {
            ele.parentNode.removeChild(ele);
        });

        let target_widget;
        let target_index;
        this.diffList.forEach((widget, index) => {
            if (widget.label === label) {
                target_widget = widget;
                target_index = index;
            }
        });

        target_widget.destroy();
        this.diffList.splice(target_index, 1);

        const tab_list = document.querySelectorAll('.diff-tab');
        const last_tab = tab_list[tab_list.length-1];
        this.activeTab(last_tab as HTMLElement);
        e.stopPropagation();
    }

    private activeTabHandler = (e): void => {
        const label = e.currentTarget.getAttribute('label');
        if(this.chatCallback) this.chatCallback(label);
        else console.log('No chatcallback in difftab widget');
        this.activeTab(e.currentTarget);
    }

    private activeTab = (ele: HTMLElement): void => {
        const active_tab = document.querySelector('.tab-active');
        if(active_tab) active_tab.classList.remove('tab-active');
        ele.classList.add('tab-active');

        const label = ele.getAttribute('label');

        // show the related diff widget
        this.diffList.forEach(widget => {
            if (widget.label === label) widget.show();
            else widget.hide();
        });
        // const diffWidgets = document.querySelectorAll('.diffwidget-container');
        // diffWidgets.forEach(widget => {
        //     if(widget.classList.contains(label)) widget.setAttribute('style', 'display: block');
        //     else widget.setAttribute('style', 'display:none');
        // });

        // show or hide current notebook
        const notebook_widget = document.querySelector('#notebook-container');
        if(label === 'version-current') {
            notebook_widget.setAttribute('style', 'display:block');
            const alert = document.querySelector('#SwitchAlert') as HTMLElement;
            alert.style.display = 'none';
        }
        else notebook_widget.setAttribute('style', 'display:none');

    }

    private initContainer = (): void => {
        this.container = document.createElement('div');
        this.container.id = 'difftab-container';
        this.container.classList.add('container');

        const notebook_tab = document.createElement('div');
        notebook_tab.classList.add('diff-tab');
        const icon = document.createElement('i');
        icon.innerHTML = '<i class="fa fa-code"></i>';
        const title = document.createElement('span');
        title.innerText = 'Current Notebook';
        notebook_tab.id = 'tab-current';
        notebook_tab.classList.add('tab-active');
        notebook_tab.appendChild(icon);
        notebook_tab.appendChild(title);
        notebook_tab.setAttribute('label', 'version-current');

        notebook_tab.addEventListener('click', this.activeTabHandler);

        this.container.appendChild(notebook_tab);
        
        const container_wrapper = document.createElement('div');
        container_wrapper.classList.add('tab-container-wrapper');
        container_wrapper.appendChild(this.container);

        const header = document.querySelector('#header');
        header.appendChild(container_wrapper);

        const alert = document.createElement('div');
        alert.classList.add('alert', 'alert-primary','container');
        alert.id = 'SwitchAlert';
        alert.setAttribute('role', 'alert');
        alert.innerText = 'The diff/snapshot view is readonly, please switch to the current notebook to make edits.';
        container_wrapper.appendChild(alert);
    }

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '#difftab-container { height: 40px; background: #eee; padding-top: 10px; border-bottom: 1px solid #ddd; } \n';
        sheet.innerHTML += '.diff-tab { cursor: pointer; display: inline-block; color:#ccc; border: solid 1px #dedede; font-size: 12px; min-width: 150px; height: 100%; background: white; text-align: center; font-weight: bold; padding: 5px 0; border-radius: 10px 10px 0 0; } \n';
        sheet.innerHTML += '.diff-tab i {margin-right: 5px; margin-left: 5px; font-weight: bold;} \n';
        sheet.innerHTML += '.tab-active {color: black !important;} \n';
        sheet.innerHTML += '.close-tab { font-size: 12px; margin-left: 20px;}\n';
        sheet.innerHTML += '.alert { display: none; margin-bottom: 0px; border: 1px solid transparent; border-radius: .25rem;}\n';
        sheet.innerHTML += '.alert-primary {color: #004085; background-color: #cce5ff; border-color: #b8daff}\n';
        sheet.innerHTML += '.d2h-diff-table {font-family: monospace !important; font-size: 14px; }\n';
        sheet.innerHTML += '.d2h-code-side-linenumber {width: 34px; border-color: #ddd}\n';
        sheet.innerHTML += '.d2h-file-header {display: none}\n';
        sheet.innerHTML += '.d2h-file-diff .d2h-del.d2h-change {background-color: #fee8e9}\n';

        const header = document.querySelector('#header');
        header.classList.add('header-customized');
        sheet.innerHTML += '.header-customized { border-bottom: none !important; left: -8px; }\n';

        const notebook = document.querySelector('#notebook');
        notebook.classList.add('notebook-customized');
        sheet.innerHTML += '#notebook.notebook-customized { padding-top: 0; }\n';

        const notebook_container = document.querySelector('#notebook-container');
        notebook_container.classList.add('notebook-container-customized');
        sheet.innerHTML += '#notebook-container.notebook-container-customized { border-top: none; }\n';

        const site = document.querySelector('#site') as HTMLDivElement ;
        site.style.height = 'calc(100% - 150px)';
        
        sheet.innerHTML += '.tab-container-wrapper { margin: 0; background-color: #eee;}\n';
        document.body.appendChild(sheet);
    }
}