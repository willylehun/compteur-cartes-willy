# Application Android

Ce module transforme la PWA publiée en Trusted Web Activity (TWA). Il ne duplique ni la logique métier ni le stockage des parties.

## Paramètres préparés

- identifiant Android : `fr.bywilly.counter` ;
- `compileSdk` et `targetSdk` : API 36 ;
- Android Browser Helper : 2.7.3 ;
- URL : `https://willylehun.github.io/compteur-cartes-willy/?app=v24` ;
- permission unique : accès Internet ;
- trafic HTTP en clair, sauvegardes Android et permissions sensibles désactivés.

L'identifiant Android est définitif après le premier envoi dans Play Console. Il faut donc confirmer `fr.bywilly.counter` avant cet envoi.

## Construction de contrôle

Le workflow `Android release validation` construit automatiquement un App Bundle de contrôle non signé. Localement, avec JDK 17, Android SDK 36 et Gradle 9.4.1 :

```bash
gradle --no-daemon :app:lintRelease :app:bundleRelease
```

## Signature et association au site

Ne créez pas de clé dans le dépôt. Lorsque le compte Play Console sera disponible :

1. activer Play App Signing et créer une clé d'envoi conservée hors du dépôt ;
2. récupérer dans Play Console l'empreinte SHA-256 du **certificat de signature de l'application** ;
3. générer `assetlinks.json` avec `node ../scripts/render-assetlinks.mjs EMPREINTE_SHA256` ;
4. publier ce fichier à la racine du domaine, à l'adresse `https://willylehun.github.io/.well-known/assetlinks.json` ;
5. vérifier l'association avant d'envoyer le bundle signé.

Sans cette empreinte, l'application reste fonctionnelle mais s'ouvre comme un onglet personnalisé avec sa barre de navigateur : c'est normal et volontaire jusqu'à l'association définitive.
