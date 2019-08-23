import { Changelog, IChangelogWidget, IDiffTabWidget } from 'types';
import { NotebookBinding } from './notebookBinding';

const Jupyter = require('base/js/namespace');

const checkOpType = (op): string => {
    if (op.p.length === 1 && typeof op.p[0] === 'number' && op.li) return 'NewLog';   
    return 'Else';
};

export class ChangelogWidget implements IChangelogWidget {
    private container: HTMLElement;
    private logContainer: HTMLElement;
    private isFold: boolean = true;
    private isFilter: boolean = false;

    constructor(private doc: any, private tabWidget: IDiffTabWidget, private notebook: NotebookBinding) {
        this.initContainer();
        this.initStyle();
        setTimeout(this.loadHistory, 300);
        
        this.doc.subscribe(this.onSDBDocEvent);
    }

    public destroy = (): void => {
        this.container.parentNode.removeChild(this.container);
        this.doc.unsubscribe(this.onSDBDocEvent);
    }

    public reload = (): void => {
        if((window as any).study_condition === 'experiment') {
            this.initContainer();
            setTimeout(this.loadHistory, 300);
            this.doc.subscribe(this.onSDBDocEvent);
        }
        else {
            this.container.parentNode.removeChild(this.container);
            this.doc.unsubscribe(this.onSDBDocEvent);
        }
    }

    public scrollTo = (timestamp?: number, timestamp1?: number): void => {
        if(this.isFilter) return;
        let flag = false;
        if(!timestamp && !timestamp1) {
            this.logContainer.childNodes.forEach(node => {
                const node_el = node as HTMLElement;
                if (node_el.classList.contains('highlight')) node_el.classList.remove('highlight');
            });
        }
        if(timestamp && !timestamp1) {
            this.logContainer.childNodes.forEach(node => {
                const node_el = node as HTMLElement;
                if (node_el.classList.contains('highlight')) node_el.classList.remove('highlight');
                const ts_str = node_el.getAttribute('timestamp');
                const ts = parseInt(ts_str, 0);
                if (ts >= timestamp) {
                    node_el.classList.add('highlight');
                    if (!flag) {
                        node_el.scrollIntoView();
                        flag = true;
                    }
                }
            });
        }
        if(timestamp && timestamp1) {
            this.logContainer.childNodes.forEach(node => {
                const node_el = node as HTMLElement;
                if (node_el.classList.contains('highlight')) node_el.classList.remove('highlight');
                const ts_str = node_el.getAttribute('timestamp');
                const ts = parseInt(ts_str, 0);
                if (ts >= timestamp && ts <= timestamp1) {
                    node_el.classList.add('highlight');
                    if (!flag) {
                        node_el.scrollIntoView();
                        flag = true;
                    }
                }
            });
        }
    }

    public onSelectCell = (cell): void => {
        if ((window as any).study_condition === 'control') return;
        if (this.isFilter) return;

        this.cleanHighlight(false);
        this.addHighlight();

    }

    public toggleFilter = (flag: boolean): void => {

        const log_thumbnail = document.querySelectorAll('.log-thumbnail');
        const log_item = document.querySelectorAll('.log-item');
        const changelog_container = document.querySelector('#changelog-container') as HTMLElement;
        const changelog_trigger = document.querySelector('#changelog-trigger') as HTMLElement;
    
        this.isFilter = flag;

        if(!this.isFilter) {
            log_item.forEach(item => {
                const i = item as HTMLElement;
                i.style.display = 'block';
                if(i.classList.contains('highlight')) i.classList.remove('highlight');
            });

            // disable highlight
            log_thumbnail.forEach(item => {
                const i = item as HTMLElement;
                i.style.display = 'block';
            });

            changelog_container.classList.remove('filtermode');
            changelog_trigger.classList.remove('filtermode');

            const old_message = document.querySelector('#nolog');
            if(old_message) old_message.parentElement.removeChild(old_message);
            this.addHighlight();
        }
        else {
            changelog_trigger.classList.add('filtermode');
            changelog_container.classList.add('filtermode');
            const cell = Jupyter.notebook.get_selected_cell();
            if(cell) this.onFilter(cell);
        }
    }

