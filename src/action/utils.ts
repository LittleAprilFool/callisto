export function generateUUID(): string {
    var d = new Date().getTime()
    if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
        d += performance.now() //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        let r = (d + Math.random() * 16) % 16 | 0
        d = Math.floor(d / 16)
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
}

export function openWS(port: number): WebSocket {
    let ws
    if (window.location.protocol === 'https:') ws =  new WebSocket('wss://' + document.domain + ':'+port)
    else ws = new WebSocket('ws://' + document.domain + ':'+port)
    return ws
}

export function getRandomColor(): string {
    let letters = 'BCDEF'.split('')
    let color = '#'
    for (let i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * letters.length)]
    }
    return color
}

export function getTime(): string {
    // returns time in 12 hour format

    let time = '';
    let pm = false;

    let d = new Date();

    if (d.getHours() > 12) {
        pm = true;
        time += d.getHours() - 12;
    }
    else {
        time += d.getHours();
    }

    let minutes = d.getMinutes();
    if (minutes < 10) {
        time = time + ':0' + minutes;
    }
    else {
        time = time +':' + minutes;
    }

    if (pm) {
        time += ' PM';
    }
    else {
        time += ' AM';
    }

    return time;
}