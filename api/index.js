const express = require('express');
const path = require('path');
const fs = require('fs');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const bodyParser = require('body-parser');
const cors = require('cors');

// Import du système de conversation intelligent
const ConversationManager = require('../src/conversation_manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration CORS pour Vercel
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques pour le développement local
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configuration des données
const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Initialiser le gestionnaire de conversation
const conversationManager = new ConversationManager();

// Configuration du cloud LLM
const CLOUD_ENABLED = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
let cloudLLMService = null;

if (CLOUD_ENABLED) {
  try {
    const CloudLLMService = require('../src/cloud_llm');
    cloudLLMService = new CloudLLMService();
    console.log('[CLOUD] LLM service initialized with', cloudLLMService.provider);
  } catch (error) {
    console.warn('[CLOUD] Failed to initialize cloud LLM:', error.message);
  }
}

// Route de santé pour Vercel
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      cloudLLM: !!cloudLLMService,
      conversationManager: true,
      contextMemory: true,
      adaptiveResponses: true
    }
  });
});

// Route de santé avec préfixe /api pour compatibilité locale
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      cloudLLM: !!cloudLLMService,
      conversationManager: true,
      contextMemory: true,
      adaptiveResponses: true
    }
  });
});

// Route principale pour Vercel
app.get('/', (req, res) => {
  res.json({
    message: 'TSA Assistant API v2.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      chat: '/chat',
      profile: '/profile',
      feedback: '/feedback'
    }
  });
});

// Gestion des profils
app.get('/profile', (req, res) => {
  try {
    const profilePath = path.join(DATA_DIR, 'profile.json');
    if (fs.existsSync(profilePath)) {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      res.json(profile);
    } else {
      res.json({});
    }
  } catch (error) {
    console.error('[PROFILE] Error reading profile:', error);
    res.json({});
  }
});

// Route profile avec préfixe /api pour compatibilité locale
app.get('/api/profile', (req, res) => {
  try {
    const profilePath = path.join(DATA_DIR, 'profile.json');
    if (fs.existsSync(profilePath)) {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      res.json(profile);
    } else {
      res.json({});
    }
  } catch (error) {
    console.error('[PROFILE] Error reading profile:', error);
    res.json({});
  }
});

app.post('/profile', (req, res) => {
  try {
    ensureDataDir();
    const profilePath = path.join(DATA_DIR, 'profile.json');
    
    // Validation avec schéma permissif
    const schema = {
      type: 'object',
      properties: {
        type_fonctionnement: { type: 'string' },
        longueur_pref: { type: 'string' },
        format_pref: { type: 'string' },
        difficultes_principales: { type: 'array', items: { type: 'string' } },
        sensibilite_stimulations: { type: 'string' },
        besoin_validation: { type: 'string' },
        usages_frequents: { type: 'array', items: { type: 'string' } }
      },
      required: [],
      additionalProperties: true // Permettre des propriétés supplémentaires
    };
    
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    
    if (!validate(req.body)) {
      console.warn('[PROFILE] Validation errors:', validate.errors);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validate.errors 
      });
    }
    
    const profile = {
      ...req.body,
      derniere_mise_a_jour: new Date().toISOString()
    };
    
    // S'assurer que le répertoire existe
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
    
    // Mettre à jour le conversation manager
    const userId = req.ip || 'anonymous';
    conversationManager.updateUserProfile(userId, profile);
    
    console.log('[PROFILE] Profile saved successfully for user:', userId);
    res.json({ status: 'ok', profile });
  } catch (error) {
    console.error('[PROFILE] Error saving profile:', error);
    res.status(500).json({ 
      error: 'Failed to save profile', 
      message: error.message 
    });
  }
});

