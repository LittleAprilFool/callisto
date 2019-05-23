type CellEditOpComponent = {
    i?: string,
    d?: string,
    p: number
}


type CellEditOp = {
    p: ['source'],
    t: 'text0',
    o: CellEditOpComponent[]
}