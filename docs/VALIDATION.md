# Validation et recette

## Résultats de référence

Validation exécutée le **15 juin 2026** sur Windows :

| Contrôle | Résultat |
|---|---|
| lint web | réussi |
| build API TypeScript | réussi |
| build web Vite | réussi |
| export web Expo | réussi |
| tests API | 9/9 réussis |
| tests web | 3/3 réussis |
| tests mobile | 2/2 réussis |
| `docker compose config` | réussi |
| images Docker API et web | construites |
| `docker compose up -d` | API, web, PostgreSQL, Redis et pgAdmin actifs |
| endpoint `/health` | HTTP 200, `{ "ok": true }` |
| APK Android release de test | construit |
| audit des dépendances de production | aucune alerte haute ou critique |

APK validé :

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
Taille : 56 376 727 octets
SHA-256 : 23F284B6AE301DD61199E102B73E94BD9FD4CDF0C1F46D58B3A84A6DC82A2FD5
```

L'APK de démonstration utilise le certificat Android de développement. Une
clé de signature privée dédiée doit être configurée avant une publication sur
Google Play.

L'audit conserve 12 alertes modérées transitives dans la chaîne Expo. Leur
correction proposée par npm implique une migration majeure vers Expo 56 ; elle
doit être réalisée dans une évolution dédiée pour éviter une régression mobile.

## Commande principale

```powershell
npm run check
```

Elle exécute :

1. lint du client React/Vite ;
2. compilation TypeScript de l'API ;
3. build web ;
4. export mobile Expo ;
5. tests API ;
6. tests web ;
7. tests mobiles.

## Tests automatisés

| Domaine | Vérification |
|---|---|
| API | santé du serveur et catalogue OpenAPI |
| OAuth | validation des redirections |
| Médias | détection des liens Spotify, YouTube et directs |
| Web | parsing des playlists et albums |
| Mobile | extraction des tokens du deep link Google |

## Recette fonctionnelle

### Authentification

- inscription avec un nouvel email ;
- refus d'un email déjà utilisé ;
- connexion avec mot de passe ;
- renouvellement automatique de session ;
- déconnexion ;
- retour OAuth vers le web et le mobile.

### Bibliothèque

- présence des quatre statuts ;
- création d'une liste privée et publique ;
- renommage et suppression ;
- ajout et retrait d'une œuvre.

### Social

- publication d'une critique ;
- commentaire et vote ;
- recherche et suivi d'un membre ;
- apparition d'une activité dans le fil ;
- réception d'une notification.

### Déploiement

```powershell
docker compose config
docker compose build
docker compose up
```

Après le démarrage :

```text
http://localhost:4173
http://localhost:1234/health
http://localhost:1234/docs
```

## Intégration continue

GitHub Actions exécute automatiquement l'installation, le lint, les builds et
les tests sur chaque pull request et chaque push vers `main`.
