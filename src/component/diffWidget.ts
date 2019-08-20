import { Cell, IDiffWidget, Notebook } from "types";
import * as resemble from "../external/resemble";

export class DiffWidget implements IDiffWidget {
    public container: HTMLElement;
    public label: string;
    
    constructor(private type: string, private notebook: Notebook[], private title: string, private timestamp: number[], private message?: any, private ref?: any) {
        this.initContainer();
        this.initStyle();

        this.displayDiff();
        this.show();
    }

    public destroy = (): void => {
        if(this.message) this.message.unhighlightMessage();
        this.container.parentNode.removeChild(this.container);
    }

    public show = (): void => {
        this.container.setAttribute('style', 'display: block');
        if(this.message) this.message.highlightMessage();
        if(this.ref) {
            // scroll to view
            if(this.ref.cell_list) {
                this.ref.cell_list.forEach(cell_id => {
                    const cellEl = document.querySelector('#cell-' + cell_id);
                    cellEl.scrollIntoView();
                    cellEl.classList.add('highlight');
                });
            }
        }
    }

    public hide = (): void => {
        this.container.setAttribute('style', 'display:none');
        if(this.message) this.message.unhighlightMessage();
    }

    private addMessage = (message): void => {
        const message_container = document.createElement('div');
        message_container.classList.add('message');

        const message_link = document.createElement('button');
        message_link.innerText = "Scroll to the Message";
        message_link.onclick = message.scrollMessage;
        
        message_container.appendChild(message_link);
        this.container.appendChild(message_container);
    }

    private addDiffMessage = (message): void => {
        const message_container = document.createElement('div');
        message_container.classList.add('message');

        const old_message_link = document.createElement('button');
        old_message_link.innerText = "Scroll to the Old Message";
        old_message_link.onclick = message.scrollOldMessage;

        const new_message_link = document.createElement('button');
        new_message_link.innerText = "Scroll to the New Message";
        new_message_link.onclick = message.scrollNewMessage;
        
        message_container.appendChild(old_message_link);
        message_container.appendChild(new_message_link);
        this.container.appendChild(message_container);
    }

    private displayDiff = (): void => {
        if(this.type === 'version') {
            if(this.message.scrollMessage) this.addMessage(this.message);
            this.notebook[0].cells.forEach(cell=> {
                this.addCell(cell, cell);
            });
        }
        else {
            if(this.message.scrollOldMessage) this.addDiffMessage(this.message);
            const new_notebook = this.notebook[0];
            const old_notebook = this.notebook[1];
            const new_uids = [];
            const old_uids = [];
            let oindex = 0;
            let nindex = 0;
            new_notebook.cells.forEach(cell => {
                new_uids.push(cell.uid);
            });
            old_notebook.cells.forEach(cell => {
                old_uids.push(cell.uid);
            });

            while(new_uids.length > 0 && old_uids.length > 0) {
                const current_uid = new_uids[0];
                const index = old_uids.indexOf(current_uid);
                switch (index) {
                    case -1:
                        // if the current cell is not in the old version
                        this.addCell(new_notebook.cells[nindex], null);
                        new_uids.shift();
                        nindex ++;
                        break;
                    case 0:
                        // if the current cell is the corresponding cell in the old version
                        if(new_notebook.cells[nindex].source === old_notebook.cells[oindex].source) {
                            this.addCell(new_notebook.cells[nindex], old_notebook.cells[oindex]);
                        }
                        else this.addCell(new_notebook.cells[nindex], old_notebook.cells[oindex]);
                        new_uids.shift();
                        nindex ++;
                        old_uids.shift();
                        oindex ++;
                        break;
                    default:
                        // if the current cell is in the old version, but not the corresponding cell
                        this.addCell(null, old_notebook.cells[oindex]);
                        old_uids.shift();
                        oindex ++;
                        break;
                }
            }

            while (old_uids.length > 0) {
                this.addCell(null, old_notebook.cells[oindex]);
                old_uids.shift();
                oindex ++;
            }

            while (new_uids.length > 0) {
                this.addCell(new_notebook.cells[nindex], null);
                new_uids.shift();
                nindex ++;
            }
        }
        this.onSliderDemo();
    }

