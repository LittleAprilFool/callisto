import { SDBDoc } from 'sdb-ts';
import { openWS } from './utils';

const Jupyter = require('base/js/namespace');

export function joinDoc(doc_name: string): Promise<SDBDoc<SharedDoc>> {
    const ws = openWS(5555);
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<SDBDoc<SharedDoc>>((resolve, reject) => {
        const sdbDoc = sdbClient.get('doc', doc_name);
        sdbDoc.fetch().then(res=> {
            if (res.type == null) {
                reject('document does not exist');
            }
            else {
                resolve(sdbDoc);
            }
        });
    });
}

export function createDoc(doc_name: string): Promise<SDBDoc<SharedDoc>> {
    const ws = openWS(5555);
    const sdbClient = new window['SDB'].SDBClient(ws);
    return new Promise<SDBDoc<SharedDoc>>(resolve=> {
        const sdbDoc = sdbClient.get('doc', doc_name);
        sdbDoc.createIfEmpty({
            count: 0,
            notebook: JSON.parse(JSON.stringify(Jupyter.notebook))
        });
        resolve(sdbDoc);
    });
}