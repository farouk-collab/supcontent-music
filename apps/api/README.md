# API

Backend Express + TypeScript de SUPCONTENT Music.

## Lancement local

```bash
npm --workspace apps/api run dev
```

## Build

```bash
npm --workspace apps/api run build
npm --workspace apps/api run start
```

## Variables principales

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`

## Deploy Render

- Root directory: `apps/api`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Health check: `/health`