// Route POST profile avec préfixe /api pour compatibilité locale
app.post('/api/profile', (req, res) => {
  try {
    ensureDataDir();
    const profilePath = path.join(DATA_DIR, 'profile.json');
    
    // Validation avec schéma permissif
    const schema = {
      type: 'object',
      properties: {
        type_fonctionnement: { type: 'string' },
        longueur_pref: { type: 'string' },
        format_pref: { type: 'string' },
        difficultes_principales: { type: 'array', items: { type: 'string' } },
        sensibilite_stimulations: { type: 'string' },
        besoin_validation: { type: 'string' },
        usages_frequents: { type: 'array', items: { type: 'string' } }
      },
      required: [],
      additionalProperties: true // Permettre des propriétés supplémentaires
    };
    
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    
    if (!validate(req.body)) {
      console.warn('[PROFILE] Validation errors:', validate.errors);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validate.errors 
      });
    }
    
    const profile = {
      ...req.body,
      derniere_mise_a_jour: new Date().toISOString()
    };
    
    // S'assurer que le répertoire existe
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
    
    // Mettre à jour le conversation manager
    const userId = req.ip || 'anonymous';
    conversationManager.updateUserProfile(userId, profile);
    
    console.log('[PROFILE] Profile saved successfully for user:', userId);
    res.json({ status: 'ok', profile });
  } catch (error) {
    console.error('[PROFILE] Error saving profile:', error);
    res.status(500).json({ 
      error: 'Failed to save profile', 
      message: error.message 
    });
  }
});

app.put('/profile', (req, res) => {
  try {
    ensureDataDir();
    const profilePath = path.join(DATA_DIR, 'profile.json');
    
    const profile = {
      ...req.body,
      derniere_mise_a_jour: new Date().toISOString()
    };
    
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
    
    const userId = req.ip || 'anonymous';
    conversationManager.updateUserProfile(userId, profile);
    
    res.json({ status: 'ok', profile });
  } catch (error) {
    console.error('[PROFILE] Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Schéma d'onboarding
app.get('/onboarding/schema', (req, res) => {
  try {
    const schemaPath = path.join(__dirname, '..', 'schema', 'profile.schema.json');
    if (fs.existsSync(schemaPath)) {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      res.json(schema);
    } else {
      res.status(404).json({ error: 'Schema not found' });
    }
  } catch (error) {
    console.error('[SCHEMA] Error reading schema:', error);
    res.status(500).json({ error: 'Failed to read schema' });
  }
});

// Système de conversation intelligent
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId, mode = 'standard' } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        error: 'Message is required',
        reply: 'Tu n\'as rien envoyé. Écris ce que tu veux faire.'
      });
    }

    // Récupérer ou créer une session
    const userId = req.ip || 'anonymous';
    let currentSessionId = sessionId;
    
    if (!currentSessionId) {
      currentSessionId = conversationManager.startConversation(userId);
    }

    // Charger le profil utilisateur
    const profile = await getUserProfile(userId);
    
    // Ajouter le message utilisateur
    conversationManager.addMessage(currentSessionId, message, true);
    
    // Générer une réponse contextuelle
    let reply = '';
    
    // Essayer le cloud LLM d'abord
    if (CLOUD_ENABLED && cloudLLMService) {
      try {
        console.log('[CLOUD] Attempting cloud LLM call...');
        const cloudReply = await callCloudLLM(message, profile, mode);
        
        if (cloudReply && cloudReply.length > 20) {
          reply = cloudReply;
          console.log('[CLOUD] Using cloud LLM response');
        } else {
          console.log('[CLOUD] Cloud response too short, using conversation manager');
          reply = conversationManager.generateContextualResponse(currentSessionId, message);
        }
      } catch (error) {
        console.warn('[CLOUD] Cloud LLM error:', error.message);
        reply = conversationManager.generateContextualResponse(currentSessionId, message);
      }
    } else {
      console.log('[CLOUD] No cloud LLM, using conversation manager');
      reply = conversationManager.generateContextualResponse(currentSessionId, message);
    }
    
    // Ajouter la réponse de l'assistant
    const assistantMessage = conversationManager.addMessage(currentSessionId, reply, false);
    
    // Obtenir le contexte actuel
    const context = conversationManager.getCurrentContext(currentSessionId);
    
    // Générer des actions rapides pertinentes
    const actions = generateQuickActions(message, profile, context);
    
    // Obtenir l'historique récent
    const history = conversationManager.getConversationHistory(currentSessionId, 5);
    
    res.json({
      sessionId: currentSessionId,
      reply: reply,
      context: context,
      actions: actions,
      history: history,
      profile: profile,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CHAT] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      reply: 'Désolé, j\'ai eu un problème. Réessaye ta question.'
    });
  }
});

