const Jupyter = require('base/js/namespace');

import { openWS } from './utils';
import { SDBDoc } from 'sdb-ts';

export function joinDoc(doc_name: string):Promise<SDBDoc<SharedDoc>> {
    let ws = openWS(5555);
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<SDBDoc<SharedDoc>>((resolve, reject) => {
        let sdbDoc = sdbClient.get('doc', doc_name);
        sdbDoc.fetch().then(res=>{
            if (res.type == null) reject('document does not exist');
            else resolve(sdbDoc);
        });
    });
};

export function createDoc(doc_name: string): Promise<SDBDoc<SharedDoc>> {
    let ws = openWS(5555);
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<SDBDoc<SharedDoc>>(resolve=>{
        let sdbDoc = sdbClient.get('doc', doc_name);
        sdbDoc.createIfEmpty({
            count: 0,
            notebook: JSON.parse(JSON.stringify(Jupyter.notebook))
        })
        resolve(sdbDoc)
    })
}
