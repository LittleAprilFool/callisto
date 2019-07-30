import { Cell, IDiffWidget, Notebook } from "types";
import * as Diff from '../external/diff';
import * as resemble from "../external/resemble";

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
                        this.addDiffCell(new_notebook.cells[nindex], null);
                        new_uids.shift();
                        nindex ++;
                        break;
                    case 0:
                        // if the current cell is the corresponding cell in the old version
                        if(new_notebook.cells[nindex].source === old_notebook.cells[oindex].source) {
                            this.addCell(new_notebook.cells[nindex]);
                        }
                        else this.addDiffCell(new_notebook.cells[nindex], old_notebook.cells[oindex]);
                        new_uids.shift();
                        nindex ++;
                        old_uids.shift();
                        oindex ++;
                        break;
                    default:
                        // if the current cell is in the old version, but not the corresponding cell
                        this.addDiffCell(null, old_notebook.cells[oindex]);
                        old_uids.shift();
                        oindex ++;
                        break;
                }
            }

            while (old_uids.length > 0) {
                this.addDiffCell(null, old_notebook.cells[oindex]);
                old_uids.shift();
                oindex ++;
            }

            while (new_uids.length > 0) {
                this.addDiffCell(new_notebook.cells[nindex], null);
                new_uids.shift();
                nindex ++;
            }
        }

        const diffHtml = window['Diff2Html'].getPrettyHtml(
            '<Unified Diff String>',
            {inputFormat: 'diff', showFiles: true, matching: 'lines', outputFormat: 'side-by-side'}
          );
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


        this.createCellUnit(new_cell, new_cell_container, false);
        this.createCellUnit(old_cell, old_cell_container, true, new_cell);
        // this.computeDiff(new_cell.source, old_cell.source)
        // jsdiff does not work here!!
        // this.addCodeDiff(diff_container, new_cell.source, old_cell.source);
        this.onSliderDemo();
    }

    // private computeDiff = (new_code, old_code): void => {
    //     // send a request to server

    //     // get a diff file

    //     // render the diff using html2diff
    // }

    // private addCodeDiff = (diff_container, new_code, old_code): void => {
    //     const parts = Diff.diffChars(old_code, new_code);
    //     const new_container = diff_container.querySelector('.cell.diff-new');
    //     const old_container = diff_container.querySelector('.cell.diff-old');
    //     const new_lines = new_container.querySelectorAll('.CodeMirror-line');
    //     const old_lines = old_container.querySelectorAll('.CodeMirror-line');
    //     let lineNumber = 0;
    //     let string_count = 0;
    //     parts.forEach((part, partIndex) => {
    //         console.log(part, partIndex, lineNumber, string_count, new_lines[lineNumber].innerText);
    //         const substring = part.value;
    //         const lines = substring.split("\n");
    //         if (part.added) {
    //             lines.forEach((line, index) => {
    //                 if(index>0) {
    //                     lineNumber++;
    //                     string_count = 0;
    //                 }
    //                 const text = new_lines[lineNumber].innerText;
    //                 const raw = new_lines[lineNumber].innerHTML;
    //                 // console.log(string_count, text.slice(string_count, string_count + 2))
    //                 const transform_text = this.transformADDText(raw, text, string_count, line);
    //                 new_lines[lineNumber].innerHTML = transform_text;
    //             });

    //             // const transform_text = this.transformADDText(new_lines[startLineNumber], string_count, part.value);
    //             // new_lines[startLineNumber].innerHTML = transform_text;
    //         } else if (part.removed) {
    //             // add multiple lines to new_lines?
    //             // may not work out
    //             const text = new_lines[lineNumber].innerText;
    //             const raw = new_lines[lineNumber].innerHTML;
    //             const transform_text = this.transformDELText(raw, text, string_count, part.value);
    //             new_lines[lineNumber].innerHTML = transform_text;
    //             lineNumber++;
    //         }
    //         else {
    //             string_count = string_count + part.count;
    //             if(lines.length > 1) {
    //                 lineNumber = lineNumber + lines.length-1;
    //                 string_count = lines[lines.length-1].length;
    //             }
    //         }
    //     });
    // }

    // private transformDELText = (raw, text, string_count, value): string => {
    //     console.log('transform del, ', text, string_count, value)
    //     let i_count = 0;
    //     let e_count = 0;
    //     let e_key;
    //     let flag = false;
    //     // console.log(string_count)
    //     while(e_count < raw.length) {
    //         switch(raw[e_count]) {
    //             case '<':
    //                 flag = true;
    //                 break;
    //             case '>':
    //                 flag = false;
    //                 break;
    //             default:
    //                 if(!flag) {
    //                     // console.log(i_count);
    //                     // console.log(e_count, raw[e_count])
    //                     if(i_count==string_count-1) e_key = e_count;
    //                     i_count ++;
    //                 }
    //                 break;
    //         }
    //         e_count ++;
    //     }
    //     console.log(raw);
    //     // console.log(e_key)
    //     const p1 = raw.slice(0,e_key+1);
    //     const p2 = raw.slice(e_key+1, raw.length);
    //     console.log(p1);
    //     console.log(p2);
    //     const new_raw = p1 + '<span class="diff-del">' + value + '</span>' + p2;
    //     return new_raw;
    // }

    // private transformADDText = (raw, text, string_count, value): string =>{
    //     console.log('transform add, ', text, string_count, value)
    //     let i_count = 0;
    //     let e_count = 0;
    //     let e_start;
    //     let e_end;
    //     let last_end;
    //     let flag = false;
    //     let next_end = false;
    //     let num_flag = 0;
    //     const length = value.length;
    //     // console.log(string_count, length)
    //     while(e_count < raw.length) {
    //         switch(raw[e_count]) {
    //             case '<':
    //                 last_end = e_count;
    //                 flag = true;
    //                 break;
    //             case '>':
    //                 flag = false;
    //                 num_flag ++;
    //                 if(next_end) {
    //                     e_end = e_count;
    //                     next_end = false;
    //                 }
    //                 break;
    //             default:
    //                 if(!flag) {
    //                     // console.log(i_count, e_count, raw[e_count])
    //                     if(i_count==string_count) {
    //                         // if e_start needs to include the <span> tag
    //                         // console.log(e_count, raw.slice(e_count-3, e_count+3))
    //                         if (raw[e_count-1]==='>' && (num_flag % 2 ==0)) e_start = last_end;
    //                         else e_start = e_count;
    //                     }
    //                     if(i_count==string_count+length-1) {
    //                         // console.log(e_count, raw.slice(e_count-3, e_count+3))
    //                         if(raw[e_count+1] === '<' && (num_flag % 2 == 0)) next_end = true;
    //                         else e_end = e_count;
    //                     } 
    //                     i_count ++;
    //                 }
    //                 break;
    //         }
    //         e_count ++;
    //     }
    //     console.log(raw);
    //     const p1 = raw.slice(0,e_start);
    //     const p2 = raw.slice(e_start, e_end+1);
    //     const p3 = raw.slice(e_end+1, raw.length);
    //     console.log(p1)
    //     console.log(p2)
    //     console.log(p3);
    //     const new_raw = p1 + '<span class="diff-add">' + p2 + '</span>' + p3;
    //     return new_raw;
    // }

    private addCell = (cell: Cell): void => {
        const cell_container = document.createElement('div');
        cell_container.classList.add('cell');
        this.container.appendChild(cell_container);

        this.createCellUnit(cell, cell_container, false);
    }

    private createCellUnit = (cell: Cell, cell_container: HTMLElement, is_old_cell: boolean, new_cell?: Cell): void => {
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
        // todo: this causes trouble when the outputs from the two sides are not the same.
        if(cell.outputs) {
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
                        output_subarea.classList.add('output_png');
                        const img = document.createElement('img');
                        img.setAttribute('src', 'data:image/png;base64,'+output.data['image/png']);
                        // use cell number and output as index. Shouldn't cause any trouble as the diff is static.
                        img.id = "output-img-" + this.notebook[0].cells.indexOf(cell).toString() + "-" + output_index.toString();
                        if (new_cell && is_old_cell && new_cell.outputs.length > output_index && new_cell.outputs[output_index].output_type === 'display_data') {
                            const data_old = output.data['image/png'];
                            const data_new = new_cell.outputs[output_index].data['image/png'];
                            this.renderImageDiff(output_subarea, img, data_old, data_new);                        
                        } else {
                            output_subarea.appendChild(img);
                        }
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
                    default:
                        break;
                }
                outputEl.appendChild(output_area);
                output_wrapper.appendChild(outputEl);
            });
        }
        cell_container.appendChild(output_wrapper);
    }

    private renderImageDiff = (output_subarea, img, data_old, data_new): void => {
        // Only show diff when the new cell has at least the same number of output as the index and the corresponding index is still an image.
        // creating diff image which appears on hover
        const hover_container = document.createElement('div');
        hover_container.classList.add('hover-container');

        const old_src = 'data:image/png;base64,'+ data_old;
        const new_src = 'data:image/png;base64,'+ data_new;

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
        slider.value = "0";
        slider.setAttribute("img-id", img.id);
        slider.classList.add("img-slider");
        slider.addEventListener("input", this.onSliderInput);
        output_subarea.appendChild(slider);
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

    private onSliderInput = (e?: Event): void => {
        const target_slider = document.querySelector('.img-slider') as HTMLInputElement;
        const target_img = document.getElementById(target_slider.getAttribute('img-id'));
        const opacity = ((+target_slider.value) - (+target_slider.min)) / ((+target_slider.max) - (+target_slider.min));
        target_img.style.opacity = opacity.toString();
    }

    private onSliderDemo = (): void => {
        const target_slider = document.querySelector('.img-slider') as HTMLInputElement;
        if(target_slider == null) return;

        const startTimer = value => {
            if(value > 100) return;
            setTimeout(() => {
                value = value + 1;
                target_slider.value = value.toString();
                this.onSliderInput();
                startTimer(value);
            }, 20);
        };
        startTimer(0);
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
        sheet.innerHTML += 'span.diff-add {background: #c5e4bd}\n';
        sheet.innerHTML += 'span.diff-del {background: #e4cabd}\n';
        sheet.innerHTML += '.diff-new .input_area {background: rgba(0, 200, 20, 0.1); }\n';
        sheet.innerHTML += '.diff-old .input_area {background: rgba(255, 20, 0, 0.1); }\n';
        sheet.innerHTML += '.img-overlay { position: absolute; }\n';
        sheet.innerHTML += '.img-diff { position: absolute; opacity: 0;}\n';
        sheet.innerHTML += '.hover-container:hover .img-diff{ opacity: 1; z-index: 2;}\n';
        sheet.innerHTML += '.hover-container { position: relative; }\n';
        sheet.innerHTML += '.img-slider { margin: 10px 0 5px 0; }\n';
        document.body.appendChild(sheet);
    }
}