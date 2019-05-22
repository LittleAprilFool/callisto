type CellEditOpComponent = {
    i?: string,
    d?: string,
    p: number
}

type CellEditOp = CellEditOpComponent[]

type CellEditDocComponent = {
    p: any[],
    t: string,
    o: CellEditOp
}

type CellEditDocOp = CellEditDocComponent[]