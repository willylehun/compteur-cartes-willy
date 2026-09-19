# Counter By Willy

PWA mobile pour compter automatiquement les points d'une partie de cartes entre 2 et 4 joueurs.

## Fonctionnalités
- 2, 3 ou 4 joueurs
- Objectif 500, 1000 ou sans limite
- Saisie d'une manche complète en une fois
- Scores positifs ou négatifs et boutons rapides
- Total automatique et indicateur du joueur en tête
- Détection automatique du vainqueur quand l'objectif est atteint
- Annulation de la dernière manche
- Historique détaillé des manches
- Sauvegarde automatique d'une partie en cours
- Mémorisation des noms déjà utilisés
- Statistiques : participations, victoires et taux de victoire
- Historique des 20 dernières parties terminées
- PWA installable sur Android et iPhone
- Fonctionnement hors ligne après la première ouverture
- Design thème table de cartes et signature « by Willy »

## Test local
```bash
python -m http.server 8000
```
Puis ouvrir http://localhost:8000

## GitHub Pages
Le dépôt contient `.github/workflows/pages.yml`, basé sur le workflow GitHub Pages pour contenu statique. Une fois Pages configuré avec GitHub Actions, chaque push sur `main` redéploie l'application.
