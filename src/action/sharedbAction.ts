import { SDBDoc } from 'sdb-ts';
import { openWS } from './utils';

const Jupyter = require('base/js/namespace');

export function joinDoc(doc_name: string): Promise<{doc: SDBDoc<SharedDoc>, ws: WebSocket}> {
    const ws = openWS(5555);
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<{doc: SDBDoc<SharedDoc>, ws: WebSocket}>((resolve, reject) => {
        const sdbDoc = sdbClient.get('doc', doc_name);
        sdbDoc.fetch().then(res=> {
            if (res.type == null) {
                reject('document does not exist');
            }
            else {
                resolve({doc: sdbDoc, ws});
            }
        });
    });
}

export function createDoc(doc_name: string): Promise<{doc: SDBDoc<SharedDoc>, ws: WebSocket}> {
    const ws = openWS(5555);
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<{doc: SDBDoc<SharedDoc>, ws: WebSocket}>(resolve=> {
        const sdbDoc = sdbClient.get('doc', doc_name);
        sdbDoc.createIfEmpty({
            count: 0,
            notebook: JSON.parse(JSON.stringify(Jupyter.notebook)),
            event: {
                render_markdown: 0,
                unrender_markdown: 0,
            },
            host: null,
            users: [],
            chat: []
        }).then(()=> {
            resolve({doc: sdbDoc, ws});
        });
    });
}