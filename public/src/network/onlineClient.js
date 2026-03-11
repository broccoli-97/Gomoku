export class OnlineClient {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
  }

  on(type, cb) {
    this.handlers.set(type, cb);
  }

  emit(type, payload) {
    const fn = this.handlers.get(type);
    if (fn) fn(payload);
  }

  connect(roomId, token = '') {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${location.host}`);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', roomId, token }));
      };

      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === 'joined') {
          resolve(data);
        }
        this.emit(data.type, data);
      };

      ws.onclose = () => {
        this.emit('closed', {});
      };

      ws.onerror = () => {
        reject(new Error('连接失败'));
      };

      this.ws = ws;
    });
  }

  sendMove(x, y) {
    this.send({ type: 'move', x, y });
  }

  restart() {
    this.send({ type: 'restart' });
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }
}
