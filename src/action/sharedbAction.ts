import { SDBDoc } from 'sdb-ts';
import { SharedDoc } from 'types';
import { generateUUID, openWS, openCallistoWS } from './utils';

const Jupyter = require('base/js/namespace');
// change the collection here
const collection = 'doc000';
// const port = 5555;

export const joinDoc = (doc_name: string): Promise<{doc: SDBDoc<SharedDoc>, client: any, ws: WebSocket}> => {
    //const ws = openWS(port);
    const ws = openCallistoWS();
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<{doc: SDBDoc<SharedDoc>, client: any, ws: WebSocket}>((resolve, reject) => {
        // change the doc name here
        const sdbDoc = sdbClient.get(collection, doc_name);
        sdbDoc.fetch().then(res=> {
            if (res.type == null) {
                // set share flag to true
                Jupyter.notebook.metadata.shared = false;
        
                // add doc name
                Jupyter.notebook.metadata.doc_name = null;

                // save after changing metadata
                Jupyter.notebook.save_notebook();   
                reject('document does not exist');
            }
            else {
                resolve({doc: sdbDoc, client: sdbClient,ws});
            }
        });
    });
};

export const createDoc = (doc_name: string): Promise<{doc: SDBDoc<SharedDoc>, client: any, ws: WebSocket}> => {
    // const ws = openWS(port);
    const ws = openCallistoWS();
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<{doc: SDBDoc<SharedDoc>, client: any, ws: WebSocket}>(resolve=> {
        // change the doc name here
        const sdbDoc = sdbClient.get(collection, doc_name);
        const notebook = JSON.parse(JSON.stringify(Jupyter.notebook));
        const cells = Jupyter.notebook.get_cells();
        cells.forEach((cell, index) => {
            cell.uid = generateUUID();
            notebook.cells[index].uid = cell.uid;
        });

        const emptyDoc: SharedDoc = {
            count: 0,
            notebook,
            event: {
                render_markdown: 0,
                unrender_markdown: 0,
            },
            host: null,
            users: [],
            chat: [],
            cursor: [],
            changelog:[],
            kernel: {
                id: null,
                operation: null
            }
        };
        sdbDoc.createIfEmpty(emptyDoc).then(()=> {
            resolve({doc: sdbDoc, client: sdbClient, ws});
        });
    });
};