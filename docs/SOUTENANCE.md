# Guide de soutenance

## Démonstration conseillée

Durée idéale : 8 à 12 minutes.

1. Présenter le besoin et l'architecture.
2. Créer un compte ou se connecter avec Google.
3. Rechercher un artiste ou un titre.
4. Ouvrir la fiche et publier une critique.
5. Ajouter l'œuvre à une collection.
6. Rechercher un membre et le suivre.
7. Montrer le fil et les notifications.
8. Ajouter un produit de la boutique au panier.
9. Montrer les mêmes fonctions principales sur mobile.
10. Terminer par Swagger, Docker et les diagrammes UML.

## Répartition possible

| Partie | Présentateur |
|---|---|
| contexte et UX | membre 1 |
| web et fonctionnalités | membre 2 |
| API, base et sécurité | membre 3 |
| mobile, Docker et tests | membre 4 |

## Questions techniques

### Pourquoi une API intermédiaire ?

Elle protège les clés externes, centralise les règles métier et donne la même
source de données au web et au mobile.

### Pourquoi PostgreSQL ?

Les utilisateurs, abonnements, listes, critiques et messages forment des
relations fortes qui profitent des clés étrangères et des transactions.

### Pourquoi Redis ?

Il réduit le nombre d'appels Spotify, améliore les temps de réponse et limite
les risques de rate limiting.

### Comment la session est-elle sécurisée ?

Le mot de passe est haché. L'access token est court. Le refresh token est
persisté et peut être révoqué lors de la déconnexion ou d'un changement de
mot de passe.

### Quelle différence entre web et mobile ?

Ce sont deux clients distincts partageant l'API et les règles métier. Le web
offre les outils avancés d'administration et de personnalisation, tandis que
le mobile privilégie les parcours quotidiens.

## Préparation avant passage

- configurer les variables OAuth ;
- préparer deux comptes de démonstration ;
- démarrer Docker avant la présentation ;
- vérifier `/health` et `/docs` ;
- installer l'APK sur un téléphone ou préparer Expo Go ;
- conserver quelques données de démonstration en base ;
- exporter les diagrammes Mermaid dans le rapport final.

