# Checklist de publication Google Play

## Déjà préparé dans le dépôt

- [x] PWA HTTPS, installable et utilisable hors ligne
- [x] page de confidentialité publique
- [x] projet Android TWA ciblant l'API 37
- [x] nom de paquet préparé : `fr.bywilly.counter`
- [x] permission Internet uniquement et trafic HTTP en clair bloqué
- [x] icône adaptative Android
- [x] fiche Play en français et notes de version
- [x] déclaration de sécurité des données préparée
- [x] visuel promotionnel 1 024 × 500
- [x] workflow de lint et de construction d'un AAB de contrôle non signé
- [x] modèle et générateur validé pour Digital Asset Links

## En attente du compte Play Console et de l'identité de l'entreprise

- [ ] confirmer définitivement le nom de paquet avant le premier envoi
- [ ] créer et vérifier le compte développeur avec les informations légales demandées
- [ ] renseigner le nom public, l'adresse e-mail et les coordonnées d'assistance
- [ ] créer l'application dans Play Console
- [ ] activer Play App Signing
- [ ] créer une clé d'envoi, la sauvegarder hors du dépôt et ne jamais la commiter
- [ ] récupérer l'empreinte SHA-256 du certificat **Play App Signing**
- [ ] publier `/.well-known/assetlinks.json` sur `https://willylehun.github.io`
- [ ] vérifier Digital Asset Links et le mode TWA sans barre de navigateur
- [ ] produire un AAB signé avec la clé d'envoi
- [ ] compléter le questionnaire de classification du contenu
- [ ] confirmer la section Sécurité des données à partir du code final
- [ ] téléverser captures d'écran téléphone et visuel promotionnel
- [ ] effectuer les tests internes, fermés ou de production exigés pour le type de compte
- [ ] corriger tous les contrôles prépublication Play avant envoi en examen

## Contrôles juste avant chaque version

- [ ] la PWA et sa page de confidentialité sont accessibles publiquement en HTTPS
- [ ] la version Android pointe vers la même version PWA publiée
- [ ] `versionCode` est strictement supérieur au précédent
- [ ] les workflows Pages, Security, CodeQL et Android sont verts
- [ ] aucune donnée, clé ou fichier de signature n'est suivi dans Git
- [ ] la déclaration de confidentialité correspond encore aux SDK, permissions et flux réseau réels
