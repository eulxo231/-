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

Online uses the same approach as omok_s: host-authoritative 1:1 rooms over a public MQTT broker (`wss://broker.emqx.io:8084/mqtt`, topic `augment_chess/v1/{CODE}`). No custom game server or Render deploy. Host is White; guest is Black.

> Public HTTP relays (e.g. ntfy.sh) rate-limit too aggressively for realtime play, so MQTT is used for the room channel.

## Deploy

GitHub Pages can host the static client. Online rooms work there with no extra secrets or backend deploy.
