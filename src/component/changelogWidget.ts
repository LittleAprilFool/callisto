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
        this.loadHistory();
        
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

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '#changelog-container { height: calc(100% - 110px); width: 300px; margin-right: 50px; position: fixed; bottom: 0px; left: -300px; z-index:100; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); background: white;  transition: left .5s; } \n';
        // sheet.innerHTML += '.left-toolbox { height: 100%; width: 400px; position: fixed; bottom: 0px; background: white; border-right: 1px solid #ddd;}\n';
        sheet.innerHTML += '#changelog-trigger { height: 60px; width: 50px; font-size: 20px; text-align: center; color: #516766; font-weight: bold; position: relative; padding-top: 16px; bottom: -200px; left: 300px; z-index:2; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); background: #9dc5a7; border-radius: 0px 10px 10px 0px;} \n';
        sheet.innerHTML += '#log-container { position: relative; top: -50px; padding-left:20px; height: 100%; overflow: scroll;}';
        sheet.innerHTML += '.log-item {cursor: pointer}';
        sheet.innerHTML += '.log-item:hover {color: red} \n';
        sheet.innerHTML += '.log-item.disable {color: #ccc; cursor: default;} \n';
        sheet.innerHTML += '.log-item.disable:hover {color: #ccc} \n';
        document.body.appendChild(sheet);
    }

    private loadHistory = (): void => {
        const history = this.doc.getData();
        history.forEach(log=> {
            const newLogEL = this.createNewLog(log);
            this.logContainer.appendChild(newLogEL);
        });
    }

    private createNewLog = (log: Changelog): HTMLElement => {
        const logEL = document.createElement('div');
        logEL.classList.add('log-item');
        if(log.event==='join') logEL.classList.add('disable');
        logEL.innerHTML = log.user.username + ' ' + log.eventName + ' '+ log.time;
        logEL.setAttribute('timestamp', log.timestamp.toString());
        logEL.setAttribute('username', log.user.username);
        logEL.setAttribute('event', log.event);
        if (['edit', 'delete', 'insert'].includes(log.event)) logEL.addEventListener('click', this.displayChanges);
        return logEL;
    }

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            ops.forEach(op => this.applyOp(op));
        }
    }

    private displayChanges = (e): void => {
        const new_timestamp = parseInt(e.target.getAttribute('timestamp'), 0);
        const old_timestamp = parseInt(e.target.previousSibling.getAttribute('timestamp'), 0);

        const label = 'diff-'+new_timestamp.toString() + '-'+old_timestamp.toString();
        if(this.tabWidget.checkTab(label)) return;
        if(e.target.previousSibling==null) return;
        const title = e.target.innerHTML;

        this.tabWidget.addTab(label, 'diff', new_timestamp);
        this.tabWidget.addDiff(new_timestamp, old_timestamp, title);
    }

    private applyOp = (op): void => {
        if(checkOpType(op) === 'NewLog') {
            const newLogEL = this.createNewLog(op.li);
            this.logContainer.appendChild(newLogEL);
        }
    }
}