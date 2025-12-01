/**
 * Système de conversation intelligent avec mémoire contextuelle
 * Basé sur les meilleures pratiques pour TSA/TDAH
 */

class ConversationManager {
  constructor() {
    this.conversations = new Map(); // conversations par utilisateur/session
    this.userProfiles = new Map(); // profils utilisateurs enrichis
    this.contextMemory = new Map(); // mémoire contextuelle à long terme
    this.responsePatterns = new Map(); // patterns de réponse appris
    this.sessionHistory = new Map(); // historique de session
    this.loadPersistedData();
  }

  loadPersistedData() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Charger les conversations
      const convPath = path.join(__dirname, '..', 'data', 'conversations.json');
      if (fs.existsSync(convPath)) {
        const data = JSON.parse(fs.readFileSync(convPath, 'utf8'));
        this.conversations = new Map(data.conversations || []);
        this.userProfiles = new Map(data.profiles || []);
        this.contextMemory = new Map(data.contextMemory || []);
        this.responsePatterns = new Map(data.patterns || []);
      }
      
      console.log('[CONV] Données chargées:', this.conversations.size, 'conversations');
    } catch (error) {
      console.warn('[CONV] Erreur chargement données:', error.message);
    }
  }

  savePersistedData() {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataPath = path.join(__dirname, '..', 'data');
      
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
      }
      
      const data = {
        conversations: Array.from(this.conversations.entries()),
        profiles: Array.from(this.userProfiles.entries()),
        contextMemory: Array.from(this.contextMemory.entries()),
        patterns: Array.from(this.responsePatterns.entries()),
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(path.join(dataPath, 'conversations.json'), JSON.stringify(data, null, 2));
      console.log('[CONV] Données sauvegardées');
    } catch (error) {
      console.error('[CONV] Erreur sauvegarde:', error.message);
    }
  }

  // Gérer une nouvelle conversation
  startConversation(userId, userProfile = {}) {
    const sessionId = this.generateSessionId(userId);
    
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, {
        userId: userId,
        sessionId: sessionId,
        messages: [],
        context: {
          currentTopic: null,
          emotionalState: 'neutral',
          previousTopics: [],
          userPreferences: {},
          lastInteraction: null
        },
        startedAt: new Date().toISOString()
      });
    }
    
    // Mettre à jour le profil utilisateur
    this.updateUserProfile(userId, userProfile);
    
    return sessionId;
  }

  generateSessionId(userId) {
    const today = new Date().toDateString();
    return `${userId}_${today}`;
  }

  updateUserProfile(userId, profile) {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        ...profile,
        preferences: {
          communicationStyle: this.detectCommunicationStyle(profile),
          preferredLength: profile.longueur_pref || 'medium',
          emotionalSupport: profile.besoin_validation === 'oui',
          sensitivityLevel: profile.sensibilite_stimulations || 'normale',
          ...profile.preferences
        },
        interactionHistory: [],
        learnedPatterns: [],
        adaptationScore: 0
      });
    } else {
      const existing = this.userProfiles.get(userId);
      this.userProfiles.set(userId, { ...existing, ...profile });
    }
  }

  detectCommunicationStyle(profile) {
    if (profile.type_fonctionnement === 'TSA') return 'structured_literal';
    if (profile.type_fonctionnement === 'TDAH') return 'dynamic_engaging';
    return 'balanced_flexible';
  }

  // Ajouter un message à la conversation
  addMessage(sessionId, message, isUser = true) {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return null;

    const messageObj = {
      id: this.generateMessageId(),
      content: message,
      timestamp: new Date().toISOString(),
      isUser: isUser,
      analysis: isUser ? this.analyzeUserMessage(message) : null,
      context: this.extractMessageContext(message, conversation)
    };

    conversation.messages.push(messageObj);
    conversation.context.lastInteraction = new Date().toISOString();
    
    // Mettre à jour le contexte
    if (isUser) {
      this.updateConversationContext(conversation, messageObj);
    }

    // Limiter l'historique (garder les 50 derniers messages)
    if (conversation.messages.length > 50) {
      conversation.messages = conversation.messages.slice(-50);
    }

    return messageObj;
  }

  generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  analyzeUserMessage(message) {
    const analysis = {
      intent: this.detectIntent(message),
      emotionalTone: this.detectEmotionalTone(message),
      complexity: this.assessComplexity(message),
      keywords: this.extractKeywords(message),
      contextType: this.detectContextType(message),
      timeOfDay: new Date().getHours(),
      urgency: this.assessUrgency(message),
      previousMentions: this.checkPreviousMentions(message)
    };

    return analysis;
  }

  detectIntent(message) {
    const msg = message.toLowerCase();
    const intents = {
      help_request: /(aide|aide-moi|comment|besoin|soutien|aidez)/,
      blockage: /(bloque|bloqué|difficile|problème|impossible|échoue|coince)/,
      start_action: /(commence|démarrer|premier|initial|initier|vas-y|allez-y)/,
      completion: /(fini|terminé|achevé|complé|résolu|fait)/,
      planning: /(plan|organisation|étapes|comment faire|préparer|organiser)/,
      procrastination: /(procrastine|retarde|diffère|reporte|plus tard|pas envie)/,
      anxiety: /(stress|anxieux|inquiet|panique|crainte|angoissé|peur)/,
      fatigue: /(fatigué|épuisé|sans énergie|vide|crevé)/,
      frustration: /(énervé|frustré|agacé|exaspéré|marre)/,
      confusion: /(comprends pas|confus|perdu|sais pas comment|pas clair)/,
      motivation: /(motivé|enthousiaste|prêt|c'est parti|allez)/,
      routine: /(quotidien|habitude|matin|soir|jour)/,
      work: /(travail|bureau|collègue|professionnel|job|tâche)/,
      personal: /(personnel|maison|famille|vie privée)/,
      health: /(santé|médical|docteur|traitement|médicament)/
    };

    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(msg)) return intent;
    }

    return 'general';
  }

  detectEmotionalTone(message) {
    const msg = message.toLowerCase();
    const tones = {
      anxious: /(anxieux|stressé|inquiet|paniqué|craintif|angoissé|peur|appréhensif)/,
      sad: /(triste|découragé|déprimé|mal|peine|abattu|morose)/,
      angry: /(énervé|furieux|agacé|frustré|colère|ragé)/,
      happy: /(content|heureux|enthousiaste|excité|motivé|joyeux)/,
      calm: /(calme|serein|détendu|paisible|relaxé)/,
      tired: /(fatigué|épuisé|las|épuisé)/,
      confused: /(confus|perdu|désorienté|pas compris)/,
      motivated: /(motivé|déterminé|prêt|enthousiaste)/,
      overwhelmed: /(débordé|submergé|écrasé|trop plein)/
    };

    for (const [tone, pattern] of Object.entries(tones)) {
      if (pattern.test(msg)) return tone;
    }

    return 'neutral';
  }

  assessComplexity(message) {
    const sentences = message.split(/[.!?]+/).length;
    const words = message.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;
    const hasComplexStructures = /(car|parce que|mais|donc|alors|si|lorsque|bien que)/.test(message.toLowerCase());
    
    if (avgWordsPerSentence > 15 || words > 30 || hasComplexStructures) return 'high';
    if (avgWordsPerSentence > 8 || words > 15) return 'medium';
    return 'low';
  }

  extractKeywords(message) {
    const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'mais', 'pour', 'avec', 'sur', 'par', 'dans', 'en', 'un', 'une', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'ce', 'se', 'ne', 'pas', 'plus', 'moins', 'très', 'trop', 'bien', 'fait', 'faire', 'être', 'avoir', 'vouloir', 'pouvoir', 'aller', 'venir', 'voir', 'dire', 'prendre', 'donner', 'savoir', 'devoir', 'falloir']);
    
    return message.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .slice(0, 10);
  }

  detectContextType(message) {
    const msg = message.toLowerCase();
    const contexts = {
      work: /(travail|bureau|collègue|professionnel|job|tâche|projet|réunion|équipe)/,
      home: /(maison|domicile|famille|personnel|appart|chambre|cuisine)/,
      school: /(école|études|cours|examen|révision|devoir|université|professeur)/,
      social: /(social|amis|ami|soiree|soirée|repas|sortie|rencontre)/,
      health: /(santé|médical|docteur|traitement|médicament|thérapie|consultation)/,
      routine: /(matin|soir|quotidien|habitude|routine|jour|nuit)/,
      emotional: /(triste|content|énervé|anxieux|stressé|émotion|ressenti)/
    };

    for (const [context, pattern] of Object.entries(contexts)) {
      if (pattern.test(msg)) return context;
    }

    return 'general';
  }

  assessUrgency(message) {
    const msg = message.toLowerCase();
    if (/(urgent|immédiatement|vite|tout de suite|maintenant|urgence)/.test(msg)) return 'high';
    if (/(bientôt|rapidement|plutôt|si possible)/.test(msg)) return 'medium';
    return 'low';
  }

  checkPreviousMentions(message) {
    // Vérifier si le message fait référence à des éléments précédents
    const keywords = this.extractKeywords(message);
    const mentions = {
      previousTopics: [],
      repeatedKeywords: [],
      followUp: false
    };

    // Cette fonction serait enrichie avec la logique de détection de références
    return mentions;
  }

  extractMessageContext(message, conversation) {
    return {
      conversationLength: conversation.messages.length,
      previousTopics: conversation.context.previousTopics,
      timeSinceLastInteraction: this.getTimeSinceLastInteraction(conversation),
      sessionDuration: this.getSessionDuration(conversation),
      userState: this.assessUserState(conversation)
    };
  }

  getTimeSinceLastInteraction(conversation) {
    if (!conversation.context.lastInteraction) return null;
    const last = new Date(conversation.context.lastInteraction);
    const now = new Date();
    return Math.floor((now - last) / 1000); // en secondes
  }

  getSessionDuration(conversation) {
    const start = new Date(conversation.startedAt);
    const now = new Date();
    return Math.floor((now - start) / 1000); // en secondes
  }

  assessUserState(conversation) {
    const recentMessages = conversation.messages.slice(-5);
    const emotionalStates = recentMessages
      .filter(m => m.isUser && m.analysis)
      .map(m => m.analysis.emotionalTone);
    
    if (emotionalStates.length === 0) return 'unknown';
    
    // Détecter les patterns émotionnels
    const anxiousCount = emotionalStates.filter(s => s === 'anxious').length;
    const frustratedCount = emotionalStates.filter(s => s === 'angry' || s === 'frustrated').length;
    const tiredCount = emotionalStates.filter(s => s === 'tired').length;
    
    if (anxiousCount >= 2) return 'consistently_anxious';
    if (frustratedCount >= 2) return 'consistently_frustrated';
    if (tiredCount >= 2) return 'consistently_tired';
    
    return 'stable';
  }

  updateConversationContext(conversation, messageObj) {
    const analysis = messageObj.analysis;
    
    // Mettre à jour l'état émotionnel
    if (analysis.emotionalTone !== 'neutral') {
      conversation.context.emotionalState = analysis.emotionalTone;
    }
    
    // Mettre à jour le sujet actuel
    if (analysis.intent !== 'general') {
      conversation.context.currentTopic = analysis.intent;
      if (!conversation.context.previousTopics.includes(analysis.intent)) {
        conversation.context.previousTopics.push(analysis.intent);
      }
    }
    
    // Mettre à jour les préférences utilisateur
    this.updateUserPreferences(conversation.userId, analysis);
  }

  updateUserPreferences(userId, analysis) {
    const profile = this.userProfiles.get(userId);
    if (!profile) return;
    
    // Apprendre des préférences basées sur les interactions
    if (analysis.complexity === 'low') {
      profile.preferences.preferredLength = 'short';
    } else if (analysis.complexity === 'high') {
      profile.preferences.preferredLength = 'long';
    }
    
    // Adapter le style de communication
    if (analysis.emotionalTone === 'anxious') {
      profile.preferences.communicationStyle = 'supportive_reassuring';
    } else if (analysis.emotionalTone === 'motivated') {
      profile.preferences.communicationStyle = 'energetic_encouraging';
    }
  }

  // Générer une réponse contextuelle
  generateContextualResponse(sessionId, userMessage) {
    const conversation = this.conversations.get(sessionId);
    const userProfile = this.userProfiles.get(conversation.userId);
    
    if (!conversation || !userProfile) {
      return this.generateDefaultResponse(userMessage);
    }

    const latestMessage = conversation.messages[conversation.messages.length - 1];
    const analysis = latestMessage.analysis;
    
    // Stratégie de réponse basée sur le contexte
    const responseStrategy = this.determineResponseStrategy(conversation, analysis, userProfile);
    
    return this.buildResponse(responseStrategy, conversation, userProfile);
  }

  determineResponseStrategy(conversation, analysis, userProfile) {
    const strategies = {
      // Stratégies basées sur l'intention
      help_request: {
        type: 'supportive_guidance',
        priority: 'high',
        approach: this.getHelpApproach(userProfile),
        followUp: true
      },
      blockage: {
        type: 'problem_solving',
        priority: 'high',
        approach: this.getBlockageApproach(userProfile, analysis),
        followUp: true
      },
      anxiety: {
        type: 'emotional_support',
        priority: 'urgent',
        approach: this.getAnxietyApproach(userProfile),
        followUp: true
      },
      procrastination: {
        type: 'motivational_coaching',
        priority: 'medium',
        approach: this.getProcrastinationApproach(userProfile),
        followUp: false
      },
      routine: {
        type: 'practical_assistance',
        priority: 'medium',
        approach: this.getRoutineApproach(userProfile),
        followUp: false
      },
      planning: {
        type: 'structured_guidance',
        priority: 'medium',
        approach: this.getPlanningApproach(userProfile),
        followUp: true
      },
      // Stratégie par défaut
      general: {
        type: 'adaptive_conversation',
        priority: 'normal',
        approach: this.getGeneralApproach(userProfile, analysis),
        followUp: false
      }
    };

    return strategies[analysis.intent] || strategies.general;
  }

  getHelpApproach(profile) {
    const approaches = {
      TSA: {
        style: 'structured_step_by_step',
        tone: 'clear_reassuring',
        format: 'numbered_list',
        elements: ['clarification', 'breakdown', 'simple_steps']
      },
      TDAH: {
        style: 'dynamic_action_oriented',
        tone: 'energetic_encouraging',
        format: 'bullet_points',
        elements: ['immediate_action', 'motivation', 'quick_wins']
      },
      mixte: {
        style: 'balanced_flexible',
        tone: 'supportive_adaptive',
        format: 'mixed',
        elements: ['options', 'flexibility', 'user_choice']
      }
    };
    
    return approaches[profile.type_fonctionnement] || approaches.mixte;
  }

  getBlockageApproach(profile, analysis) {
    const baseApproach = this.getHelpApproach(profile);
    
    // Adapter selon l'état émotionnel
    if (analysis.emotionalTone === 'anxious') {
      baseApproach.elements = ['breathing', 'grounding', 'micro_action'];
      baseApproach.tone = 'calming_reassuring';
    } else if (analysis.emotionalTone === 'frustrated') {
      baseApproach.elements = ['acknowledgment', 'reframing', 'alternative'];
      baseApproach.tone = 'validating_empathetic';
    }
    
    return baseApproach;
  }

  getAnxietyApproach(profile) {
    const approaches = {
      TSA: {
        style: 'grounding_techniques',
        tone: 'calming_structured',
        format: 'step_by_step',
        elements: ['breathing', 'sensory_grounding', 'reality_check']
      },
      TDAH: {
        style: 'action_distraction',
        tone: 'energetic_redirecting',
        format: 'quick_actions',
        elements: ['physical_movement', 'focus_shift', 'immediate_task']
      },
      mixte: {
        style: 'balanced_coping',
        tone: 'supportive_flexible',
        format: 'options_menu',
        elements: ['breathing', 'action', 'choice']
      }
    };
    
    return approaches[profile.type_fonctionnement] || approaches.mixte;
  }

  getProcrastinationApproach(profile) {
    const approaches = {
      TSA: {
        style: 'micro_task_breakdown',
        tone: 'gentle_structured',
        format: 'tiny_steps',
        elements: ['reduce_to_absurd', 'time_boxing', 'no_perfection']
      },
      TDAH: {
        style: 'gamification',
        tone: 'energetic_challenging',
        format: 'challenge_format',
        elements: ['timer_challenge', 'reward_system', 'immediate_start']
      },
      mixte: {
        style: 'flexible_motivation',
        tone: 'encouraging_adaptive',
        format: 'options_based',
        elements: ['micro_action', 'reward', 'flexibility']
      }
    };
    
    return approaches[profile.type_fonctionnement] || approaches.mixte;
  }

  getRoutineApproach(profile) {
    const approaches = {
      TSA: {
        style: 'structured_routine',
        tone: 'predictable_clear',
        format: 'checklist',
        elements: ['sequence', 'visual_cues', 'consistency']
      },
      TDAH: {
        style: 'dynamic_routine',
        tone: 'energetic_varied',
        format: 'flexible_steps',
        elements: ['variety', 'energy_management', 'quick_wins']
      },
      mixte: {
        style: 'balanced_routine',
        tone: 'supportive_flexible',
        format: 'adaptive',
        elements: ['structure', 'flexibility', 'choice']
      }
    };
    
    return approaches[profile.type_fonctionnement] || approaches.mixte;
  }

  getPlanningApproach(profile) {
    const approaches = {
      TSA: {
        style: 'visual_planning',
        tone: 'structured_clear',
        format: 'visual_steps',
        elements: ['breakdown', 'visual_timeline', 'checkpoints']
      },
      TDAH: {
        style: 'action_planning',
        tone: 'dynamic_motivating',
        format: 'action_blocks',
        elements: ['time_blocks', 'energy_matching', 'immediate_start']
      },
      mixte: {
        style: 'flexible_planning',
        tone: 'balanced_supportive',
        format: 'hybrid',
        elements: ['options', 'flexibility', 'structure']
      }
    };
    
    return approaches[profile.type_fonctionnement] || approaches.mixte;
  }

  getGeneralApproach(profile, analysis) {
    // Approche adaptative selon le contexte
    if (analysis.emotionalTone === 'anxious') {
      return this.getAnxietyApproach(profile);
    } else if (analysis.emotionalTone === 'tired') {
      return {
        style: 'gentle_support',
        tone: 'caring_understanding',
        format: 'simple',
        elements: ['acknowledgment', 'rest', 'gentle_action']
      };
    } else if (analysis.complexity === 'high') {
      return {
        style: 'simplification',
        tone: 'clear_patient',
        format: 'breakdown',
        elements: ['clarification', 'simplify', 'step_by_step']
      };
    }
    
    return {
      style: 'conversational',
      tone: 'friendly_supportive',
      format: 'natural',
      elements: ['acknowledgment', 'question', 'guidance']
    };
  }

  buildResponse(strategy, conversation, userProfile) {
    const responseBuilder = new ResponseBuilder(strategy, conversation, userProfile);
    return responseBuilder.build();
  }

  generateDefaultResponse(message) {
    const analysis = this.analyzeUserMessage(message);
    
    if (analysis.intent === 'help_request') {
      return "Je suis là pour t'aider. Dis-moi précisément ce dont tu as besoin et je t'accompagnerai pas à pas.";
    } else if (analysis.intent === 'anxiety') {
      return "Je sens que tu es anxieux. Respire profondément avec moi : 4 secondes inspire, 4 bloque, 4 souffle. Je suis là avec toi.";
    } else if (analysis.intent === 'blockage') {
      return "Tu es bloqué, c'est normal. Quelle est la plus petite action possible pour commencer ?";
    } else {
      return "Je suis là pour t'écouter. Dis-moi ce qui te préoccupe et on trouvera une solution ensemble.";
    }
  }

  // Apprendre du feedback
  learnFromFeedback(sessionId, messageId, feedback) {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    const message = conversation.messages.find(m => m.id === messageId);
    if (!message || message.isUser) return;

    const userProfile = this.userProfiles.get(conversation.userId);
    if (!userProfile) return;

    // Enregistrer le pattern de réponse réussie
    const pattern = {
      context: conversation.context,
      userMessage: conversation.messages.find(m => m.isUser && m.id < messageId),
      assistantResponse: message.content,
      feedback: feedback,
      timestamp: new Date().toISOString()
    };

    // Mettre à jour les patterns d'apprentissage
    const patternKey = this.generatePatternKey(conversation, pattern);
    if (!this.responsePatterns.has(patternKey)) {
      this.responsePatterns.set(patternKey, []);
    }
    
    this.responsePatterns.get(patternKey).push(pattern);
    
    // Adapter le profil utilisateur
    if (feedback.helpful) {
      userProfile.adaptationScore += 1;
      userProfile.learnedPatterns.push(patternKey);
    }

    this.savePersistedData();
  }

  generatePatternKey(conversation, pattern) {
    const context = conversation.context;
    const analysis = pattern.userMessage?.analysis;
    const userProfile = this.userProfiles.get(conversation.userId);
    
    if (!analysis) return 'unknown';
    
    return `${analysis.intent}_${analysis.emotionalTone}_${context.currentTopic || 'general'}_${userProfile?.type_fonctionnement || 'unknown'}`;
  }

  // Obtenir l'historique de conversation
  getConversationHistory(sessionId, limit = 10) {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return [];

    return conversation.messages.slice(-limit);
  }

  // Obtenir le contexte actuel
  getCurrentContext(sessionId) {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return null;

    return {
      sessionId: sessionId,
      userId: conversation.userId,
      currentTopic: conversation.context.currentTopic,
      emotionalState: conversation.context.emotionalState,
      messageCount: conversation.messages.length,
      lastInteraction: conversation.context.lastInteraction,
      sessionDuration: this.getSessionDuration(conversation)
    };
  }

  // Nettoyer les anciennes conversations (maintenance)
  cleanupOldConversations() {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 jours

    for (const [sessionId, conversation] of this.conversations.entries()) {
      const lastActivity = new Date(conversation.context.lastInteraction);
      if (lastActivity < cutoffDate) {
        this.conversations.delete(sessionId);
      }
    }

    this.savePersistedData();
  }
}