    public onFilter = (cell?): void => {
        this.addHighlight();
    }

    private addHighlight = (): void => {
        const cell = Jupyter.notebook.get_selected_cell();
        const uid = cell.uid;
        const log_thumbnail = document.querySelectorAll('.log-thumbnail');
        const log_item = document.querySelectorAll('.log-item');
        const changelog_container = document.querySelector('#changelog-container') as HTMLElement;
        const old_message = document.querySelector('#nolog');
        if(old_message) old_message.parentElement.removeChild(old_message);
        
        if(this.isFilter) {
            let flag = false;

            log_item.forEach(item => {
                const i = item as HTMLElement;
                i.style.display = 'none';
                if(i.classList.contains('highlight')) i.classList.remove('highlight');
            });
            log_thumbnail.forEach(item => {
                const i = item as HTMLElement;
                i.style.display = 'none';
                // if (i.classList.contains('highlight')) i.classList.remove('highlight');
                if (i.getAttribute('cell-uid') === uid) {
                    // i.classList.add('highlight');
                    i.style.display = 'block';
                    i.parentElement.style.display = 'block';
                    i.parentElement.classList.add('highlight');
                    flag = true;
                }
            });
            changelog_container.classList.add('filtermode');
            if(!flag) {
                const message = document.createElement('div');
                message.innerText = 'No relevant changelog items';
                message.id = 'nolog';
                const log_container = document.querySelector('#log-container');
                log_container.appendChild(message);
            }
        }
        else {
            log_thumbnail.forEach(item => {
                const i = item as HTMLElement;
                if (i.getAttribute('cell-uid') === uid) {
                    i.parentElement.classList.add('highlight');
                }
            });
        }
    }

    private cleanHighlight = (flag: boolean): void => {
        const log_item = document.querySelectorAll('.log-item');
        log_item.forEach(item => {
            const i = item as HTMLElement;
            if(i.classList.contains('highlight')) i.classList.remove('highlight');
        });
        if(flag) {
            const messageEl_list = document.querySelectorAll('.message-content');

            messageEl_list.forEach(messageEl => {
                messageEl.classList.remove('highlight');
            });
        }
    }

    private initContainer = (): void => {
        this.container = document.createElement('div');
        // this.container.classList.add('left-toolbox');
        this.container.id = 'changelog-container';
        const trigger = document.createElement('div');
        trigger.id = 'changelog-trigger';
        const icon = document.createElement('i');
        icon.innerHTML = '<i class="fa fa-history"></i>';
        trigger.appendChild(icon);
        trigger.addEventListener('click', this.handleFolding);

        this.logContainer = document.createElement('div');
        this.logContainer.id = 'log-container';

        this.container.appendChild(trigger);
        this.container.appendChild(this.logContainer);

        const main_container = document.querySelector('#notebook_panel');
        main_container.appendChild(this.container);
    }

    private handleFolding = (): void => {
        this.isFold = !this.isFold;
        this.container.style.left = this.isFold? '-300px': '0px';
    }

