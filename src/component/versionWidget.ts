export class VersionWidget {
    private container: HTMLElement;
    
    constructor(private notebook: Notebook, private title: string, private timestamp: number) {
        this.initContainer();
        this.initStyle();

        this.displayVersion();
    }

    public destroy = (): void => {
        this.container.parentNode.removeChild(this.container);
    }

    private displayVersion = (): void => {
        this.notebook.cells.forEach(cell=>{
            this.addCell(cell)
        });
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
        this.container.classList.add('container', 'diffwidget-container', 'version-' + this.timestamp.toString());
        const trigger = document.createElement('div');
        trigger.classList.add('diffwidget-trigger');

        const title = document.createElement('span');
        title.innerText = this.title;
        trigger.appendChild(title);

        this.container.appendChild(trigger);
        const main_container = document.querySelector('#notebook');
        main_container.insertBefore(this.container, main_container.firstChild.nextSibling);
    }

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '.diffwidget-container { padding: 15px; background-color: white; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); margin-bottom: 20px } \n';
        sheet.innerHTML += '.diffwidget-trigger { font-size: 15px; text-align: center; position: relative; font-weight: bold;} \n';
        sheet.innerHTML += '.version-label { font-size: 12px; text-align: center; display: inline-block; width: 50%; font-weight: bold;} \n';
        sheet.innerHTML += '#label-container {margin-top: 10px; margin-bottom: 10px;} \n';
        sheet.innerHTML += '.diff-cell-container {background: #fff8de4f; overflow:auto;} \n';
        sheet.innerHTML += '.diff { background: inherit; width: 50% !important; display: inline-block !important; float:left;} \n';
        document.body.appendChild(sheet);
    }
}