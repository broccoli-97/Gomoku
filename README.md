# Web 五子棋（模块化实现）

支持：
- 真实感棋盘与棋子 Canvas 渲染
- 单机人机对战（启发式 AI）
- 双人在线对战（WebSocket 房间）

## 运行

```bash
npm install
npm start
```

打开：`http://localhost:3000`

## 项目结构

- `server.js`：在线房间与对局状态同步
- `public/src/core`：棋盘规则与常量
- `public/src/render`：真实感棋盘/棋子渲染
- `public/src/ai`：AI 落子策略
- `public/src/network`：WebSocket 客户端
- `public/src/ui`：DOM 辅助
- `public/src/main.js`：应用状态与模式调度
