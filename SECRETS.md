# Gérer les Clés API de Manière Sécurisée

Ce document explique comment gérer votre clé API (`LLM_API_KEY`) pour ce projet, en distinguant l'environnement de développement local de l'environnement de production (lorsque votre application est en ligne).

## Le Problème avec les Fichiers `.env`

Actuellement, vous utilisez un fichier `/server/.env` pour stocker votre clé API. C'est une excellente pratique pour le **développement local**, car cela permet de séparer les secrets du code.

Cependant, cette méthode présente des risques si elle est mal gérée :

1.  **Risque de publication accidentelle** : Si le fichier `.env` n'est pas listé dans votre `.gitignore`, il pourrait être envoyé sur votre dépôt GitHub, rendant votre clé visible par tous.
2.  **Manque de flexibilité en production** : Lorsque vous déploierez votre application sur un hébergeur (comme Vercel, Netlify, Heroku, AWS, etc.), vous n'aurez généralement pas la possibilité de déposer un fichier `.env` manuellement.

## La Solution : Les Variables d'Environnement

La méthode standard et sécurisée pour gérer les clés API est d'utiliser des **variables d'environnement** directement fournies par votre hébergeur.

### Comment ça fonctionne ?

Le code de l'application (`server/index.js`) est configuré pour lire la clé API depuis `process.env.LLM_API_KEY`.

```javascript
// server/index.js
const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
});
```

-   **En local**, le paquet `dotenv` charge les variables de votre fichier `.env` dans `process.env`.
-   **En production**, votre hébergeur injecte directement les variables que vous avez configurées dans `process.env`.

Le code fonctionne donc de la même manière dans les deux contextes, sans aucune modification nécessaire.

### Instructions pour la Production

Lorsque vous déploierez votre application, suivez ces étapes :

1.  **Connectez-vous au tableau de bord de votre hébergeur** (par exemple, Vercel, Netlify, etc.).
2.  **Trouvez la section "Environment Variables"** dans les paramètres de votre projet. On la trouve souvent sous des noms comme "Settings > Environment Variables" ou "Deploy > Environment".
3.  **Ajoutez une nouvelle variable d'environnement** :
    -   **Nom (Key)** : `LLM_API_KEY`
    -   **Valeur (Value)** : Collez ici votre clé API secrète (celle qui commence par `sk-...`).

Une fois enregistrée, votre application redémarrera et utilisera automatiquement cette clé pour communiquer avec l'API d'OpenAI. Votre clé n'est jamais visible dans votre code et reste stockée de manière sécurisée chez votre hébergeur.

### Rappel pour la Sécurité

Assurez-vous que votre fichier `.gitignore` à la racine du projet contient bien la ligne suivante pour éviter toute fuite accidentelle :

```
.env
```

De cette façon, même si vous créez d'autres fichiers `.env` à l'avenir, ils ne seront jamais suivis par Git.

En suivant ces instructions, vous vous assurez que votre clé API reste privée et sécurisée, tout en permettant à votre application de fonctionner parfaitement en local comme en production.