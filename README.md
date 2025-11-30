
# TSA Assistant - Chat d'assistance pour personnes TSA/TDAH

Application web d'assistance conçue spécifiquement pour les personnes autistes (TSA) et/ou avec TDAH, avec adaptation personnalisée selon le profil utilisateur.

## 🎯 Mission

Fournir une interface simple et adaptative pour aider au quotidien les personnes neuroatypiques, avec des réponses personnalisées selon leur profil TSA/TDAH.

## ✨ Fonctionnalités

### 🧠 Intelligence Adaptative
- **Apprentissage continu** via feedback positif/négatif
- **Système à double mode** : heuristiques rapides + LLM (Mistral/Ollama)
- **Profils personnalisés** : TSA, TDAH, mixte avec adaptation fine
- **Quick actions intelligentes** selon les usages fréquents

### 🎨 Interface Conçue pour TSA/TDAH
- **Design épuré** : pas de surcharge visuelle
- **Contraste élevé** : lisibilité optimale
- **Messages d'attente** : gestion de l'anxiété
- **Format FALC** : phrases courtes et claires

### 🔧 Modes d'assistance
- **Standard** : aide générale au quotidien
- **Surcharge** : régulation émotionnelle et sensorielle
- **Planification** : micro-tâches et organisation

### 📊 Personnalisation
- **Questionnaire initial** : profil détaillé
- **Difficultés principales** : organisation, concentration, communication
- **Sensibilité aux stimulations** : adaptation environnementale
- **Préférences de format** : longueur, style de présentation

## 🚀 Installation

### Prérequis
- Node.js (v18 ou supérieur)
- Ollama (optionnel, pour LLM local)

### Installation rapide
```bash
# Cloner le repository
git clone https://github.com/jeromeleyssard-pixel/AI_TSA.git
cd AI_TSA

# Installer les dépendances
npm install

# Démarrer l'application
npm start
```

### Configuration Ollama (optionnel)
```bash
# Installer Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Télécharger Mistral
ollama pull mistral

# Activer dans l'application
export OLLAMA_ENABLED=true
export OLLAMA_MODEL=mistral
```

## 📱 Portabilité

### ✅ Ce qui fonctionne partout
- Interface web responsive
- Mode heuristiques (sans LLM)
- Gestion des profils locaux

### ⚠️ Limitations
- **Ollama** : desktop uniquement (Windows/Mac/Linux)
- **Données** : stockage local par défaut

### 🌐 Solutions de portabilité
1. **Version cloud** : API externe (OpenAI/Anthropic)
2. **Export/import** : transfert de profils
3. **Mode dégradé mobile** : heuristiques uniquement

## 🏗️ Architecture

```
├── index.js           # Backend Node.js/Express
├── public/
│   ├── chat.html      # Interface principale
│   ├── chat.js        # Frontend JavaScript
│   ├── chat.css       # Styles adaptés TSA/TDAH
│   └── onboarding.html # Questionnaire profil
├── data/              # Données locales (gitignored)
├── prompts/           # Templates pour LLM
├── onboarding/        # Questionnaire schema
└── schema/            # Validation JSON Schema
```

## 🔌 API Endpoints

### Chat
- `POST /ask` : Message utilisateur avec réponse adaptée
- `GET /profile` : Récupérer le profil utilisateur
- `PUT /profile` : Mettre à jour le profil

### Apprentissage
- `POST /feedback` : Feedback positif/négatif
- `POST /feedback/category` : Catégorisation via 👎
- `GET /examples` : Exemples appris

### Profil
- `GET /onboarding/schema` : Schema du questionnaire
- `POST /onboarding/submit` : Soumission profil

## 🧪 Mode dégradé

L'application fonctionne **sans LLM** avec :
- Heuristiques spécialisées TSA/TDAH
- Plans en 3 étapes contextuels
- Quick actions adaptatives
- Gestion de la surcharge émotionnelle

## 🎯 Utilisation

1. **Ouvrir** `http://localhost:3000` (page de chat par défaut)
2. **Compléter** le profil via "Éditer profil"
3. **Commencer** à discuter avec l'assistant adapté

### Modes d'assistance
- **Standard** : aide générale au quotidien
- **Surcharge** : régulation émotionnelle immédiate
- **Planification** : micro-tâches et organisation

## 🤝 Contribuer

1. Fork le repository
2. Créer une branche `feature/nom-de-la-feature`
3. Commit les changements
4. Push vers la branche
5. Ouvrir une Pull Request

## 📝 License

MIT License

## 🙏 Remerciements

- Communauté TSA/TDAH pour les retours et tests
- Contributeurs open source
- Testeurs neuroatypiques

---

**Important** : Cette application ne remplace pas un suivi médical ou psychologique. En cas de crise, contacter les services d'urgence.
