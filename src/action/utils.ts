export const generateUUID = (): string => {
    let d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        d += performance.now(); // use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

export const openWS = (port: number): WebSocket => {
    let url = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    url += document.domain + ':' + port;
    const ws = new WebSocket(url);
    return ws;
};

export const getRandomColor = (): string => {
    const letters = '579B'.split('');
    let color = '#';
    for (let i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * letters.length)];
    }
    return color;
};

export const getTimestamp = (): number => {
    return (new Date()).getTime();
};

export const getTime = (): string => {
    // returns time in 12 hour format

    let time = '';
    let pm = false;

    const d = new Date();

    if (d.getHours() > 12) {
        pm = true;
        time += d.getHours() - 12;
    }
    else {
        time += d.getHours();
    }

    const minutes = d.getMinutes();
    time = minutes < 10? time + ':0' + minutes : time + ':' + minutes;
    time = pm ? time + 'PM': time + 'AM';

    return time;
};