// Constructeur de réponses
class ResponseBuilder {
  constructor(strategy, conversation, userProfile) {
    this.strategy = strategy;
    this.conversation = conversation;
    this.profile = userProfile;
    this.context = conversation.context;
  }

  build() {
    const approach = this.strategy.approach;
    let response = '';

    // Construire selon les éléments de l'approche
    for (const element of approach.elements) {
      response += this.buildElement(element, approach);
      response += '\n\n';
    }

    return response.trim();
  }

  buildElement(element, approach) {
    const elementBuilders = {
      clarification: () => this.buildClarification(),
      breakdown: () => this.buildBreakdown(),
      simple_steps: () => this.buildSimpleSteps(),
      breathing: () => this.buildBreathing(),
      grounding: () => this.buildGrounding(),
      micro_action: () => this.buildMicroAction(),
      immediate_action: () => this.buildImmediateAction(),
      motivation: () => this.buildMotivation(),
      quick_wins: () => this.buildQuickWins(),
      acknowledgment: () => this.buildAcknowledgment(),
      reframing: () => this.buildReframing(),
      alternative: () => this.buildAlternative(),
      options: () => this.buildOptions(),
      flexibility: () => this.buildFlexibility(),
      user_choice: () => this.buildUserChoice(),
      sequence: () => this.buildSequence(),
      visual_cues: () => this.buildVisualCues(),
      consistency: () => this.buildConsistency(),
      variety: () => this.buildVariety(),
      energy_management: () => this.buildEnergyManagement(),
      visual_timeline: () => this.buildVisualTimeline(),
      checkpoints: () => this.buildCheckpoints(),
      time_blocks: () => this.buildTimeBlocks(),
      energy_matching: () => this.buildEnergyMatching(),
      immediate_start: () => this.buildImmediateStart(),
      structure: () => this.buildStructure(),
      rest: () => this.buildRest(),
      gentle_action: () => this.buildGentleAction(),
      question: () => this.buildQuestion(),
      guidance: () => this.buildGuidance(),
      reduce_to_absurd: () => this.buildReduceToAbsurd(),
      time_boxing: () => this.buildTimeBoxing(),
      no_perfection: () => this.buildNoPerfection(),
      timer_challenge: () => this.buildTimerChallenge(),
      reward_system: () => this.buildRewardSystem(),
      physical_movement: () => this.buildPhysicalMovement(),
      focus_shift: () => this.buildFocusShift(),
      immediate_task: () => this.buildImmediateTask(),
      reality_check: () => this.buildRealityCheck(),
      sensory_grounding: () => this.buildSensoryGrounding()
    };

    return elementBuilders[element]?.() || '';
  }