// Route chat avec préfixe /api pour compatibilité locale
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, mode = 'standard' } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        error: 'Message is required',
        reply: 'Tu n\'as rien envoyé. Écris ce que tu veux faire.'
      });
    }

    // Récupérer ou créer une session
    const userId = req.ip || 'anonymous';
    let currentSessionId = sessionId;
    
    if (!currentSessionId) {
      currentSessionId = conversationManager.startConversation(userId);
    }

    // Charger le profil utilisateur
    const profile = await getUserProfile(userId);
    
    // Ajouter le message utilisateur
    conversationManager.addMessage(currentSessionId, message, true);
    
    // Générer une réponse contextuelle
    let reply = '';
    
    // Essayer le cloud LLM d'abord
    if (CLOUD_ENABLED && cloudLLMService) {
      try {
        console.log('[CLOUD] Attempting cloud LLM call...');
        const cloudReply = await callCloudLLM(message, profile, mode);
        
        if (cloudReply && cloudReply.length > 20) {
          reply = cloudReply;
          console.log('[CLOUD] Using cloud LLM response');
        } else {
          console.log('[CLOUD] Cloud response too short, using conversation manager');
          reply = conversationManager.generateContextualResponse(currentSessionId, message);
        }
      } catch (error) {
        console.warn('[CLOUD] Cloud LLM error:', error.message);
        reply = conversationManager.generateContextualResponse(currentSessionId, message);
      }
    } else {
      console.log('[CLOUD] No cloud LLM, using conversation manager');
      reply = conversationManager.generateContextualResponse(currentSessionId, message);
    }
    
    // Ajouter la réponse de l'assistant
    const assistantMessage = conversationManager.addMessage(currentSessionId, reply, false);
    
    // Obtenir le contexte actuel
    const context = conversationManager.getCurrentContext(currentSessionId);
    
    // Générer des actions rapides pertinentes
    const actions = generateQuickActions(message, profile, context);
    
    // Obtenir l'historique récent
    const history = conversationManager.getConversationHistory(currentSessionId, 5);
    
    res.json({
      sessionId: currentSessionId,
      reply: reply,
      context: context,
      actions: actions,
      history: history,
      profile: profile,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CHAT] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      reply: 'Désolé, j\'ai eu un problème. Réessaye ta question.'
    });
  }
});

// Appel au cloud LLM
async function callCloudLLM(message, profile, mode) {
  if (!cloudLLMService) return null;
  
  try {
    const prompt = buildCloudPrompt(message, profile, mode);
    const response = await cloudLLMService.callLLM(prompt, message, profile, mode);
    
    if (cloudLLMService.validateReply(response, message)) {
      return response;
    }
    
    return null;
  } catch (error) {
    console.error('[CLOUD] Error calling LLM:', error);
    return null;
  }
}

function buildCloudPrompt(message, profile, mode) {
  const basePrompt = `Tu es un assistant spécialisé pour les personnes TSA/TDAH. Sois clair, direct et adapté au profil de l'utilisateur.

Profil utilisateur:
- Type: ${profile.type_fonctionnement || 'non spécifié'}
- Sensibilité: ${profile.sensibilite_stimulations || 'normale'}
- Besoin de validation: ${profile.besoin_validation || 'non'}
- Préférences: ${profile.longueur_pref || 'moyen'}, ${profile.format_pref || 'puces'}

Message de l'utilisateur: ${message}

Réponds de manière:
1) Claire et directe (pas de jargon)
2) Adaptée au profil TSA/TDAH
3) Orientée action concrète
4) Bienveillante et sans jugement`;

  return basePrompt;
}

