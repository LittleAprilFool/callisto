import { Changelog, IChangelogWidget, IDiffTabWidget } from 'types';

const Jupyter = require('base/js/namespace');

const checkOpType = (op): string => {
    if (op.p.length === 1 && typeof op.p[0] === 'number' && op.li) return 'NewLog';   
    return 'Else';
};

export class ChangelogWidget implements IChangelogWidget {
    private container: HTMLElement;
    private logContainer: HTMLElement;
    private isFold: boolean = true;

    constructor(private doc: any, private tabWidget: IDiffTabWidget) {
        this.initContainer();
        this.initStyle();
        setTimeout(this.loadHistory, 300);
        
        this.doc.subscribe(this.onSDBDocEvent);
    }

    public destroy = (): void => {
        this.container.parentNode.removeChild(this.container);
        this.doc.unsubscribe(this.onSDBDocEvent);
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

        this.tabWidget.diffThumb(new_timestamp, old_timestamp).then(data => {
            if(!data[0]) return;
            const option = {
                fromfile: 'Original',
                tofile: 'Current',
                fromfiledate: '2005-01-26 23:30:50',
                tofiledate: '2010-04-02 10:20:52'
            };
      
            const diff_content = window['difflib'].unifiedDiff(data[1].split('\n'), data[0].split('\n'), option);
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
            const id = 'log-thumbnail-' + index.toString();
            diff_El.id = id;
            diff_El.classList.add('log-thumbnail');
            container.appendChild(diff_El);
    
            const diff2htmlUi = new window['Diff2HtmlUI']({diff: diff_test_string});
            diff2htmlUi.draw('#'+id, {inputFormat: 'diff', showFiles: false, matching: 'lines', outputFormat: 'line-by-line'});
            diff2htmlUi.highlightCode('#'+id);
        });
    }

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '#changelog-container { height: calc(100% - 110px); width: 300px; margin-right: 50px; position: fixed; bottom: 0px; left: -300px; z-index:100; border-top: 1px solid #e2e2e2; border-right:1px solid #e2e2e2; background: white;  transition: left .5s; } \n';
        // sheet.innerHTML += '.left-toolbox { height: 100%; width: 400px; position: fixed; bottom: 0px; background: white; border-right: 1px solid #ddd;}\n';
        sheet.innerHTML += '#changelog-trigger { height: 60px; width: 50px; font-size: 20px; text-align: center; color: #516766; font-weight: bold; position: relative; padding-top: 16px; bottom: -200px; left: 300px; z-index:2; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); background: #9dc5a7; border-radius: 0px 10px 10px 0px;} \n';
        sheet.innerHTML += '#log-container { position: relative; top: -40px; padding-left:10px; padding-right:10px; height: calc(100% - 40px); overflow: scroll;}\n';
        sheet.innerHTML += '.log-thumbnail > .d2h-wrapper > .d2h-file-wrapper > .d2h-file-header {display: none}\n';
        sheet.innerHTML += '.log-thumbnail > .d2h-wrapper > .d2h-file-wrapper > .d2h-file-diff > .d2h-code-wrapper > .d2h-diff-table {font-size: 12px; }\n';
        sheet.innerHTML += '.log-thumbnail > .d2h-wrapper > .d2h-file-wrapper > .d2h-file-diff > .d2h-code-wrapper > .d2h-diff-table > .d2h-diff-tbody > tr > .d2h-code-linenumber {display: none !important;}\n';
        sheet.innerHTML += '.log-thumbnail > .d2h-wrapper > .d2h-file-wrapper > .d2h-file-diff > .d2h-code-wrapper > .d2h-diff-table > .d2h-diff-tbody > tr > td > .d2h-code-line {padding: 0 1em}\n';
        sheet.innerHTML += '.log-item {cursor: pointer}\n';
        sheet.innerHTML += '.log-item:hover {color: red} \n';
        sheet.innerHTML += '.log-item.disable {color: #ccc; cursor: default;} \n';
        sheet.innerHTML += '.log-item.disable:hover {color: #ccc} \n';
        document.body.appendChild(sheet);
    }

    private loadHistory = (): void => {
        const history = this.doc.getData();
        history.forEach((log, index)=> {
            this.createNewLog(log, index, this.logContainer);
            // this.logContainer.appendChild(newLogEL);
        });
    }

    private createNewLog = (log: Changelog, index: number, container): void => {
        const logEL = document.createElement('div');
        logEL.classList.add('log-item');
        if(log.event==='join') logEL.classList.add('disable');
        logEL.innerHTML = log.user.username + ' ' + log.eventName + ' '+ log.time;
        logEL.setAttribute('timestamp', log.timestamp.toString());
        logEL.setAttribute('username', log.user.username);
        logEL.setAttribute('event', log.event);
        container.appendChild(logEL);
        if (['edit', 'delete', 'insert'].includes(log.event)) logEL.addEventListener('click', this.displayChanges);
        if (['edit'].includes(log.event)) this.createThumbnail(logEL, log, index);
    }

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            ops.forEach(op => this.applyOp(op));
        }
    }

    private displayChanges = (e): void => {
        const new_timestamp = parseInt(e.currentTarget.getAttribute('timestamp'), 0);
        const old_timestamp = parseInt(e.currentTarget.previousSibling.getAttribute('timestamp'), 0);

        const label = 'diff-'+new_timestamp.toString() + '-'+old_timestamp.toString();
        if(this.tabWidget.checkTab(label)) return;
        if(e.target.previousSibling==null) return;
        const title = e.target.innerHTML;

        this.tabWidget.addTab(label, 'diff', new_timestamp);
        this.tabWidget.addDiff(new_timestamp, old_timestamp, title);
    }

    private applyOp = (op): void => {
        if(checkOpType(op) === 'NewLog') {
            this.createNewLog(op.li, op.p[0], this.logContainer);
        }
    }
}