  // Implémentations des éléments de réponse
  buildClarification() {
    return "Je veux bien t'aider. Pour te donner la meilleure réponse, dis-moi précisément ce que tu veux accomplir.";
  }

  buildBreakdown() {
    return "Décomposons ça en étapes simples. Quelle est la première chose qui te vient à l'esprit quand tu penses à cette tâche ?";
  }

  buildSimpleSteps() {
    return "Voici les étapes simples :\n1. Choisis une seule action\n2. Fais-la pendant 5 minutes\n3. Dis-moi comment ça s'est passé";
  }

  buildBreathing() {
    return "Respirons ensemble :\n• Inspire par le nez pendant 4 secondes\n• Bloque ta respiration 4 secondes\n• Souffle par la bouche 4 secondes\n• Répète 3 fois";
  }

  buildGrounding() {
    return "Ancrage rapide :\n• Nomme 5 choses que tu vois\n• Touche 4 objets autour de toi\n• Écoute 3 sons\n• Sens 2 odeurs\n• Goûte 1 chose";
  }

  buildMicroAction() {
    return "Micro-action immédiate : Quelle est LA SEULE chose que tu peux faire maintenant qui prend moins de 30 secondes ?";
  }

  buildImmediateAction() {
    return "Action immédiate ! Lève-toi, fais 10 pas, reviens. Puis lance un timer de 2 minutes sur une tâche. C'est parti !";
  }

