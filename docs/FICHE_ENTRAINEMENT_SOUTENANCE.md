# Fiche d'entrainement - Soutenance SUPCONTENT Music

Date de passage : 25 juin 2026

## Verdict rapide

Le projet est pret pour une presentation de soutenance : le depot est propre,
le dernier commit est pousse sur `farouk-collab/supcontent-music`, Docker
demarre les services, les tests passent et une recette automatisee verifie les
parcours principaux avec deux comptes.

Il faut presenter l'application comme un projet fonctionnel de demonstration,
pas comme un produit commercial deja pret pour une mise en production publique.
Les limites restantes sont normales : paiement reel, secrets OAuth/SMTP reels,
signature Android de production, iOS et deploiement HTTPS.

## Pitch en 30 secondes

SUPCONTENT Music est une application web et mobile de reseau social musical.
Elle permet de rechercher des musiques, de gerer sa bibliotheque, de publier des
critiques, de suivre d'autres utilisateurs, de discuter, de recevoir des
notifications et d'utiliser une boutique de contenus musicaux. Le projet repose
sur une API Express TypeScript, une base PostgreSQL, Redis pour le cache, un
client web, une application mobile Expo et un environnement Docker complet.

## Pitch en 1 minute

Notre idee etait de construire une plateforme musicale communautaire qui
regroupe plusieurs usages : decouverte musicale, bibliotheque personnelle,
avis, social, messagerie et boutique. L'utilisateur peut creer un compte,
chercher un titre ou un artiste, l'ajouter a une collection, publier une
critique, suivre d'autres membres et recevoir des notifications en temps reel.

Techniquement, nous avons separe les responsabilites : le web et le mobile
consomment la meme API REST, l'API gere les regles metier et la securite, puis
PostgreSQL conserve les donnees applicatives. Redis sert a limiter les appels
externes et Docker permet de lancer tout le projet de facon reproductible.

## Plan de passage conseille

1. Presenter le besoin : une plateforme musicale sociale, pas seulement un
   lecteur de musique.
2. Montrer l'architecture : web + mobile -> API -> PostgreSQL/Redis/services.
3. Faire une connexion ou inscription.
4. Rechercher une oeuvre musicale.
5. Ajouter une oeuvre a la bibliotheque.
6. Publier une critique et un commentaire.
7. Suivre un utilisateur, montrer le fil et les notifications.
8. Ouvrir le chat ou expliquer la messagerie.
9. Montrer la boutique : produit, panier, commande de demonstration.
10. Terminer par Docker, Swagger, tests et diagrammes UML.

## Demo minute par minute

### 0:00 - 1:00 : Introduction

Phrase possible :

> Bonjour, nous allons presenter SUPCONTENT Music, une application web et
> mobile qui melange recherche musicale, bibliotheque personnelle, critiques,
> reseau social et boutique pour createurs.

Insister sur :

- projet full-stack ;
- web + mobile ;
- parcours utilisateur complet ;
- API commune ;
- Docker et tests.

### 1:00 - 2:30 : Architecture

Montrer ou expliquer :

- client web ;
- application mobile Expo ;
- API Express TypeScript ;
- PostgreSQL ;
- Redis ;
- services externes : Spotify, OAuth Google/GitHub, SMTP.

Phrase possible :

> Nous avons volontairement place une API entre les clients et les services
> externes. Cela protege les secrets, centralise les regles metier et permet au
> web et au mobile de partager les memes donnees.

### 2:30 - 5:30 : Parcours utilisateur principal

Demo conseillee :

1. ouvrir `http://localhost:4173` ;
2. se connecter avec un compte de demo ;
3. aller dans la recherche ;
4. chercher un artiste, un titre ou un album ;
5. ouvrir une fiche ;
6. ajouter a une collection ;
7. publier une critique.

Ce qu'il faut dire :

> Ici, on voit le coeur fonctionnel : l'utilisateur decouvre une oeuvre, la
> classe dans sa bibliotheque et participe a la communaute avec une critique.

### 5:30 - 7:30 : Social et notifications

Demo conseillee :

1. montrer la recherche de membres ;
2. suivre un utilisateur ;
3. montrer le feed ;
4. expliquer les notifications temps reel.

Phrase possible :

> Les notifications utilisent un flux SSE authentifie. Quand un utilisateur
> recoit un abonne, une reponse ou un message, le client est averti sans devoir
> attendre un rafraichissement manuel.

### 7:30 - 9:00 : Boutique

Demo conseillee :

1. ouvrir la boutique ;
2. afficher un produit ;
3. ajouter au panier ;
4. confirmer une commande.

Important :

> Le paiement est une commande de demonstration. Pour une vraie production, il
> faudrait connecter Stripe ou un autre prestataire de paiement.

### 9:00 - 10:30 : Mobile

Si le mobile est disponible :

- montrer l'APK ou Expo ;
- connexion ;
- recherche ;
- bibliotheque ;
- profil ou boutique.

Si le telephone ne marche pas :

> Le mobile partage la meme API que le web. Nous avons valide le build Expo et
> l'APK Android de demonstration. Les fonctionnalites principales sont alignees
> avec le web : authentification, recherche, bibliotheque, critiques, feed,
> notifications et boutique.

### 10:30 - 12:00 : Qualite, tests et conclusion

Dire :

