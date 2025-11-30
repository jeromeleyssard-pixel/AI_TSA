TSA Assistant — Démarrage rapide

But : Permettre à un testeur non technique de démarrer l'application localement et d'essayer le chat + la page admin.

Pré-requis (sur Windows)
- Python 3.8+ installé et accessible via la commande `python`.
- Node.js v16+ et `npm` installés.
- Autoriser l'exécution de scripts PowerShell pour l'utilisateur courant si bloqué :
  - Ouvrir PowerShell en mode utilisateur puis exécuter :
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

Étapes simples (recommandées)
1) Ouvrir PowerShell et aller dans le dossier du projet :
   cd C:\AI\tsa-assistant

2) Lancer le script tout-en-un qui prépare l'environnement et démarre les services :
   .\run-all.ps1

   Le script va :
   - créer/activer un environnement Python `.venv` si nécessaire
   - installer les dépendances Python listées dans `embeddings-requirements.txt`
   - exécuter `npm install` si `node_modules` manquent
   - ouvrir deux fenêtres PowerShell : une pour le service d'embeddings, une pour le serveur Node
   - ouvrir automatiquement l'interface admin dans votre navigateur par défaut

3) Une fois l'interface admin ouverte (http://localhost:3000/admin) :
   - Cliquez "Rafraîchir" pour voir les exemples et feedbacks.
   - Cliquez "Rebuild examples" pour reconstruire les exemples depuis les feedbacks.
   - Cliquez "Reindex embeddings" pour demander au service d'embeddings de recharger son index.

4) Ouvrir la page chat : http://localhost:3000/chat.html
   - Cliquez "Éditer profil" et remplissez quelques champs.
   - Envoyez un message test dans le chat.
   - Cliquez 👍 sous une réponse utile pour alimenter les exemples automatisés.

Commandes de test rapides (option manuel)
- Démarrer seulement le service embeddings (après activation du venv) :
  python .\embeddings_service.py

- Démarrer uniquement le serveur Node (si les dépendances sont déjà installées) :
  npm start

- Rebuild examples via API :
  Invoke-RestMethod -Uri http://localhost:3000/rebuild-index -Method Post

- Reindex embeddings (direct) :
  Invoke-RestMethod -Uri http://127.0.0.1:8700/reindex -Method Post

- Tester endpoint /ask :
  Invoke-RestMethod -Uri http://localhost:3000/ask -Method Post -ContentType 'application/json' -Body (@{ message = 'Test de concentration'; mode='standard' } | ConvertTo-Json)

Dépannage
- Si pip signale une mise à jour : exécuter `python -m pip install --upgrade pip` (dans le venv activé).
- Si `pip install torch` échoue : suivez les instructions officielles de PyTorch pour Windows (https://pytorch.org/get-started/locally/). Vous pouvez installer la variante CPU si vous n'avez pas GPU.
- Si PowerShell empêche l'exécution des scripts, utilisez :
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

Contact rapide
- Si le testeur bloque, donner une procédure courte (par ex. ouvrir deux fenêtres PowerShell et partager un écran) peut accélérer le test.

Merci — ce guide est volontairement minimal pour limiter les étapes pour un testeur non-technique.