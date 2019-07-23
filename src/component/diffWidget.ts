import { IDiffWidget, Notebook, Cell } from "types";

export class DiffWidget implements IDiffWidget {
    private container: HTMLElement;
    
    constructor(private type: string, private notebook: Notebook[], private title: string, private timestamp: number[]) {
        this.initContainer();
        this.initStyle();

        this.displayDiff();
    }

    public destroy = (): void => {
        this.container.parentNode.removeChild(this.container);
    }

    private displayDiff = (): void => {
        if(this.type === 'version') {
            this.notebook[0].cells.forEach(cell=> {
                this.addCell(cell);
            });
        }
        else {
            const new_notebook = this.notebook[0];
            const old_notebook = this.notebook[1];
            let oindex = 0;
            let nindex = 0;
            const olength = old_notebook.cells.length;
            const nlength = new_notebook.cells.length;
            const ncells = new_notebook.cells;
            const ocells = old_notebook.cells;

            while((nindex<nlength) && (oindex<olength)) {
                if(ncells[nindex].source === ocells[oindex].source) {
                    this.addCell(ncells[nindex]);
                    oindex ++;
                    nindex ++;
                    continue;
                }

                // delete cell
                if(ncells[nindex].source === ocells[oindex+1].source) {
                    this.addDiffCell(null, ocells[oindex]);
                    oindex ++;
                    continue;
                }

                // add cell 
                if (ncells[nindex+1].source === ocells[oindex].source) {
                    this.addDiffCell(ncells[nindex], null);
                    nindex ++;
                    continue;
                }

                // edit cell
                this.addDiffCell(ncells[nindex], ocells[oindex]);
                oindex ++;  
                nindex ++;
                continue;  
            }

            while(nindex < nlength) {
                this.addDiffCell(ncells[nindex], null);
                nindex ++;
            }
            while(oindex < olength) {
                this.addDiffCell(ocells[oindex], null);
                oindex ++;
            }
        }
    }

    private addDiffCell = (new_cell: Cell, old_cell: Cell): void => {
        const diff_container = document.createElement('div');
        diff_container.classList.add('diff-cell-container');
        this.container.appendChild(diff_container);

        const new_cell_container = document.createElement('div');
        new_cell_container.classList.add('cell', 'diff','diff-new');
        const old_cell_container = document.createElement('div');
        old_cell_container.classList.add('cell', 'diff','diff-old');
        diff_container.appendChild(new_cell_container);
        diff_container.appendChild(old_cell_container);

        this.createCellUnit(new_cell, new_cell_container);
        this.createCellUnit(old_cell, old_cell_container);
    }

    private addCell = (cell: Cell): void => {
        const cell_container = document.createElement('div');
        cell_container.classList.add('cell');
        this.container.appendChild(cell_container);

        this.createCellUnit(cell, cell_container);
    }