    private createThumbnail = (container, log, index): void => {
        const new_timestamp = parseInt(container.getAttribute('timestamp'), 0);
        if(!container.previousSibling) return;
        const old_timestamp = parseInt(container.previousSibling.getAttribute('timestamp'), 0);

        this.tabWidget.diffThumb(new_timestamp, old_timestamp).then(data_list => {

            const option = {
                fromfile: 'Original',
                tofile: 'Current',
                fromfiledate: '2005-01-26 23:30:50',
                tofiledate: '2010-04-02 10:20:52'
            };

            data_list.forEach((data, data_index) => {
                const diff_content = window['difflib'].unifiedDiff(data['old'].split('\n'), data['new'].split('\n'), option);
                let diff_test_string = '';
                diff_content.forEach(diff=> {
                    if(diff.endsWith('\n')) {
                        diff_test_string+=diff;
                    }
                    else {
                        diff_test_string= diff_test_string + diff + '\n'; 
                    }
                });
        
                const diff_El = document.createElement('div');
                const id = 'log-thumbnail-' + index.toString() + '-' + data_index.toString();
                diff_El.id = id;
                diff_El.classList.add('log-thumbnail');
                diff_El.setAttribute('cell-uid', data['uid']);
                container.appendChild(diff_El);
        
                const diff2htmlUi = new window['Diff2HtmlUI']({diff: diff_test_string});
                diff2htmlUi.draw('#'+id, {inputFormat: 'diff', showFiles: false, matching: 'lines', outputFormat: 'line-by-line'});
                diff2htmlUi.highlightCode('#'+id);
            });
        });
    }

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '#changelog-container { height: calc(100% - 110px); width: 300px; margin-right: 50px; position: fixed; bottom: 0px; left: -300px; z-index:100; border-top: 1px solid #e2e2e2; border-right:1px solid #e2e2e2; background: white;  transition: left .5s; } \n';
        // sheet.innerHTML += '.left-toolbox { height: 100%; width: 400px; position: fixed; bottom: 0px; background: white; border-right: 1px solid #ddd;}\n';
        sheet.innerHTML += '#changelog-trigger { height: 60px; width: 50px; font-size: 20px; text-align: center; color: #516766; font-weight: bold; position: relative; padding-top: 16px; bottom: -200px; left: 300px; z-index:2; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); background: #9dc5a7; border-radius: 0px 10px 10px 0px;} \n';
        sheet.innerHTML += '#changelog-trigger.filtermode { color: #a78628; background-color: #f9da83}\n';
        sheet.innerHTML += '#changelog-container.filtermode > #log-container > .highlight {background-color: #fff6dc}\n';
        sheet.innerHTML += '#log-container { position: relative; top: -40px; padding-left:10px; padding-right:10px; height: calc(100% - 40px); overflow: scroll;}\n';
        sheet.innerHTML += '.log-thumbnail > .d2h-wrapper > .d2h-file-wrapper > .d2h-file-header {display: none}\n';
        sheet.innerHTML += '.log-thumbnail > .d2h-wrapper > .d2h-file-wrapper > .d2h-file-diff > .d2h-code-wrapper > .d2h-diff-table {font-size: 12px; }\n';
        sheet.innerHTML += '.log-thumbnail > .d2h-wrapper > .d2h-file-wrapper > .d2h-file-diff > .d2h-code-wrapper > .d2h-diff-table > .d2h-diff-tbody > tr > .d2h-code-linenumber {display: none !important;}\n';
        sheet.innerHTML += '.log-thumbnail > .d2h-wrapper > .d2h-file-wrapper > .d2h-file-diff > .d2h-code-wrapper > .d2h-diff-table > .d2h-diff-tbody > tr > td > .d2h-code-line {padding: 0 1em}\n';
        sheet.innerHTML += '.log-thumbnail > .d2h-wrapper > .d2h-file-wrapper > .d2h-file-diff {overflow:hidden;}\n';
        sheet.innerHTML += '.log-thumbnail {margin-top: 5px}\n';
        sheet.innerHTML += '.log-item {color:#888; font-size:12px; background: #fbfbfb; padding: 5px 10px; cursor: pointer; margin: 10px 0px;}\n';
        sheet.innerHTML += '.log-item:hover {background: #f5f5f5} \n';
        sheet.innerHTML += '.log-item.disable {color: #ccc; cursor: default; background: none; text-align: center; margin:0px 0px; padding: 2px 0px;} \n';
        sheet.innerHTML += '.log-item.disable:hover {background: none;} \n';
        sheet.innerHTML += '.log-item.highlight {background: #e7f1e9;} \n';
        sheet.innerHTML += '#changelog-container.filtermode::before {content: "Filter Mode"; display: block; font-weight: bold; color: #bbb; padding-top: 5px; text-align: center;}\n';
        sheet.innerHTML += '.log-user-name {font-size: 10px; font-weight: bold; display: inline-block}\n';
        sheet.innerHTML += '.log-time {font-size: 10px; display:inline-block; float: right; color: #ccc}\n';
        sheet.innerHTML += '#nolog {text-align: center; font-size: 12px; color:#b7b7b7}\n';
        document.body.appendChild(sheet);
    }

    private loadHistory = (): void => {
        const history = this.doc.getData();
        history.forEach((log, index)=> {
            this.createNewLog(log, index, this.logContainer);
        });

        // issue: this is not working
        const last = this.logContainer.lastChild as HTMLElement;
        if(last) last.scrollIntoView();
    }

    private createNewLog = (log: Changelog, index: number, container): void => {
        if (log.event === 'join') {
            if (index === 0) {
                const open_channel_log_el = document.createElement('div');
                open_channel_log_el.classList.add('log-item');
                container.appendChild(open_channel_log_el);
                open_channel_log_el.setAttribute('timestamp', log.timestamp.toString());
                open_channel_log_el.classList.add('disable');
                const message = document.createElement('div');
                message.classList.add('log-disable-message');
                message.innerText = 'The channel is opened';
                open_channel_log_el.appendChild(message);
            }
            return;
        }

        if (log.event === 'leave') {
            // to be compatible with data generated in previous versions.
            return;
        }
        const logEL = document.createElement('div');
        logEL.classList.add('log-item');
        container.appendChild(logEL);

        // container.appendChild(logEL);
        logEL.setAttribute('timestamp', log.timestamp.toString());
        logEL.setAttribute('username', log.user.username);
        logEL.setAttribute('event', log.event);
        // if(log.event === 'join' || log.event === 'leave') {
        //     logEL.classList.add('disable');
        //     const message = document.createElement('div');
        //     message.classList.add('log-disable-message');
        //     message.innerText = log.user.username + ' ' + log.eventName + ' ' + log.time;
        //     logEL.appendChild(message);
        //     return;
        // }
        logEL.style.borderLeft = "5px solid " + log.user.color;
        const username = document.createElement('div');
        username.innerText = log.user.username;
        username.classList.add('log-user-name');
        username.style.color = log.user.color;
        const eventname = document.createElement('div');
        eventname.innerText = log.eventName;
        eventname.classList.add('log-event-name');
        const time = document.createElement('div');
        time.innerText = log.time;
        time.classList.add('log-time');
        logEL.appendChild(username);
        logEL.appendChild(time);
        logEL.appendChild(eventname);
        logEL.addEventListener('click', this.displayChanges);
        if (['edit'].includes(log.event)) this.createThumbnail(logEL, log, index);
    }

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            ops.forEach(op => this.applyOp(op));
        }
    }

    private displayChanges = (e): void => {
        if(e.currentTarget.previousSibling==null) return;
        const new_timestamp = parseInt(e.currentTarget.getAttribute('timestamp'), 0);
        const old_timestamp = parseInt(e.currentTarget.previousSibling.getAttribute('timestamp'), 0);

        const label = 'diff-'+new_timestamp.toString() + '-'+old_timestamp.toString();
        if(this.tabWidget.checkTab(label)) return;
        
        const title = e.currentTarget.innerHTML;
        const logEl = e.currentTarget;

        const highlightMessage = () => {
            this.cleanHighlight(true);
            logEl.classList.add('highlight');
        };

        const unhighlightMessage = () => {
            logEl.classList.remove('highlight');
        };

        this.tabWidget.addTab(label, 'diff', new_timestamp);
        this.tabWidget.addDiff(new_timestamp, old_timestamp, title, {highlightMessage, unhighlightMessage});

        // send log
        const log = {
            'log_type': 'open_diff',
            'source': 'changelog',
            'new_timestamp': new_timestamp,
            'old_timestamp': old_timestamp
        };
        this.notebook.sendLog(log);
    }

    private applyOp = (op): void => {
        if(checkOpType(op) === 'NewLog') {
            this.createNewLog(op.li, op.p[0], this.logContainer);
        }
    }
}