// Générer des actions rapides pertinentes
function generateQuickActions(message, profile, context) {
  const actions = [];
  const messageLower = message.toLowerCase();
  
  // Actions basées sur le profil
  if (profile.usages_frequents) {
    if (profile.usages_frequents.includes('organisation')) {
      actions.push({
        id: 'plan-action',
        label: 'Plan d\'action',
        payload: { message: 'Aide-moi à organiser mes tâches', mode: 'planning' }
      });
    }
    
    if (profile.usages_frequents.includes('concentration')) {
      actions.push({
        id: 'focus-session',
        label: 'Session focus',
        payload: { message: 'Je veux me concentrer 25 minutes', mode: 'focus' }
      });
    }
    
    if (profile.usages_frequents.includes('regulation')) {
      actions.push({
        id: 'calm-down',
        label: 'Apaiser mon stress',
        payload: { message: 'Je suis stressé, aide-moi à me calmer', mode: 'regulation' }
      });
    }
  }
  
  // Actions contextuelles
  if (messageLower.includes('anxieux') || messageLower.includes('stressé')) {
    actions.push({
      id: 'breathing',
      label: 'Exercice respiration',
      payload: { message: 'Guide-moi pour respirer', mode: 'calming' }
    });
  }
  
  if (messageLower.includes('procrastine') || messageLower.includes('bloqué')) {
    actions.push({
      id: 'micro-task',
      label: 'Micro-tâche',
      payload: { message: 'Donne-moi une micro-tâche à faire maintenant', mode: 'action' }
    });
  }
  
  if (messageLower.includes('fatigué') || messageLower.includes('épuisé')) {
    actions.push({
      id: 'energy-boost',
      label: 'Boost énergie',
      payload: { message: 'Je suis fatigué, comment retrouver de l\'énergie?', mode: 'energy' }
    });
  }
  
  // Actions par défaut
  if (actions.length === 0) {
    actions.push({
      id: 'quick-help',
      label: 'Aide rapide',
      payload: { message: 'J\'ai besoin d\'aide pour avancer', mode: 'help' }
    });
    
    actions.push({
      id: 'break-task',
      label: 'Décomposer tâche',
      payload: { message: 'Aide-moi à décomposer cette tâche', mode: 'planning' }
    });
  }
  
  return actions.slice(0, 4); // Limiter à 4 actions
}

// Obtenir le profil utilisateur
async function getUserProfile(userId) {
  try {
    const profilePath = path.join(DATA_DIR, 'profile.json');
    if (fs.existsSync(profilePath)) {
      return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    }
  } catch (error) {
    console.warn('[PROFILE] Error reading user profile:', error);
  }
  
  return {};
}

// Feedback et apprentissage
app.post('/feedback', (req, res) => {
  try {
    const { sessionId, messageId, helpful, comment } = req.body;
    
    if (!sessionId || !messageId || typeof helpful !== 'boolean') {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Apprendre du feedback
    conversationManager.learnFromFeedback(sessionId, messageId, { helpful, comment });
    
    // Sauvegarder le feedback
    const feedbackPath = path.join(DATA_DIR, 'feedback.json');
    ensureDataDir();
    
    let feedbacks = [];
    if (fs.existsSync(feedbackPath)) {
      feedbacks = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
    }
    
    feedbacks.push({
      sessionId,
      messageId,
      helpful,
      comment,
      timestamp: new Date().toISOString()
    });
    
    fs.writeFileSync(feedbackPath, JSON.stringify(feedbacks, null, 2), 'utf8');
    
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[FEEDBACK] Error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Route feedback avec préfixe /api pour compatibilité locale
app.post('/api/feedback', (req, res) => {
  try {
    const { sessionId, messageId, helpful, comment } = req.body;
    
    if (!sessionId || !messageId || typeof helpful !== 'boolean') {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Apprendre du feedback
    conversationManager.learnFromFeedback(sessionId, messageId, { helpful, comment });
    
    // Sauvegarder le feedback
    const feedbackPath = path.join(DATA_DIR, 'feedback.json');
    ensureDataDir();
    
    let feedbacks = [];
    if (fs.existsSync(feedbackPath)) {
      feedbacks = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
    }
    
    feedbacks.push({
      sessionId,
      messageId,
      helpful,
      comment,
      timestamp: new Date().toISOString()
    });
    
    fs.writeFileSync(feedbackPath, JSON.stringify(feedbacks, null, 2), 'utf8');
    
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[FEEDBACK] Error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Nettoyage périodique
app.get('/examples', (req, res) => {
  try {
    const examplesPath = path.join(DATA_DIR, 'examples.json');
    if (fs.existsSync(examplesPath)) {
      const examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
      res.json(examples);
    } else {
      res.json({ items: [] });
    }
  } catch (error) {
    console.error('[EXAMPLES] Error reading examples:', error);
    res.json({ items: [] });
  }
});

// Nettoyage périodique
setInterval(() => {
  conversationManager.cleanupOldConversations();
}, 24 * 60 * 60 * 1000); // Nettoyer toutes les 24 heures

// Démarrer le serveur seulement si exécuté directement
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 TSA Assistant v2.0.0 running on port ${PORT}`);
    console.log(`📊 Features: Cloud LLM=${!!cloudLLMService}, Conversation Manager=✅`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
  });
}

// Export pour Vercel
module.exports = app;