- `npm run check` passe ;
- tests API : 9/9 ;
- tests web : 3/3 ;
- tests mobile : 2/2 ;
- Docker Compose lance API, web, PostgreSQL, Redis et pgAdmin ;
- recette automatisee avec deux comptes reussie.

Phrase de conclusion :

> Le projet repond au cahier des charges principal : il propose une application
> musicale sociale fonctionnelle, structuree en architecture client-serveur,
> testable localement avec Docker et documentee avec des diagrammes UML.

## Commandes utiles avant de passer

```powershell
docker compose up -d
```

```powershell
Invoke-RestMethod http://localhost:1234/health
```

```powershell
npm run verify:e2e
```

```powershell
npm run check
```

URLs a ouvrir :

- Web : `http://localhost:4173`
- API health : `http://localhost:1234/health`
- Swagger : `http://localhost:1234/docs`
- pgAdmin : `http://localhost:5050`

## Fonctionnalites a citer

### Authentification

- inscription ;
- connexion ;
- refresh token ;
- deconnexion ;
- reset password avec SMTP ;
- OAuth Google/GitHub si les cles sont configurees.

### Recherche musicale

- recherche titre, artiste, album ;
- integration Spotify ;
- cache Redis ;
- affichage detail media.

### Bibliotheque

- collections par defaut ;
- collections personnalisees ;
- ajout et retrait d'oeuvres ;
- statuts d'ecoute.

### Critiques et social

- notes et critiques ;
- commentaires ;
- votes ;
- abonnements ;
- feed ;
- notifications temps reel.

### Chat

- conversations entre utilisateurs autorises ;
- messages texte ;
- notifications de nouveau message.

### Boutique

- catalogue produit ;
- favoris ;
- panier ;
- checkout de demonstration ;
- publication de produit.

### Administration

- signalements ;
- suppression de contenu ;
- ban utilisateur ;
- roles.

## Questions probables du jury

### Pourquoi avoir choisi une API REST ?

Parce qu'elle permet de partager la meme logique entre le web et le mobile. Elle
centralise aussi la securite, les validations et les acces a la base.

### Pourquoi PostgreSQL ?

Les donnees ont beaucoup de relations : utilisateurs, abonnements, collections,
critiques, commentaires, messages et commandes. PostgreSQL gere bien les
relations, les transactions et les contraintes.

### Pourquoi Redis ?

Redis sert de cache pour limiter les appels repetes vers Spotify et ameliorer
les temps de reponse.

### Comment les mots de passe sont-ils proteges ?

Ils sont haches avec bcrypt. Les sessions utilisent des access tokens courts et
des refresh tokens revocables.

### Pourquoi SSE pour les notifications ?

SSE est plus simple que WebSocket pour un flux serveur vers client. Pour des
notifications comme nouvel abonne, reponse ou message recu, c'est suffisant et
facile a maintenir.

### Est-ce que l'application est terminee ?

Pour une soutenance et une demonstration fonctionnelle, oui. Pour une production
commerciale, il reste a brancher les vrais secrets, le paiement reel, HTTPS, la
signature Android de production et une recette iOS.

### Qu'est-ce qui est le plus solide techniquement ?

L'architecture monorepo, l'API TypeScript, les validations Zod, la separation
web/mobile/API, Docker Compose, la documentation UML et la recette automatisee
avec deux comptes.

### Qu'est-ce qui pourrait etre ameliore ?

- paiement reel ;
- notifications push natives ;
- migration Expo majeure ;
- deploiement cloud complet ;
- tests end-to-end visuels ;
- meilleure observabilite en production.

## Reponses courtes a memoriser

- "Le web et le mobile partagent la meme API."
- "PostgreSQL stocke nos donnees metier, Redis optimise les appels externes."
- "Les secrets ne sont pas dans Git, ils passent par les variables d'environnement."
- "Le paiement est une simulation de commande, pas une transaction bancaire."
- "Les notifications temps reel utilisent SSE."
- "Docker permet de lancer un environnement complet et reproductible."
- "La recette automatisee verifie un parcours avec deux utilisateurs."

## Repartition possible entre membres

| Partie | Personne | Objectif |
|---|---|---|
| Introduction et besoin | Membre 1 | expliquer le probleme et la cible |
| Demo web | Membre 2 | montrer recherche, bibliotheque, critiques |
| API et base de donnees | Membre 3 | expliquer REST, PostgreSQL, securite |
| Mobile, Docker et tests | Membre 4 | montrer validation, mobile, qualite |

## Mini-script final

> Pour conclure, SUPCONTENT Music est une application musicale sociale
> complete pour une demonstration de soutenance. Elle couvre l'authentification,
> la recherche musicale, la bibliotheque, les critiques, le social, les
> notifications, le chat, la boutique et l'administration. Le projet est lance
> avec Docker, teste automatiquement et documente avec des diagrammes UML. Les
> prochaines evolutions seraient le paiement reel, le deploiement HTTPS et la
> publication mobile en production.

## Checklist 30 minutes avant le passage

- `docker compose up -d` lance ;
- `http://localhost:4173` ouvre le site ;
- `http://localhost:1234/health` renvoie `{ "ok": true }` ;
- deux comptes de demo prets ;
- une recherche musicale preparee ;
- un produit boutique prepare ;
- Swagger ouvert dans un onglet ;
- diagrammes UML ouverts dans `docs/uml/DIAGRAMMES.md` ;
- telephone ou plan B mobile pret ;
- roles de presentation repartis.

