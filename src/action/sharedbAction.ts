import { SDBDoc } from 'sdb-ts';
import { openWS } from './utils';

const Jupyter = require('base/js/namespace');

export const joinDoc = (doc_name: string): Promise<{doc: SDBDoc<SharedDoc>, client: any, ws: WebSocket}> => {
    const ws = openWS(5555);
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<{doc: SDBDoc<SharedDoc>, client: any, ws: WebSocket}>((resolve, reject) => {
        const sdbDoc = sdbClient.get('doc', doc_name);
        sdbDoc.fetch().then(res=> {
            if (res.type == null) {
                reject('document does not exist');
            }
            else {
                resolve({doc: sdbDoc, client: sdbClient,ws});
            }
        });
    });
};

export const createDoc = (doc_name: string): Promise<{doc: SDBDoc<SharedDoc>, client: any, ws: WebSocket}> => {
    const ws = openWS(5555);
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<{doc: SDBDoc<SharedDoc>, client: any, ws: WebSocket}>(resolve=> {
        const sdbDoc = sdbClient.get('doc', doc_name);
        const emptyDoc: SharedDoc = {
            count: 0,
            notebook: JSON.parse(JSON.stringify(Jupyter.notebook)),
            event: {
                render_markdown: 0,
                unrender_markdown: 0,
            },
            host: null,
            users: [],
            chat: [],
            cursor: [],
            changelog:[]
        };
        sdbDoc.createIfEmpty(emptyDoc).then(()=> {
            resolve({doc: sdbDoc, client: sdbClient, ws});
        });
    });
};