  buildMotivation() {
    return "Tu peux le faire ! Chaque petit pas est une victoire. Imagine-toi déjà après avoir fait cette action. La satisfaction sera là !";
  }

  buildQuickWins() {
    return "Victoire rapide : Choisis une tâche qui prend moins de 2 minutes. Fais-la maintenant. Célébrons cette micro-victoire !";
  }

  buildAcknowledgment() {
    return "Je comprends totalement ce que tu ressens. C'est normal de se sentir comme ça dans cette situation.";
  }

  buildReframing() {
    return "Voyons ça différemment : Au lieu de 'je dois faire', pense 'je choisis de faire pour obtenir X'. Quel est ton vrai but ?";
  }

  buildAlternative() {
    return "Si cette approche ne marche pas, que dirais-tu d'essayer complètement différemment ? Quelle autre option te vient à l'esprit ?";
  }

  buildOptions() {
    return "Tu as plusieurs options :\n• Option A : Commencer très petit (30 secondes)\n• Option B : Changer d'environnement\n• Option C : Demander de l'aide\n• Laquelle te parle le plus ?";
  }

  buildFlexibility() {
    return "Sois flexible avec toi-même. Aujourd'hui peut-être que la version 'simplifiée' suffit. Demain tu pourras faire plus.";
  }

