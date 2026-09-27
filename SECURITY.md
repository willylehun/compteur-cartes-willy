# Politique de sécurité

## Signaler une vulnérabilité

Ne publiez pas de secret, de donnée personnelle ou de procédure d'exploitation dans une issue publique. Utilisez la fonction privée « Report a vulnerability » de l'onglet Security du dépôt lorsqu'elle est disponible, ou contactez le propriétaire du dépôt par un canal privé.

Indiquez la version concernée, les étapes minimales de reproduction et l'impact observé. N'incluez que les données nécessaires à l'analyse.

## Périmètre

L'application est une PWA statique hébergée par GitHub Pages. Elle ne possède actuellement ni backend, ni compte utilisateur, ni base de données distante, ni collecte télémétrique.

Les données de partie sont locales à l'appareil. Aucun secret ne doit être ajouté au frontend ou aux fichiers publiés. Les futurs services distants devront conserver leurs clés privilégiées côté serveur et appliquer des permissions minimales.
