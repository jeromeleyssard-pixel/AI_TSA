API minimale proposée

Endpoints :
- GET /profile  -> renvoie le profil utilisateur (JSON)
- PUT /profile  -> met à jour le profil (JSON body)
- POST /ask     -> envoie un message au moteur d'aide. Body: {"message": "...", "mode": "standard|surcharge|planification"}

Paramètres optionnels :
- ?profil_contextuel=true pour que le serveur préfixe la réponse par le résumé du profil.

Notes d'intégration :
- Le serveur peut être relié à un fournisseur LLM (API) en remplaçant le module de génération local par un appel externe, en préfixant la requête avec `prompts/prompt_system.txt` et le profil utilisateur.
- Prévoir consentement utilisateur avant stockage côté serveur.
