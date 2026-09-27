# Counter By Willy

PWA mobile pour compter automatiquement les points d'une partie de cartes entre 2 et 4 joueurs.

## Fonctionnalités
- 2, 3 ou 4 joueurs
- Objectif 500, 1000 ou sans limite
- Saisie libre des points de chaque joueur, remise automatiquement à 0 après chaque manche
- Total actuel clairement visible à côté du nom de chaque joueur et mis à jour pendant la saisie
- Addition automatique des points au total de chaque joueur
- Rotation du donneur apprise sur les premières manches puis annoncée automatiquement
- Rotation vérifiée pour 2, 3 et 4 joueurs, avec un donneur explicite pour chaque manche
- Écran tactile interne pour choisir le distributeur, compatible avec l'application installée
- Mise à jour forcée de l'application installée sans perdre la partie en cours
- Validation tactile verrouillée à une seule manche et ouverture différée du choix du donneur suivant
- Question du donneur intégrée directement dans la page de manche et objectif sécurisé à 500, 1000 ou sans limite
- Réinitialisation complète de la question du donneur lors d'un retour à l'accueil ou du lancement d'une nouvelle partie
- Clic tactile natif sur les boutons de donneur et de validation, avec sauvegarde locale non bloquante
- Nom du distributeur affiché directement dans chaque manche en cours
- Total automatique et indicateur du joueur en tête
- Détection automatique du vainqueur quand l'objectif est atteint, avec confettis et classement final
- Bouton de fin de partie toujours disponible, y compris avec un objectif de points
- Fin immédiate au clic sur le bouton, même avant la première manche
- Déclenchement tactile renforcé pour l'application installée sur téléphone
- Écran de classement final indépendant du composant de dialogue du navigateur mobile
- Mise à jour réseau prioritaire des scripts et styles de la PWA
- Vérification automatique de la version au retour dans l'application installée
- Aucune actualisation forcée pendant la configuration ou une partie en cours
- Recalcul des totaux depuis l'historique lors de la reprise d'une partie
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
- CSP restrictive, Trusted Types et empreintes SRI pour verrouiller les scripts et styles exécutés
- Protections PWA contre les contenus externes, l'intégration en iframe et les permissions navigateur inutiles
- Validation défensive des données provenant du stockage local
- Aucune API, télémétrie, ressource CDN ou dépendance JavaScript tierce
- Politique de confidentialité publique, accessible depuis l'application
- Projet Android Trusted Web Activity préparé pour Google Play et l'API 36
- Design thème table de cartes et signature « by Willy »

## Test local
```bash
python -m http.server 8000
```
Puis ouvrir http://localhost:8000

## Vérifications locales
```bash
node --check bootstrap.js
node --check app.js
node --check sw.js
node --check scripts/render-assetlinks.mjs
node scripts/validate-release.mjs
node --test tests/game-logic.test.mjs
```

La politique de confidentialité publique se trouve dans `privacy.html`, sa documentation RGPD dans `PRIVACY.md` et les signalements de vulnérabilité dans `SECURITY.md`.

## Google Play

Le projet TWA se trouve dans `android/`. Les textes, le visuel promotionnel, la déclaration de sécurité des données et la checklist de soumission sont dans `play-store/`. Le workflow Android produit un AAB de contrôle non signé ; la clé d'envoi et l'empreinte Play App Signing ne doivent être ajoutées qu'après création du compte, hors du dépôt.

## GitHub Pages
Le dépôt contient les workflows Pages, Security, CodeQL et Android. Chaque push sur `main` valide la syntaxe, les contrôles de sécurité et la logique de jeu, lance l'analyse CodeQL, construit l'App Bundle Android de contrôle, puis publie uniquement une liste blanche de fichiers nécessaires à la PWA. Les actions tierces sont épinglées par SHA et les permissions sont séparées entre validation, analyse, construction et déploiement.
