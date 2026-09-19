# Counter By Willy

PWA mobile pour compter automatiquement les points d'une partie de cartes entre 2 et 4 joueurs.

## Fonctionnalités
- 2, 3 ou 4 joueurs
- Objectif 500, 1000 ou sans limite
- Saisie libre des points de chaque joueur, remise automatiquement à 0 après chaque manche
- Total actuel clairement visible à côté du nom de chaque joueur et mis à jour pendant la saisie
- Addition automatique des points au total de chaque joueur
- Rotation du donneur apprise sur les premières manches puis annoncée automatiquement
- Nom du distributeur affiché directement dans chaque manche en cours
- Total automatique et indicateur du joueur en tête
- Détection automatique du vainqueur quand l'objectif est atteint, avec confettis et classement final
- Bouton de fin de partie toujours disponible, y compris avec un objectif de points
- Fin immédiate au clic sur le bouton, même avant la première manche
- Déclenchement tactile renforcé pour l'application installée sur téléphone
- Écran de classement final indépendant du composant de dialogue du navigateur mobile
- Mise à jour réseau prioritaire des scripts et styles de la PWA
- Vérification automatique de la version au retour dans l'application installée
- Icône SVG identique pour le bouton des statistiques sur le web et sur téléphone
- Bouton de reprise affiché uniquement après le rechargement d'une partie réellement inachevée
- Classement final affiché même lorsque plusieurs joueurs terminent à égalité
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
