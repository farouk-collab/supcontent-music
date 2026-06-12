# Web

Frontend web de SUPCONTENT Music.

## Lancement local

```bash
npm --workspace apps/web run dev:static
```

## Build

```bash
npm --workspace apps/web run build
```

## Configuration

Variable utile :

- `SUPCONTENT_API_BASE`

Le frontend lit aussi `public/noyau/runtime-config.json` pour connaitre l'URL de l'API.

## Deploy Vercel

- Root directory: `apps/web`
- Build command: `npm run build`
- Output directory: `dist`
- Variable d'environnement: `SUPCONTENT_API_BASE`
