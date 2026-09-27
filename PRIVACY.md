# Confidentialité et préparation RGPD

## Fonctionnement actuel

Counter By Willy ne possède aucun backend, ne contacte aucune API tierce et n'intègre aucun outil de suivi, de publicité ou d'analyse d'audience.

Les seules informations enregistrées sont les noms saisis par les joueurs, les scores, les manches, le donneur, les statistiques de parties et l'historique des vingt dernières parties. Elles restent dans le stockage local du navigateur ou de l'application installée et ne sont pas transmises à Willy, à GitHub ou à un tiers par le code de l'application.

L'utilisateur peut supprimer les statistiques et l'historique depuis l'application. La suppression des données du site dans les réglages du navigateur efface également les données locales restantes.

## Principes pour une future collecte

Une future collecte de statistiques devra être désactivée par défaut tant qu'un consentement valide n'aura pas été obtenu lorsqu'il est requis. Elle devra :

- définir une finalité précise et compréhensible ;
- limiter les données au strict nécessaire ;
- éviter les noms de joueurs, identifiants persistants et techniques de fingerprinting ;
- privilégier des données agrégées ou anonymisées ;
- annoncer la durée de conservation et permettre le retrait du consentement ;
- fournir une information RGPD accessible avant tout envoi ;
- utiliser un backend à privilèges minimaux, sans clé secrète dans le frontend ;
- documenter les sous-traitants, transferts éventuels et mesures de sécurité.

Ce document prépare ces exigences mais n'active aucune collecte. La version publique destinée aux utilisateurs et à Google Play est `privacy.html`.