    private createCodeDiffUnit = (new_cell, old_cell, cell_container) => {
        const diff_container = document.createElement('div');
        diff_container.classList.add('diff-cell-container');
        cell_container.appendChild(diff_container);

        const input_container = document.createElement('div');
        input_container.classList.add('input');
        
        const prompt_container = document.createElement('div');
        prompt_container.classList.add('prompt_container');
        const input_prompt = document.createElement('div');
        input_prompt.classList.add('prompt', 'input_prompt');
        input_prompt.innerHTML = new_cell.execution_count==null? '<bdi>In</bdi>&nbsp;[ ]:': '<bdi>In</bdi>&nbsp;['+new_cell.execution_count + ']:';
        prompt_container.appendChild(input_prompt);
        input_container.appendChild(prompt_container);

        const inner_cell = document.createElement('div');
        inner_cell.classList.add('inner_cell');
        const input_area = document.createElement('div');
        input_area.classList.add('input_area');
        inner_cell.appendChild(input_area);
        input_container.appendChild(inner_cell);
        
        diff_container.appendChild(input_container);

        const option = {
            fromfile: 'Original',
            tofile: 'Current',
            fromfiledate: '2005-01-26 23:30:50',
            tofiledate: '2010-04-02 10:20:52'
        };
  
        const diff_content = window['difflib'].unifiedDiff(old_cell.source.split('\n'), new_cell.source.split('\n'), option);
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
        const id = 'diff-highlight-' + new_cell.uid;
        diff_El.id = id;
        input_area.appendChild(diff_El);

        const diff2htmlUi = new window['Diff2HtmlUI']({diff: diff_test_string});
        diff2htmlUi.draw('#'+id, {inputFormat: 'diff', showFiles: false, matching: 'lines', outputFormat: 'side-by-side'});
        diff2htmlUi.highlightCode('#'+id);
    }

