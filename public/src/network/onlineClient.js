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
      let settled = false;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', roomId, token }));
      };

      ws.onmessage = (ev) => {
        let data;
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }

        // Settle the connect() promise on the first definitive response.
        // 'joined' resolves; 'error' arriving before 'joined' rejects (e.g.
        // 房间已满). Subsequent 'error' messages just propagate to the
        // generic handler.
        if (!settled) {
          if (data.type === 'joined') {
            settled = true;
            resolve(data);
          } else if (data.type === 'error') {
            settled = true;
            reject(new Error(data.message || '加入失败'));
            try {
              ws.close();
            } catch {
              /* ignore */
            }
            return;
          }
        }

        this.emit(data.type, data);
      };

      ws.onclose = () => {
        if (!settled) {
          settled = true;
          reject(new Error('连接已关闭'));
        }
        this.emit('closed', {});
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error('连接失败'));
        }
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