  buildUserChoice() {
    return "C'est toi qui décides. Quelle approche te semble la plus adaptée maintenant ?";
  }

  buildSequence() {
    return "Voici la séquence recommandée :\n1. Préparation (1 minute)\n2. Action principale (10 minutes)\n3. Vérification (2 minutes)";
  }

  buildVisualCues() {
    return "Utilise des repères visuels : Post-it de couleur, checklist cochée, timer visible. Ça aide ton cerveau à rester focus.";
  }

  buildConsistency() {
    return "La régularité paie. Même 5 minutes chaque jour valent mieux que 2 heures une fois par semaine.";
  }

  buildVariety() {
    return "Varie les plaisirs : Change de lieu, de musique, de méthode. Ton cerveau adore la nouveauté !";
  }

  buildEnergyManagement() {
    return "Gère ton énergie : Fais les tâches difficiles quand tu as le plus d'énergie. Les tâches simples pour les moments creux.";
  }

  buildVisualTimeline() {
    return "Timeline visuelle :\n[9h] Check emails (15 min)\n[9:15] Tâche principale (45 min)\n[10h] Pause (10 min)\n[10:10] Tâche secondaire (30 min)";
  }

  buildCheckpoints() {
    return "Points de contrôle :\n• Après 25 min : Est-ce que je progresse ?\n• Après 50 min : Est-ce que je dois ajuster ?\n• À la fin : Qu'ai-j'accompli ?";
  }