    private createOutputUnit = (cell, cell_container, has_image_diff: boolean = false) => {
        const output_wrapper = document.createElement('div');
        output_wrapper.classList.add('output_wrapper');
        if (cell.outputs) {
            cell.outputs.forEach((output, output_index) => {
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
                        if (has_image_diff) {
                            break;
                        }
                        output_subarea.classList.add('output_png');
                        const img = document.createElement('img');
                        img.setAttribute('src', 'data:image/png;base64,'+output.data['image/png']);
                        // use cell number and output as index. Shouldn't cause any trouble as the diff is static.
                        img.id = "output-img-" + this.notebook[0].cells.indexOf(cell).toString() + "-" + output_index.toString();
                            output_subarea.appendChild(img);
                        break;
                    case 'stream':
                        output_subarea.classList.add('output_stream', 'output_text', 'output_stdout');
                        const pre = document.createElement('pre');
                        pre.innerText = output.text;
                        output_subarea.appendChild(pre);
                        break;
                    case 'execute_result':
                        if (output.data.hasOwnProperty('text/html')) {
                            output_subarea.classList.add('output_html', 'rendered_html', 'output_result');
                            output_subarea.innerHTML = output.data['text/html'];
                        }
                        else if (output.data.hasOwnProperty('text/plain')) {
                            output_subarea.classList.add('output_text', 'output_result');
                            const tmp = document.createElement('pre');
                            tmp.innerText = output.data['text/plain'];
                            output_subarea.appendChild(tmp);
                        }
                        break;
                    case 'error':
                        output_subarea.classList.add('output_text', 'output_error');
                        console.log(output);
                        const pre2 = document.createElement('pre');
                        output.traceback.forEach(item => {
                            pre2.innerText += item;
                        });
                        output_subarea.appendChild(pre2);
                        break;
                    default:
                        console.log('unrecognized output');
                        console.log(output);
                        break;
                }
                outputEl.appendChild(output_area);
                output_wrapper.appendChild(outputEl);
            });
        }
        cell_container.appendChild(output_wrapper);
    }

    private isImageDiff = (new_cell: Cell, old_cell: Cell): boolean => {
        const new_outputs = new_cell.outputs;
        const old_outputs = old_cell.outputs;
        
        if (!new_outputs || !old_outputs) return false;
        if (new_outputs.length === 0 || old_outputs.length === 0) return false;
        if (new_outputs[new_outputs.length - 1].output_type === 'display_data' && old_outputs[old_outputs.length - 1].output_type === 'display_data') return true;
        return false;
    }

    private createOutputDiffUnit = (new_cell, old_cell, cell_container) => {
        const diff_container = document.createElement('div');
        diff_container.classList.add('diff-cell-container');

        const right_cell_container = document.createElement('div');
        right_cell_container.classList.add('output-diff', 'diff','diff-right');
        const left_cell_container = document.createElement('div');
        left_cell_container.classList.add('output-diff', 'diff','diff-left');
        diff_container.appendChild(left_cell_container);
        diff_container.appendChild(right_cell_container);

        if(this.isImageDiff(new_cell, old_cell)) {
            cell_container.appendChild(diff_container);
            if (new_cell.outputs.length > 1) {
                // might have text outputs
                this.createOutputUnit(old_cell, left_cell_container, true);
            }
            this.renderImageDiff(new_cell, old_cell, left_cell_container); 
            this.createOutputUnit(new_cell, right_cell_container);
            return;
        }

        if(new_cell.outputs.length > 0 || old_cell.outputs.length > 0) {
            cell_container.appendChild(diff_container);
            this.createOutputUnit(new_cell, right_cell_container);
            this.createOutputUnit(old_cell, left_cell_container);
            return;
        }
    }


    private addCell = (new_cell: Cell, old_cell: Cell): void => {
        const cell_container = document.createElement('div');
        cell_container.classList.add('cell');
        // console.log(new_cell)

        if (new_cell) cell_container.id = 'cell-'+new_cell.uid;
        this.container.appendChild(cell_container);

        this.addCode(new_cell, old_cell, cell_container);
        // render output
        this.addOutput(new_cell, old_cell, cell_container);
        return;
    }


    private addCode = (new_cell: Cell, old_cell: Cell, cell_container: HTMLElement): void => {
        const diff_container = document.createElement('div');
        diff_container.classList.add('diff-cell-container');

        const new_cell_container = document.createElement('div');
        new_cell_container.classList.add('cell', 'diff','diff-new');
        const old_cell_container = document.createElement('div');
        old_cell_container.classList.add('cell', 'diff','diff-old');
        diff_container.appendChild(old_cell_container);
        diff_container.appendChild(new_cell_container);

        if(old_cell==null) {
            // insert a new cell
            this.container.appendChild(diff_container);
            this.createCodeUnit(new_cell, new_cell_container);
            this.addOutput(new_cell, null, new_cell_container);
            return;
        }

        if(new_cell == null) {
            // delete a cell
            this.container.appendChild(diff_container);
            this.createCodeUnit(old_cell, old_cell_container);
            this.addOutput(old_cell, null, old_cell_container);
            return;
        }
     
        // render cell
        if(new_cell.source === old_cell.source) this.createCodeUnit(new_cell, cell_container);
        else this.createCodeDiffUnit(new_cell, old_cell, cell_container);
    }

    private addOutput = (new_cell: Cell, old_cell: Cell, cell_container: HTMLElement): void => {
        if(old_cell == null) {
            this.createOutputUnit(new_cell, cell_container);
            return;
        }

        if(new_cell == null) {
            return;
        }

        if((new_cell.outputs == null || new_cell.outputs.length === 0) && (old_cell.outputs == null||old_cell.outputs.length===0)) {
            return;
        }

        if(window['_'].isEqual(new_cell.outputs, old_cell.outputs)) {
            this.createOutputUnit(new_cell, cell_container);
            return;
        }
        this.createOutputDiffUnit(new_cell, old_cell, cell_container);
    }

    // create a single code unit
    private createCodeUnit = (cell: Cell, cell_container: HTMLElement): void => {
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

        (window as any).CodeMirror(input_area, {
            value: cell ==null? '': cell.source,
            mode:  'python',
            lineNumbers: true,
            readOnly: true,
            showCursorWhenSelecting: false,
            theme: 'ipython'
        });
    }

    private renderImageDiff = (new_cell, old_cell, diff_container): void => {
        const data_old = old_cell.outputs[old_cell.outputs.length - 1].data['image/png'];
        const data_new = new_cell.outputs[new_cell.outputs.length - 1].data['image/png'];

        const old_src = 'data:image/png;base64,'+ data_old;
        const new_src = 'data:image/png;base64,'+ data_new;

        const output_wrapper = document.createElement('div');
        output_wrapper.classList.add('output_wrapper');
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
        outputEl.appendChild(output_area);
        output_wrapper.appendChild(output_area);
        diff_container.appendChild(output_wrapper);

        const img = document.createElement('img');
        img.setAttribute('src', old_src);
        // use cell number and output as index. Shouldn't cause any trouble as the diff is static.
        img.id = "output-img-" + this.notebook[0].cells.indexOf(old_cell).toString() + "-0";
        // Only show diff when the new cell has at least the same number of output as the index and the corresponding index is still an image.
        // creating diff image which appears on hover
        const hover_container = document.createElement('div');
        hover_container.classList.add('hover-container');

        // ISSUE:https://github.com/LittleAprilFool/jupyter-sharing/issues/53
        // comment out the next line to disable resemble 
        this.enableResemble(new_src, old_src, hover_container);

        // adding css to original img
        img.classList.add('img-overlay');
        img.style.opacity = "0.75";
        hover_container.appendChild(img);

        // overlays new picture in the bottom
        const img_bottom = document.createElement('img');
        img_bottom.setAttribute('src', new_src);
        hover_container.appendChild(img_bottom);

        output_subarea.appendChild(hover_container);

        // creating slider
        const slider = document.createElement('input');
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.value = "100";
        slider.setAttribute("img-id", img.id);
        slider.classList.add("img-slider");
        slider.addEventListener("input", this.onSliderInput);
        output_subarea.appendChild(slider);
    }

    private enableResemble = (new_src, old_src, hover_container): void => {
        const img_diff = document.createElement('img');
        img_diff.setAttribute('src', old_src);
        img_diff.classList.add("img-diff");
        hover_container.appendChild(img_diff);

        const resemble_control = resemble(old_src).compareTo(new_src).onComplete(data => {
            img_diff.setAttribute('src', data.getImageDataUrl());
        });
        resemble_control.outputSettings({
            errorColor: {
                red: 255,
                green: 0,
                blue: 255
            },
            errorType: 'movement'
        }).repaint();
    }

    private initContainer = (): void => {
        this.container = document.createElement('div');
        this.label = this.type === 'diff'? 'diff-'+this.timestamp[0]+'-'+this.timestamp[1]:'version-'+this.timestamp[0];  
        this.container.classList.add('container', 'diffwidget-container', this.label);
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
            label_container.appendChild(label_old);
            label_container.appendChild(label_new);
            trigger.appendChild(label_container);
        }

        this.container.appendChild(trigger);
        const main_container = document.querySelector('#notebook');
        main_container.insertBefore(this.container, main_container.firstChild.nextSibling);
        this.container.addEventListener('keydown', this.handleKeyPress);
    }

    private handleKeyPress = (e): void => {
        const alert = document.querySelector('#SwitchAlert') as HTMLElement;
        alert.style.display = 'block';
    }

    private onSliderInput = (e: Event): void => {
        const parent = ( e.target as HTMLElement ).parentElement;
        const target_slider = parent.childNodes[1] as HTMLInputElement;
        const target_img = parent.childNodes[0].childNodes[1] as HTMLImageElement;
        const bottom_img = parent.childNodes[0].childNodes[2] as HTMLImageElement;
        const opacity = ((+target_slider.max) - (+target_slider.value)) / ((+target_slider.max) - (+target_slider.min));
        const bottom_opacity = 1 - opacity;
        target_img.style.opacity = opacity.toString();
        bottom_img.style.opacity = bottom_opacity.toString();
    }

    private onSliderDemo = (): void => {
        const target_slider = document.querySelector('.img-slider') as HTMLInputElement;
        if(target_slider == null) return;

        const startTimer = value => {
            if(value < 20) return;
            setTimeout(() => {
                value = value - 1;
                target_slider.value = value.toString();
                target_slider.dispatchEvent(new Event('input', {
                    'bubbles': true,
                    'cancelable': true
                }));
                startTimer(value);
            }, 20);
        };
        startTimer(100);
    }

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '.diffwidget-container { padding: 15px; background-color: #fff; box-shadow: 0px 0px 12px 0px rgba(87, 87, 87, 0.2); margin-bottom: 20px } \n';
        sheet.innerHTML += '.diffwidget-trigger { font-size: 15px; text-align: center; position: relative; font-weight: bold;} \n';
        sheet.innerHTML += '.version-label { font-size: 12px; text-align: center; display: inline-block; width: 50%; font-weight: bold;} \n';
        sheet.innerHTML += '#label-new { background:rgba(0, 200, 20, 0.3); } \n';
        sheet.innerHTML += '#label-old { background:rgba(255, 20, 0, 0.3); } \n';
        sheet.innerHTML += '#label-container {margin-top: 10px; margin-bottom: 10px;} \n';
        sheet.innerHTML += '.diffwidget-container > .cell.highlight {background:#fff6dc} \n';
        sheet.innerHTML += '.diff-cell-container {background: #fff6dc; overflow:auto;} \n';
        sheet.innerHTML += '.diff { background: inherit; width: 50% !important; display: inline-block !important; float:left;} \n';
        sheet.innerHTML += 'span.diff-add {background: #c5e4bd}\n';
        sheet.innerHTML += 'span.diff-del {background: #e4cabd}\n';
        sheet.innerHTML += '.diffwidget-container > .message > button {margin: 0px 180px; outline: none; background-color: #d4edda; color: #155724; border-color: #c3e6cb}\n';
        sheet.innerHTML += '.diffwidget-container > .message {text-align: center; margin:10px 0px;}\n';
        sheet.innerHTML += '.diff-new .input_area {background: rgba(0, 200, 20, 0.1); }\n';
        sheet.innerHTML += '.diff-old .input_area {background: rgba(255, 20, 0, 0.1); }\n';
        sheet.innerHTML += '.diff-right {float: right}\n';
        sheet.innerHTML += '.img-overlay { position: absolute; }\n';
        sheet.innerHTML += '.img-diff { position: absolute; opacity: 0;}\n';
        sheet.innerHTML += '.hover-container:hover .img-diff{ opacity: 1; z-index: 2;}\n';
        sheet.innerHTML += '.hover-container { position: relative; }\n';
        sheet.innerHTML += '.img-slider { margin: 10px 0 5px 0; }\n';
        sheet.innerHTML += '.inner_cell> .input_area > div > .d2h-wrapper > .d2h-file-wrapper {margin-bottom: 0px; border: none; padding-bottom: 5px;}\n';
        sheet.innerHTML += '.d2h-files-side-diff > .d2h-code-wrapper > .d2h-diff-tabel > .d2h-diff-tbody > tr > .d2h-cntx {background-color: #fff6dd}\n';
        sheet.innerHTML += '.d2h-files-side-diff > .d2h-code-wrapper > .d2h-diff-tabel > .d2h-diff-tbody > tr > .d2h-info {background-color: #fff6dd; border-color: #ddd}\n';
        document.body.appendChild(sheet);
    }
}