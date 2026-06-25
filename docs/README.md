# Documentation SUPCONTENT Music

Cette documentation accompagne la version consolidée des dépôts :

- `farouk-collab/supcontent-music`
- `Divine1012/supcontent-music`

La branche consolidée réunit le client web, l'application mobile Expo, l'API
Express TypeScript, PostgreSQL, Redis et les intégrations Spotify/OAuth.

## Documents

| Document | Contenu |
|---|---|
| [Architecture](ARCHITECTURE.md) | Composants, flux, choix techniques et sécurité |
| [Installation](INSTALLATION.md) | Développement, Docker, mobile et production |
| [Guide utilisateur](GUIDE_UTILISATEUR.md) | Parcours web, mobile et administration |
| [API](API.md) | Ressources REST, authentification et exemples |
| [Validation](VALIDATION.md) | Builds, tests, critères de recette et CI |
| [Diagrammes UML](uml/DIAGRAMMES.md) | Cas d'utilisation, classes, séquences, composants, déploiement et données |
| [Guide de soutenance](SOUTENANCE.md) | Démonstration conseillée et réponses techniques |
| [Fiche d'entrainement soutenance](FICHE_ENTRAINEMENT_SOUTENANCE.md) | Pitch, demo, questions probables et checklist du jour J |

## Résumé fonctionnel

SUPCONTENT Music propose :

- authentification par email, Google et GitHub ;
- recherche musicale et consultation des métadonnées Spotify ;
- bibliothèque avec statuts et collections personnalisées ;
- critiques, notes, votes et commentaires ;
- profils, abonnements, fil chronologique et notifications ;
- messagerie entre membres autorisés ;
- boutique de contenus musicaux ;
- paramètres, confidentialité et export des données ;
- modération et gestion administrative ;
- interfaces web responsive et mobile React Native.

## Organisation du monorepo

```text
apps/api       API REST Express + TypeScript
apps/web       application web et pages publiques
apps/mobile    application React Native / Expo
docs           documentation fonctionnelle et technique
tests          tests API, web et mobile
scripts        scripts de développement et d'installation
```