  buildTimeBlocks() {
    return "Crée des blocs de temps :\n• 9:00-9:25 : Focus total\n• 9:25-9:30 : Pause\n• 9:30-9:55 : Focus total\n• 9:55-10:00 : Pause";
  }

  buildEnergyMatching() {
    return "Adapte les tâches à ton énergie :\n• Énergie haute : Tâches difficiles\n• Énergie moyenne : Tâches modérées\n• Énergie basse : Tâches simples";
  }

  buildImmediateStart() {
    return "Commence maintenant ! Compte jusqu'à 3 et lance l'action. 1... 2... 3... C'est parti !";
  }

  buildStructure() {
    return "Structure claire :\nObjectif → Étapes → Temps → Validation. Simple et efficace.";
  }

  buildRest() {
    return "Le repos est productif. 5 minutes de vrai repos te donneront plus d'énergie que 30 minutes de lutte.";
  }

  buildGentleAction() {
    return "Action douce : Fais juste 10% de ce que tu avais prévu. C'est déjà une victoire.";
  }

  buildQuestion() {
    return "Question pour t'aider : Quelle serait la version la plus simple possible de cette action ?";
  }

  buildGuidance() {
    return "Je suis là pour te guider. Dis-moi où tu en es et je t'indiquerai la prochaine étape.";
  }