    private createCellUnit = (cell: Cell, cell_container: HTMLElement): void => {
        const input_container = document.createElement('div');
        input_container.classList.add('input');
        if(cell==null) {
            cell_container.appendChild(input_container);
            return;
        }
        
        const prompt_container = document.createElement('div');
        prompt_container.classList.add('prompt_container');
        const input_prompt = document.createElement('div');
        input_prompt.classList.add('prompt', 'input_prompt');
        input_prompt.innerHTML = cell.execution_count==null? '<bdi>In</bdi>&nbsp;[ ]:': '<bdi>In</bdi>&nbsp;['+cell.execution_count + ']:';
        prompt_container.appendChild(input_prompt);
        input_container.appendChild(prompt_container);

        const inner_cell = document.createElement('div');
        inner_cell.classList.add('inner_cell');
        const input_area = document.createElement('div');
        input_area.classList.add('input_area');
        inner_cell.appendChild(input_area);
        input_container.appendChild(inner_cell);
        
        cell_container.appendChild(input_container);

        const code_cell = (window as any).CodeMirror(input_area, {
            value: cell ==null? '': cell.source,
            mode:  'python',
            lineNumbers: true,
            readOnly: true,
            showCursorWhenSelecting: false,
            theme: 'ipython'
        });

        // add output to the cell
        const output_wrapper = document.createElement('div');
        output_wrapper.classList.add('output_wrapper');
        cell.outputs.forEach(output => {
            const outputEl = document.createElement('div');
            outputEl.classList.add('output');
            const output_area = document.createElement('div');
            output_area.classList.add('output_area');
            const output_prompt = document.createElement('div');
            output_prompt.classList.add('prompt');
            output_area.appendChild(output_prompt);
            const output_subarea = document.createElement('div');
            output_subarea.classList.add('output_subarea');
            output_area.appendChild(output_subarea);
            switch(output.output_type) {
                case 'display_data':
                    output_subarea.classList.add('output_png');
                    const img = document.createElement('img');
                    img.setAttribute('src', 'data:image/png;base64,'+output.data['image/png']);
                    output_subarea.appendChild(img);
                    break;
                case 'stream':
                    output_subarea.classList.add('output_stream', 'output_text', 'output_stdout');
                    const pre = document.createElement('pre');
                    pre.innerText = output.text;
                    output_subarea.appendChild(pre);
                    break;
                default:
                    break;
            }
            outputEl.appendChild(output_area);
            output_wrapper.appendChild(outputEl);
        });

        cell_container.appendChild(output_wrapper);
    }

    private initContainer = (): void => {
        this.container = document.createElement('div');
        const label = this.type === 'diff'? 'diff-'+this.timestamp[0]+'-'+this.timestamp[1]:'version-'+this.timestamp[0];  
        this.container.classList.add('container', 'diffwidget-container', label);
        const trigger = document.createElement('div');
        trigger.classList.add('diffwidget-trigger');

        const title = document.createElement('span');
        title.innerText = this.title;
        trigger.appendChild(title);

        if(this.type === 'diff') {
            const label_container = document.createElement('div');
            label_container.id='label-container';
            const label_new = document.createElement('div');
            label_new.innerText = 'New';
            label_new.classList.add('version-label');
            label_new.id = 'label-new';
            const label_old = document.createElement('div');
            label_old.innerText = 'Old';
            label_old.classList.add('version-label');
            label_old.id = 'label-old';
            label_container.appendChild(label_new);
            label_container.appendChild(label_old);
            trigger.appendChild(label_container);
        }

        this.container.appendChild(trigger);
        const main_container = document.querySelector('#notebook');
        main_container.insertBefore(this.container, main_container.firstChild.nextSibling);
    }

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '.diffwidget-container { padding: 15px; background-color: #f7f7f7; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); margin-bottom: 20px } \n';
        sheet.innerHTML += '.diffwidget-trigger { font-size: 15px; text-align: center; position: relative; font-weight: bold;} \n';
        sheet.innerHTML += '.version-label { font-size: 12px; text-align: center; display: inline-block; width: 50%; font-weight: bold;} \n';
        sheet.innerHTML += '#label-new { background:rgba(0, 200, 20, 0.3); } \n';
        sheet.innerHTML += '#label-old { background:rgba(255, 20, 0, 0.3); } \n';
        sheet.innerHTML += '#label-container {margin-top: 10px; margin-bottom: 10px;} \n';
        sheet.innerHTML += '.diff-cell-container {background: #fff6dc; overflow:auto;} \n';
        sheet.innerHTML += '.diff { background: inherit; width: 50% !important; display: inline-block !important; float:left;} \n';
        sheet.innerHTML += '.diff-new .input_area {background: rgba(0, 200, 20, 0.1); }\n';
        sheet.innerHTML += '.diff-old .input_area {background: rgba(255, 20, 0, 0.1); }\n';
        document.body.appendChild(sheet);
    }
}