import { CodeMirror } from 'codemirror';
import { SDBDoc } from 'sdb-ts';
import { NotebookBinding } from '../component/notebookBinding';
import { updateSharedButton } from '../component/sharedButton';
import { joinDoc } from './sharedbAction';

const Jupyter = require('base/js/namespace');
const utils = require('base/js/utils');
const contents_service = require('contents');
const config = require('services/config');

export function loadNotebook(): Promise<NotebookSDB> {
    return new Promise<NotebookSDB> (resolve => {
        joinDoc(Jupyter.notebook.metadata.doc_name).then(({doc, ws}) => {
            console.log('Loading shared notebook ' + Jupyter.notebook.metadata.doc_name);
            updateSharedButton(true); 
            deleteNotebook().then(()=> {
                const cells = doc.getData().notebook.cells;
                cells.forEach(cell=> {
                    // insert cell
                    const new_cell = Jupyter.notebook.insert_cell_above(cell.cell_type);
                    // set value
                    new_cell.code_mirror.setValue(cell.source);
                    // set input_prompt
                    if(cell.execution_count) {
                        new_cell.set_input_prompt(cell.execution_count);
                    }
                    // show output if it exists
                    if(cell.outputs) {
                        cell.outputs.forEach(output=> {
                            new_cell.output_area.append_output(output);
                        });
                    }
                    // render all markdown cells
                    if(cell.cell_type === 'markdown') {
                        new_cell.unrender();
                        new_cell.render();
                    }
                });
                // delete the extra code cell
                const num_cells = Jupyter.notebook.get_cells().length;
                Jupyter.notebook.delete_cell(num_cells-1);
                const notebookBinding = new NotebookBinding(doc, ws);
                resolve(notebookBinding);
            });
        });
    });
}

export function openNotebook(doc_name: string, sdbDoc: SDBDoc<SharedDoc>): void {
    const common_options = {
        base_url: document.body.dataset.baseUrl,
        config: null,
        notebook_path: document.body.dataset.notebookPath,
    };

    const cfg = new config.ConfigSection('tree', common_options);
    cfg.load();
    common_options.config = cfg;
    const common_config = new config.ConfigSection('common', common_options);
    common_config.load();
    const contents = new contents_service.Contents({
        base_url: common_options.base_url,
        common_config
    });
    const doc_data = sdbDoc.getData();
    const nb_data = {
        'cells': [],
        'metadata': doc_data.notebook.metadata,
        'nbformat': doc_data.notebook.nbformat,
        'nbformat_minor': doc_data.notebook.nbformat_minor
    };

    const w = window.open(undefined, Jupyter._target);

    newNotebook(contents, common_options.notebook_path, {type: "notebook", content: nb_data, name: doc_name})
    .then( 
        data => {
            let url = utils.url_path_join(
                common_options.base_url, 'notebooks',
                utils.encode_uri_components(data.path)
            );          
            url += "?kernel_name=" + doc_data.notebook.metadata.kernelspec.name;
            w.location = url;
        },
        error => {
            w.close();
        }
    );

}

export function getNotebookMirror(): CodeMirror[] {
    const notebook_mirror: CodeMirror[] = [];
    const num_cells = Jupyter.notebook.get_cells().length;
    for (let i = 0; i < num_cells; i++) {
        notebook_mirror.push(Jupyter.notebook.get_cell(i).code_mirror);
    }
    return(notebook_mirror);
}

function newNotebook(contents, path, options): any {
    const fileName = options.name;
    const data = JSON.stringify({
                content:options.content,
                type:options.type
    });
    const settings = {
            contentType: 'application/json',
            data,
            dataType: "json",
            processData: false,
            type: "PUT"
    };
    // send a PUT request to notebook api, request notebook to open a new .ipynb
    return utils.promising_ajax(contents.api_url(path + '/' + fileName + '.ipynb'), settings);
}

function deleteNotebook(): Promise<void> {
    return new Promise((resolve, reject)=> {
        const num_cells = Jupyter.notebook.get_cells().length;
        for (let i = 0; i < num_cells; ++i) {
            Jupyter.notebook.delete_cell(0);
        }
        resolve();
    });
}