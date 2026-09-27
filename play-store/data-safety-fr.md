# Déclaration de sécurité des données — préparation

Cette fiche décrit la version 1.0.0 telle qu'elle est actuellement codée. Elle doit être relue dans Play Console juste avant publication.

## Collecte et partage

- L'application collecte-t-elle des données utilisateur, au sens d'un envoi hors de l'appareil ? **Non**.
- L'application partage-t-elle des données avec des tiers ? **Non**.
- Les données sont-elles chiffrées en transit ? **Sans objet : aucune donnée utilisateur n'est transmise par l'application.** Les ressources de la PWA sont chargées exclusivement en HTTPS.
- L'utilisateur peut-il demander la suppression de données ? **Les données sont locales et peuvent être supprimées directement depuis l'application ou les réglages Android, sans demande à l'éditeur.**

## Données traitées localement

Les noms de joueurs, scores, manches, donneurs, statistiques et les vingt dernières parties restent dans le stockage local de l'appareil. Il n'y a ni compte, ni identifiant publicitaire, ni analyse d'audience, ni journalisation distante.

## SDK et permissions

- SDK publicitaire : aucun ;
- SDK d'analyse : aucun ;
- permission sensible : aucune ;
- permission Android déclarée : accès Internet uniquement, nécessaire pour charger et mettre à jour la PWA HTTPS.

Toute modification ultérieure ajoutant un backend, de la télémétrie, de la publicité ou un nouveau SDK impose une nouvelle analyse et une mise à jour de la déclaration avant publication.
