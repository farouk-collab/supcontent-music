# Separation Frontend / Backend

Le projet est deja structure en deux apps distinctes :

- `apps/web` : frontend
- `apps/api` : backend

La separation runtime est maintenant explicite :

- le frontend lit son backend cible via `apps/web/public/noyau/runtime-config.json`
- en dev, `scripts/dev-web-server.mjs` expose automatiquement cette config
- tu peux choisir une autre API sans modifier le code frontend

## Dev local

Backend :

```powershell
npm run dev:api
```

Frontend :

```powershell
$env:SUPCONTENT_API_BASE="http://localhost:1234"
npm run dev:web
```

Frontend ouvert sur :

```text
http://127.0.0.1:4173
```

## Changer l'API du frontend

Option 1 :

- modifier `apps/web/public/noyau/runtime-config.json`

Option 2 en dev :

- definir `SUPCONTENT_API_BASE` avant `npm run dev:web`

Exemple :

```powershell
$env:SUPCONTENT_API_BASE="https://mon-api.exemple.com"
npm run dev:web
```

## Impact

Le frontend n'est plus colle a une URL backend codee en dur.
Il peut etre servi seul, tant que l'API cible autorise le CORS et expose les routes attendues.
