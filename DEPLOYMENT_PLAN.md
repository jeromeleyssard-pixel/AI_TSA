# Plan de déploiement et progression des améliorations — TSA Assistant

Date: 2025-11-30 (mis à jour)

Objectif: fournir une progression claire, itérative et réversible pour améliorer la qualité des réponses en partant d'une base locale (heuristique + feedback), puis en ajoutant retrieval (RAG léger) et, si souhaité, un LLM local.

Priorités et phasage

## Phase 0 — Stabilisation (déjà réalisée)
- Application minimale locale sans dépendance à Ollama.
- Endpoints: `/ask`, `/feedback` (sauvegarde locale), onboarding et profil.
- UI: chat simplifié et boutons de feedback (👍/👎) par réponse.

## Phase 1 — Option A : Exemples positifs & endpoints (réalisée)
But: extraire rapidement les exemples « qui marchent » à partir des retours positifs pour améliorer les réponses.

Tâches réalisées:
- Création de `data/examples.json` (magasin d'exemples positifs).
- Endpoint `GET /examples` pour récupérer les paires (message → reply).
- Endpoint `POST /rebuild-index` pour reconstruire `examples.json` à partir de `data/feedback.json` (déduplication par texte de réponse).
- Les retours positifs (`helpful=true`) ajoutent automatiquement de nouveaux exemples (si non dupliqués).

État actuel supplémentaire (par rapport au plan initial):
- `/ask` côté Node a été enrichi avec une heuristique plus avancée:
  - prise en compte du profil utilisateur (longueur préf., format préf., besoin de validation émotionnelle),
  - détection simple de cas d’usage (organisation, communication, rendez-vous, routine, surcharge émotionnelle, autre),
  - réponses spécialisées par cas d’usage et modes (`standard`, `surcharge`, `planification`).

Bénéfices: permet d'avoir rapidement un corpus de bonnes réponses utilisables pour retrieval ou few-shot, et un comportement utile même sans LLM.

## Phase 2 — Retrieval-augmented generation (RAG) léger (en cours)
But: utiliser les exemples positifs pour fournir des réponses plus pertinentes sans entraînement.

### État actuel
- Un micro-service d'embeddings local existe déjà: `embeddings_service.py`.
  - Utilise `sentence-transformers` (modèle `all-MiniLM-L6-v2`).
  - Charge `data/examples.json` au démarrage.
  - Calcule et normalise les embeddings en mémoire.
  - Expose les endpoints:
    - `GET /health` pour vérifier l’état du service et le nombre d’exemples chargés.
    - `POST /reindex` pour recharger `examples.json` et recalculer les embeddings.
    - `POST /similar { "query": "...", "k": 5 }` pour retourner les top‑K exemples les plus proches avec leur score de similarité.

### Tâches restantes
- Câbler l’application Node à ce micro-service:
  - Ajouter dans `/ask` un appel HTTP à `POST http://127.0.0.1:8700/similar` avec le `message` de l’utilisateur.
  - Renvoyer dans la réponse JSON les top‑K exemples trouvés (champ `examples`), sans forcément les afficher tous côté UI au début.
  - Prévoir la gestion des erreurs (service down, pas d’exemples, etc.).
- Améliorer la qualité et la structure de `examples.json` pour un RAG plus pertinent:
  - Enrichir chaque exemple avec:
    - le cas d’usage détecté (`use_case`),
    - un snapshot minimal du profil (type de fonctionnement, longueur/format préférés, besoin de validation),
    - un score de qualité (basé sur le feedback positif/négatif et la récence).
  - Mettre en place des règles simples de nettoyage:
    - ignorer les réponses trop courtes ou trop génériques,
    - dédupliquer/mettre à jour les exemples très similaires,
    - optionnel: endpoint de maintenance pour purger les exemples de faible qualité.
- (Optionnel) Utiliser les exemples retournés par le service d’embeddings pour enrichir la réponse:
  - soit en les affichant dans l’UI comme « réponses similaires qui ont bien aidé d’autres personnes »,
  - soit en les injectant comme contexte/few‑shot dans le prompt envoyé à un LLM (lorsque activé).

## Phase 3 — LLM local quantifié + LoRA (long terme, à planifier)
But: disposer d'un modèle génératif local personnalisé sur le style/contraintes TSA/TDAH, en s’appuyant sur le corpus d’exemples positifs.

Tâches proposées (inchangées, mais à réaliser plus tard):
- Installer `llama.cpp` / `ctransformers` ou un runtime Windows compatible.
- Télécharger un modèle 7B quantifié (ggml) compatible (ex: vicuna-7b-ggml-q4*), vérifier la licence.
- Optionnel: collecter un dataset d'exemples positifs (depuis `examples.json`) et faire un fine-tuning LoRA pour adapter le style et les comportements.
- Déployer le modèle local et remplacer (ou combiner) la logique heuristique par une génération RAG + LLM (en conservant les garde-fous éthiques et de sécurité décrits ci-dessous).

Sécurité, éthique et licences
- Toujours vérifier la licence du modèle utilisé (LLaMA/Llama2, Mistral, Falcon, etc.).
- Ne pas envoyer de données sensibles à des services tiers sans consentement explicite.
- Conserver les données localement par défaut; prévoir des mécanismes d'export et de purge.

Plan de livrables et délai estimé (révisé)
- J+0 (immédiat) :
  - Option A — exemples export + endpoints (fait).
  - Amélioration heuristique de `/ask` alignée avec le profil TSA/TDAH (fait).
- J+1–3 :
  - Lancer et stabiliser le micro-service d’embeddings `embeddings_service.py` (fait côté code, à automatiser côté run si besoin).
  - Câbler `/ask` au service d’embeddings pour retourner les top‑K exemples (à faire).
  - Commencer à enrichir la structure de `examples.json` (use_case, profil, score) pour un RAG de meilleure qualité (à faire).
- J+4–10 :
  - Expérimenter l’intégration d’un petit LLM local quantifié (7B) pour la génération complète, si le matériel le permet.
  - Tester la combinaison heuristique + RAG + LLM en gardant les contraintes TSA/TDAH (structure des réponses, validation émotionnelle, modes surcharge/planification).

Commandes utiles (Windows PowerShell)
- Installer Python + virtualenv (recommandé pour embeddings):
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install sentence-transformers faiss-cpu flask
```
- Rebuild des exemples via l'API (local):
```powershell
Invoke-RestMethod -Uri http://localhost:3000/rebuild-index -Method Post
```

Proposition immédiate suivante
- Poursuivre l’intégration RAG léger:
  - Câbler `/ask` au micro-service d’embeddings pour retourner les top‑K exemples.
  - Commencer à enrichir/structurer `examples.json` afin d’améliorer progressivement la pertinence des suggestions.

---

Fin du plan.
