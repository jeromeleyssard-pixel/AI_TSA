
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

## 🌐 Version Cloud (Mobile/Desktop)

La version cloud permet d'utiliser l'application sur **tous les appareils** (smartphone, tablette, desktop) avec des APIs externes.

### ⚡ Installation rapide (Cloud)

```bash
# Cloner et installer
git clone https://github.com/jeromeleyssard-pixel/AI_TSA.git
cd AI_TSA
git checkout cloud-version
npm install

# Configurer une API (OpenAI recommandé)
# 1. Allez sur https://platform.openai.com/api-keys
# 2. Créez une clé API
# 3. Démarrez l'application:
npm start
# 4. Ouvrez http://localhost:3000/cloud-config
# 5. Entrez votre clé et testez
```

### 🔑 Fournisseurs supportés

#### 🤖 **OpenAI (Recommandé)**
- **Modèle** : GPT-4o-mini (rapide, économique)
- **Coût** : ~$0.15 pour 1000 conversations
- **Avantages** : Fonctionne partout, rapide, fiable
- **Inconvénients** : Payant

#### 🧠 **Anthropic Claude**
- **Modèle** : Claude 3 Haiku (empathique)
- **Coût** : ~$0.25 pour 1000 conversations  
- **Avantages** : Excellent pour l'émotionnel
- **Inconvénients** : Payant

#### 🏠 **Ollama Local (Fallback)**
- **Modèle** : Mistral (gratuit)
- **Coût** : Gratuit
- **Avantages** : 100% privé, gratuit
- **Inconvénients** : Desktop uniquement

### 📱 Portabilité

| Fonctionnalité | Local (Ollama) | Cloud (OpenAI/Anthropic) |
|----------------|----------------|---------------------------|
| **Desktop** | ✅ | ✅ |
| **Smartphone** | ❌ | ✅ |
| **Tablette** | ❌ | ✅ |
| **Coût** | Gratuit | Payant (~$0.15/1000 msgs) |
| **Confidentialité** | 100% locale | API externe |
| **Vitesse** | Moyenne | Rapide |

### 🚀 Déploiement Cloud

#### Option 1: **Développement local**
```bash
npm start
# Ouvrir http://localhost:3000
```

#### Option 2: **Vercel (Recommandé)**
```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel
```

#### Option 3: **Railway/Render**
```bash
# Connecter repository
# Déployer automatiquement
```

### 🔧 Configuration avancée

Pour la production, utilisez des variables d'environnement:

```bash
# OpenAI
export OPENAI_API_KEY="sk-your-key"
export OPENAI_MODEL="gpt-4o-mini"

# Anthropic  
export ANTHROPIC_API_KEY="sk-ant-your-key"
export ANTHROPIC_MODEL="claude-3-haiku-20240307"

# Port
export PORT=3000
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

### Auteurs et Supervision
- **Jérôme Leyssard** - Développeur principal  
  📧 jeromeley.apps@gmail.com
- **Dr. Laurie Centelles, PhD** - Supervision scientifique  
  Docteure en Sciences de la Cognition

### Projets Open Source
Un grand merci aux projets exceptionnels qui rendent cette application possible :
- **[Ollama](https://ollama.ai)** - Exécution locale de modèles LLM
- **[Mistral AI](https://mistral.ai)** - Modèles de langue performants
- **[OpenAI](https://openai.com)** - API GPT-4 pour version cloud
- **[Anthropic](https://anthropic.com)** - Claude 3 pour conversations empathiques

### Communauté
- Communauté TSA/TDAH pour les retours et tests
- Testeurs neuroatypiques pour leur précieux feedback
- Contributeurs open source

---

## 📝 License

MIT License

---

**Important** : Cette application ne remplace pas un suivi médical ou psychologique. En cas de crise, contacter les services d'urgence.
