# Augment Chess

Vite + React chess variant with card draft and online rooms.

## Local

```bash
npm install
npm run dev
```

- Client: http://localhost:5173/
- WebSocket server: `ws://localhost:3001`

**Local** mode is hotseat (no server). **Online** needs the WebSocket server (`npm run dev` starts both).

## Online on GitHub Pages

GitHub Pages only hosts the static client. Online rooms need a separate WebSocket host.

### 1. Deploy the game server (Render)

1. Open [https://render.com](https://render.com) and connect this repo.
2. Create a **Web Service** from `render.yaml` (or use Blueprint).
3. After deploy, copy the service URL and switch `https://` → `wss://`  
   Example: `wss://augment-chess-ws.onrender.com`

Free Render services sleep when idle; the first connect after sleep can take ~30–60s.

### 2. Point the Pages build at that server

In the GitHub repo: **Settings → Secrets and variables → Actions**

- Name: `VITE_WS_URL`
- Value: `wss://your-service.onrender.com` (no trailing slash)

Push to `master` (or re-run the Deploy workflow). The client will use that URL for Online mode.
