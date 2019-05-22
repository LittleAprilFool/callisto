import { SDBSubDoc } from "sdb-ts";

function checkOps(ops): ops is CellEditDocOp {
    return ops[0].o !== undefined;
}

export class SharedCell {
    private suppressChanges: boolean = false;
    constructor(private codeMirror: any, private doc: SDBSubDoc<Cell>) {
        this.doc.subscribe(this.onSDBDocEvent);
        this.codeMirror.on('change', this.onCodeMirrorChange);
    }

    public destroy(): void {
        this.codeMirror.off('change', this.onCodeMirrorChange);
        this.doc.unsubscribe(this.onSDBDocEvent);
    }

    public updateDoc(newDoc: SDBSubDoc<Cell>): void {
        this.doc.unsubscribe(this.onSDBDocEvent);
        this.doc = newDoc;
        this.doc.subscribe(this.onSDBDocEvent);
    }

    private onSDBDocEvent = (type, ops, source): void => {
        if(type === 'op') {
            if((source !== this) && (checkOps(ops))) {
                ops.forEach(op => this.applyOp(op));
            }
        }
    }

    private applyOp(op): void {
        this.suppressChanges = true;
        op.o.forEach(value => {
            const {i, d, p} = value;
            const index = p;
            if(i) {
                this.codeMirror.replaceRange(i, this.codeMirror.posFromIndex(index));
            }
            // delete code from code mirror
            else if(d) {
                const from = this.codeMirror.posFromIndex(index);
                const to = this.codeMirror.posFromIndex(index + d.length);
                this.codeMirror.replaceRange('', from, to);
            }
        });
        
        this.assertValue();
        this.suppressChanges = false;
    }

    // insert code into cellMirror
    private assertValue() {
        const editorValue = this.codeMirror.getValue();
        const expectedValue = this.doc.getData().source;
        if(editorValue !== expectedValue) {
            console.error(`Expected value (${expectedValue}) did not match editor value (${editorValue})`);
            this.codeMirror.setValue(expectedValue);
        }
    }

    private onCodeMirrorChange = (cellMirror, change): void => {
        if(!this.suppressChanges) {
            const ops: CellEditOp = this.createOpFromChange(change);
            const docOp: CellEditDocOp = [{p:['source'], t: 'text0', o: ops}];
            this.doc.submitOp(docOp, this);
        }
    }

    private createOpFromChange(change): any {
        const op: CellEditOp = [];
        const index = this.codeMirror.indexFromPos(change.from);

        if (change.from !== change.to) {
            // delete operation
            const deleted = change.removed.join('\n');
            op.push({p: index, d: deleted});
        }

        if (change.text[0] !== '' || change.text.length > 0) {
            // insert operation
            const inserted = change.text.join('\n');
            op.push({p: index, i: inserted});
        }
        return op;
    }
}
