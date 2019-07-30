import { IDiffTabWidget, Notebook } from 'types';
import { timeAgo } from '../action/utils';
import { DiffWidget } from './diffWidget';

export class DiffTabWidget implements IDiffTabWidget {
    private container: HTMLElement;

    private new_timestamp: number;
    private old_timestamp: number;
    private new_notebook: Notebook;
    private old_notebook: Notebook;
    private diff_title: string;
    private version_timestamp: number;
    private version_notebook: Notebook;
    private version_title: string;
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
            widget.container.parentNode.removeChild(widget.container);
        });
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
       
        document.querySelector('.tab-active').classList.remove('tab-active');
        new_tab.classList.add('tab-active');
        this.container.appendChild(new_tab);

        this.activeTab(new_tab);
    }

    public addDiff = (new_timestamp: number, old_timestamp: number, title: string): void => {
        this.new_timestamp = new_timestamp;
        this.old_timestamp = old_timestamp;
        this.diff_title = 'Notebook diff between snapshot-' + new_timestamp.toString() + ' (' + timeAgo(new_timestamp) + ') and snapshot-' + old_timestamp.toString() + ' (' + timeAgo(old_timestamp) + ')';
        this.client.connection.fetchSnapshotByTimestamp(this.id[0], this.id[1], new_timestamp, this.fetchOld);
    }

    public addVersion = (timestamp: number, title: string): void => {
        this.version_timestamp = timestamp;
        this.version_title = 'Notebook snapshot-' + timestamp.toString() + ' (' + timeAgo(timestamp) + ')';
        this.client.connection.fetchSnapshotByTimestamp(this.id[0], this.id[1], timestamp, this.createVersionWidget);
    }

    private fetchOld = (err, snapshot): void => {
        this.new_notebook = snapshot.data.notebook;
        this.client.connection.fetchSnapshotByTimestamp(this.id[0], this.id[1], this.old_timestamp, this.createDiffWidget);
    }

    private createDiffWidget = (err, snapshot): void => {
        this.old_notebook = snapshot.data.notebook;
        const diffWidget = new DiffWidget('diff', [this.new_notebook, this.old_notebook], this.diff_title, [this.new_timestamp, this.old_timestamp]);
        this.diffList.push(diffWidget);
    }

    private createVersionWidget = (err, snapshot): void => {
        this.version_notebook = snapshot.data.notebook;
        const versionWidget = new DiffWidget('version', [this.version_notebook], this.version_title, [this.version_timestamp]);
        this.diffList.push(versionWidget);
    }

    private closeTabHandler = (e): void => {
        const label = e.currentTarget.getAttribute('label');
        const related_eles = document.querySelectorAll('.'+ label);
        related_eles.forEach(ele=> {
            ele.parentNode.removeChild(ele);
        });
        const tab_list = document.querySelectorAll('.diff-tab');
        const last_tab = tab_list[tab_list.length-1];
        this.activeTab(last_tab as HTMLElement);
        e.stopPropagation();
    }

    private activeTabHandler = (e): void => {
        const label = e.currentTarget.getAttribute('label');
        this.chatCallback(label);
        this.activeTab(e.currentTarget);
    }

    private activeTab = (ele: HTMLElement): void => {
        const active_tab = document.querySelector('.tab-active');
        if(active_tab) active_tab.classList.remove('tab-active');
        ele.classList.add('tab-active');

        const label = ele.getAttribute('label');

        // show the related diff widget
        const diffWidgets = document.querySelectorAll('.diffwidget-container');
        diffWidgets.forEach(widget => {
            if(widget.classList.contains(label)) widget.setAttribute('style', 'display: block');
            else widget.setAttribute('style', 'display:none');
        });

        // show or hide current notebook
        const notebook_widget = document.querySelector('#notebook-container');
        if(label === 'version-current') {
            notebook_widget.setAttribute('style', 'display:block');
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
        const main_container = document.querySelector('#notebook');
        main_container.insertBefore(this.container, main_container.firstChild);
    }

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '#difftab-container { height: 30px; } \n';
        sheet.innerHTML += '.diff-tab { cursor: pointer; display: inline-block; color:#ccc; border: solid 1px #dedede; font-size: 12px; min-width: 150px; height: 100%; background: white; text-align: center; font-weight: bold; padding: 5px 0; border-radius: 10px 10px 0 0; } \n';
        sheet.innerHTML += '.diff-tab i {margin-right: 5px; margin-left: 5px; font-weight: bold;} \n';
        sheet.innerHTML += '.tab-active {color: black !important;} \n';
        sheet.innerHTML += '.close-tab { font-size: 12px; margin-left: 20px;}\n';
        document.body.appendChild(sheet);
    }
}