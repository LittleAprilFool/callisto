import { IFilterWidget } from "types";
import { getSafeIndex } from '../action/notebookAction';

const Jupyter = require('base/js/namespace');


export class FilterWidget implements IFilterWidget {
    public isFilter: boolean = false;
    private container: HTMLElement;
    private changelogCallback: any;
    private chatCallback: any;

    constructor() {
        this.initContainer();
        this.initStyle();
    }
    public destroy = (): void => {
        this.container.parentNode.removeChild(this.container);
    }

    public reload = (): void => {
        if((window as any).study_condition === 'experiment') {
            this.initContainer();
        }
        else {
            this.destroy();
        }
    }

    public bindChangelogCallback = (callback): void => {
        this.changelogCallback = callback;
    }

    public bindChatCallback = (callback): void => {
        this.chatCallback = callback;
    }

    private handleFiltering = (e): void => {
        this.isFilter = !this.isFilter;

        const cellEl_list = document.querySelectorAll('.cell');

        cellEl_list.forEach(cell_el => {
            if (cell_el.classList.contains('filtermode')) cell_el.classList.remove('filtermode');
        });

        if(this.isFilter) {
            this.container.classList.add('active');
            const cell = Jupyter.notebook.get_selected_cell();
            const id = getSafeIndex(cell);
            const cellEl_select = cellEl_list[id];
            cellEl_select.classList.add('filtermode');
        }
        else {
            this.container.classList.remove('active');
        }
        this.changelogCallback(this.isFilter);
        this.chatCallback(this.isFilter);
    }

    private initContainer = (): void => {
        this.container = document.createElement('div');
        this.container.classList.add('filter-container');
        this.container.classList.add('btn-group');

        const tool_filter = document.createElement('button');
        tool_filter.id = 'tool-filter';
        tool_filter.classList.add('btn-default');
        const filter_icon = document.createElement('i');
        filter_icon.innerHTML =  '<i class="fa fa-filter">';
        tool_filter.appendChild(filter_icon);
        const filter_title = document.createElement('span');
        filter_title.innerText = 'Filter';
        tool_filter.appendChild(filter_title);
        tool_filter.addEventListener('click', this.handleFiltering);
        this.container.appendChild(tool_filter);

        const main_container = document.querySelector('#maintoolbar-container');
        main_container.appendChild(this.container);
    }

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '.filter-container.active > #tool-filter {background: #fff6dc; color: #b18506; border-color:#dcca98 }\n';
        sheet.innerHTML += '#tool-filter {outline:none;padding: 2px 8px;border-radius: 2px; }\n';
        sheet.innerHTML += '#tool-filter > span {margin-left: 6px;}\n';
        document.body.appendChild(sheet);
    }
}