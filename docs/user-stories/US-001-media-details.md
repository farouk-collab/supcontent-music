# US-001 - Details d'une musique

## Story
En tant qu'utilisateur, je veux ouvrir la page detail d'un media Spotify pour voir les informations utiles avant d'interagir.

## Criteres d'acceptation
1. La page affiche le nom, le type, l'identifiant et la couverture du media.
2. La page affiche une description courte, la popularite/ecoutes et le genre quand disponibles.
3. La page affiche l'audience (followers artiste) ou `Indisponible` si la donnee n'est pas recuperable.
4. Pour un track, la page affiche album, date de sortie, duree et explicite.
5. Un lien `Ouvrir sur Spotify` est affiche quand l'URL existe.

## Notes techniques
- Front: `apps/web/public/media/details.js`
- Orchestration: `apps/web/public/media.js`
- API media: `GET /media/:type/:id`