  buildReduceToAbsurd() {
    return "Réduisons à l'absurde : Au lieu de 'finir le rapport', essaie 'ouvrir le document'. C'est tout. Juste ça.";
  }

  buildTimeBoxing() {
    return "Time-box : Timer 5 minutes maximum. Peu importe le résultat, tu t'arrêtes après 5 minutes. Pas de pression.";
  }

  buildNoPerfection() {
    return "Oublie la perfection. Visons 'suffisamment bien'. 80% de qualité = 100% de réussite.";
  }

  buildTimerChallenge() {
    return "Défi timer : Peux-tu faire 2 minutes de travail concentré ? Lance le timer maintenant ! Go go go !";
  }

  buildRewardSystem() {
    return "Système de récompense : Si tu fais 10 minutes de travail, tu t'offres 5 minutes de musique/pause/snack.";
  }

  buildPhysicalMovement() {
    return "Mouvement physique : Lève-toi, étire-toi 30 secondes, saute sur place 3 fois. L'énergie circule !";
  }

  buildFocusShift() {
    return "Change de focus : Pense à quelque chose de complètement différent pendant 30 secondes, puis reviens à la tâche.";
  }

  buildImmediateTask() {
    return "Tâche immédiate : Quelle petite action peux-tu faire LÀ MAINTENANT, sans réfléchir ?";
  }

  buildRealityCheck() {
    return "Vérification réalité : Quel est le pire qui pourrait arriver si tu ne fais pas ça parfaitement ? Est-ce vraiment grave ?";
  }

  buildSensoryGrounding() {
    return "Ancrage sensoriel : Touche quelque chose de texture différente, sens une odeur agréable, regarde un objet coloré.";
  }

  // Formater selon le style
  formatResponse(content) {
    const approach = this.strategy.approach;
    
    switch (approach.format) {
      case 'numbered_list':
        return this.formatAsNumberedList(content);
      case 'bullet_points':
        return this.formatAsBulletPoints(content);
      case 'step_by_step':
        return this.formatAsStepByStep(content);
      case 'checklist':
        return this.formatAsChecklist(content);
      default:
        return content;
    }
  }

  formatAsNumberedList(content) {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
  }

  formatAsBulletPoints(content) {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => `• ${line}`).join('\n');
  }

  formatAsStepByStep(content) {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map((line, index) => `Étape ${index + 1} : ${line}`).join('\n');
  }

  formatAsChecklist(content) {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => `☐ ${line}`).join('\n');
  }
}

module.exports = ConversationManager;
