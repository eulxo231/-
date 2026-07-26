# Augment Chess

Vite + React chess variant with card draft and online rooms.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:5173/

- **Local** — hotseat on one device
- **Online** — create a 4-character room code and share it; the second player joins with that code

Online uses plain **HTTP** (SSE subscribe + POST publish via [ntfy.sh](https://ntfy.sh)). No WebSockets, no Render, no custom game server. Host (White) is authoritative; guest is Black.

## Deploy

GitHub Pages can host the static client. Online rooms work there with no extra secrets or backend deploy.
