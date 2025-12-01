/**
 * Système d'apprentissage intelligent local
 * Apprend des interactions réussies et génère des réponses contextuelles
 */

class LocalLearningEngine {
  constructor() {
    this.patterns = new Map(); // motifs d'apprentissage
    this.contextMemory = new Map(); // mémoire contextuelle
    this.userAdaptations = new Map(); // adaptations utilisateur
    this.successPatterns = new Map(); // patterns de succès
    this.loadLearningData();
  }

  loadLearningData() {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataPath = path.join(__dirname, '..', 'data', 'learning.json');
      
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        this.patterns = new Map(data.patterns || []);
        this.contextMemory = new Map(data.contextMemory || []);
        this.userAdaptations = new Map(data.userAdaptations || []);
        this.successPatterns = new Map(data.successPatterns || []);
        console.log('[LEARNING] Données chargées:', this.patterns.size, 'patterns');
      }
    } catch (error) {
      console.warn('[LEARNING] Erreur chargement données:', error.message);
    }
  }

  saveLearningData() {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataPath = path.join(__dirname, '..', 'data', 'learning.json');
      
      const data = {
        patterns: Array.from(this.patterns.entries()),
        contextMemory: Array.from(this.contextMemory.entries()),
        userAdaptations: Array.from(this.userAdaptations.entries()),
        successPatterns: Array.from(this.successPatterns.entries()),
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      console.log('[LEARNING] Données sauvegardées');
    } catch (error) {
      console.error('[LEARNING] Erreur sauvegarde:', error.message);
    }
  }

  // Extraire les caractéristiques d'un message
  extractFeatures(message, profile, mode) {
    const features = {
      keywords: this.extractKeywords(message),
      intent: this.detectIntent(message),
      complexity: this.assessComplexity(message),
      emotionalTone: this.detectEmotionalTone(message),
      contextType: this.detectContextType(message),
      userProfile: profile,
      mode: mode,
      timeOfDay: new Date().getHours(),
      messageLength: message.length
    };
    
    return features;
  }

  extractKeywords(message) {
    const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'mais', 'pour', 'avec', 'sur', 'par', 'dans', 'en', 'un', 'une', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'ce', 'se', 'ne', 'pas', 'plus', 'moins', 'très', 'trop', 'bien', 'fait', 'faire', 'être', 'avoir', 'vouloir', 'pouvoir', 'aller', 'venir', 'voir', 'dire', 'prendre', 'donner', 'savoir', 'devoir', 'falloir']);
    
    return message.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .slice(0, 10);
  }

  detectIntent(message) {
    const msg = message.toLowerCase();
    
    if (/(aide|aide-moi|comment|besoin|soutien|aidez)/.test(msg)) return 'help_request';
    if (/(bloque|bloqué|difficile|problème|impossible|échoue)/.test(msg)) return 'blockage';
    if (/(commence|démarrer|premier|initial|initier)/.test(msg)) return 'start_action';
    if (/(fini|terminé|achevé|complé|résolu)/.test(msg)) return 'completion';
    if (/(plan|organisation|étapes|comment faire)/.test(msg)) return 'planning';
    if (/(procrastine|retarde|diffère|reporte)/.test(msg)) return 'procrastination';
    if (/(stress|anxieux|inquiet|panique|crainte)/.test(msg)) return 'anxiety';
    if (/(fatigué|épuisé|sans énergie|vide)/.test(msg)) return 'fatigue';
    
    return 'general';
  }

  assessComplexity(message) {
    const sentences = message.split(/[.!?]+/).length;
    const words = message.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;
    
    if (avgWordsPerSentence > 15 || words > 30) return 'high';
    if (avgWordsPerSentence > 8 || words > 15) return 'medium';
    return 'low';
  }

  detectEmotionalTone(message) {
    const msg = message.toLowerCase();
    
    if (/(triste|découragé|déprimé|mal|peine)/.test(msg)) return 'sad';
    if (/(en colère|furieux|énervé|frustré|agacé)/.test(msg)) return 'angry';
    if (/(anxieux|stressé|inquiet|paniqué|craintif)/.test(msg)) return 'anxious';
    if (/(content|heureux|enthousiaste|excité|motivé)/.test(msg)) return 'happy';
    if (/(calme|serein|détendu|paisible)/.test(msg)) return 'calm';
    
    return 'neutral';
  }

  detectContextType(message) {
    const msg = message.toLowerCase();
    
    if (/(travail|bureau|collègue|professionnel|job)/.test(msg)) return 'work';
    if (/(maison|domicile|famille|personnel)/.test(msg)) return 'home';
    if (/(école|études|cours|examen|révision)/.test(msg)) return 'school';
    if (/(social|amis|sortie|rencontre)/.test(msg)) return 'social';
    if (/(santé|médical|docteur|traitement)/.test(msg)) return 'health';
    
    return 'general';
  }

  // Apprendre d'une interaction réussie
  learnFromSuccess(message, reply, profile, mode, feedback) {
    const features = this.extractFeatures(message, profile, mode);
    const patternKey = this.generatePatternKey(features);
    
    // Créer ou améliorer le pattern
    if (!this.patterns.has(patternKey)) {
      this.patterns.set(patternKey, {
        features: features,
        successfulReplies: [],
        adaptations: {},
        successCount: 0,
        lastUsed: null
      });
    }
    
    const pattern = this.patterns.get(patternKey);
    pattern.successfulReplies.push({
      reply: reply,
      feedback: feedback,
      timestamp: new Date().toISOString()
    });
    
    pattern.successCount++;
    pattern.lastUsed = new Date().toISOString();
    
    // Adapter au profil utilisateur
    this.adaptToUserProfile(features, reply, profile);
    
    // Nettoyer les anciennes réponses (garder max 10)
    if (pattern.successfulReplies.length > 10) {
      pattern.successfulReplies = pattern.successfulReplies.slice(-10);
    }
    
    console.log('[LEARNING] Nouveau pattern appris:', patternKey);
    this.saveLearningData();
  }

  // Adapter aux préférences utilisateur
  adaptToUserProfile(features, reply, profile) {
    const adaptationKey = this.generateAdaptationKey(profile);
    
    if (!this.userAdaptations.has(adaptationKey)) {
      this.userAdaptations.set(adaptationKey, {
        profile: profile,
        preferences: {
          preferredLength: this.estimatePreferredLength(reply),
          preferredTone: this.estimatePreferredTone(reply),
          preferredStructure: this.estimatePreferredStructure(reply),
          triggerWords: features.keywords
        },
        examples: []
      });
    }
    
    const adaptation = this.userAdaptations.get(adaptationKey);
    adaptation.examples.push({
      context: features,
      reply: reply,
      timestamp: new Date().toISOString()
    });
    
    // Mettre à jour les préférences
    this.updatePreferences(adaptation, reply, features);
    
    // Nettoyer (garder max 20 exemples)
    if (adaptation.examples.length > 20) {
      adaptation.examples = adaptation.examples.slice(-20);
    }
  }

  generatePatternKey(features) {
    return `${features.intent}_${features.contextType}_${features.complexity}_${features.emotionalTone}`;
  }

  generateAdaptationKey(profile) {
    return `${profile.type_fonctionnement || 'unknown'}_${profile.sensibilite_stimulations || 'normal'}_${profile.besoin_validation || 'non'}`;
  }

  estimatePreferredLength(reply) {
    const words = reply.split(/\s+/).length;
    if (words < 30) return 'short';
    if (words < 60) return 'medium';
    return 'long';
  }

  estimatePreferredTone(reply) {
    if (/(super|excellent|génial|bravo|formidable)/.test(reply.toLowerCase())) return 'enthusiastic';
    if (/(ok|bien|bon|correct)/.test(reply.toLowerCase())) return 'neutral';
    if (/(d'accord|pas de souci|sans problème)/.test(reply.toLowerCase())) return 'reassuring';
    return 'professional';
  }

  estimatePreferredStructure(reply) {
    if (/\d+\)/.test(reply)) return 'numbered';
    if (/-/.test(reply)) return 'bullets';
    if (reply.split('\n').length > 3) return 'paragraphs';
    return 'simple';
  }

  updatePreferences(adaptation, reply, features) {
    // Mettre à jour les préférences basées sur le feedback
    const length = this.estimatePreferredLength(reply);
    adaptation.preferences.preferredLength = length;
    
    // Détecter les mots de déclenchement
    features.keywords.forEach(keyword => {
      if (!adaptation.preferences.triggerWords.includes(keyword)) {
        adaptation.preferences.triggerWords.push(keyword);
      }
    });
  }

  // Générer une réponse intelligente basée sur l'apprentissage
  generateIntelligentResponse(message, profile, mode) {
    const features = this.extractFeatures(message, profile, mode);
    const patternKey = this.generatePatternKey(features);
    
    // Chercher des patterns similaires
    const similarPatterns = this.findSimilarPatterns(features);
    
    if (similarPatterns.length > 0) {
      // Générer basé sur les patterns appris
      return this.generateFromPatterns(similarPatterns, features, profile);
    }
    
    // Utiliser les adaptations utilisateur si disponibles
    const adaptationKey = this.generateAdaptationKey(profile);
    if (this.userAdaptations.has(adaptationKey)) {
      const adaptation = this.userAdaptations.get(adaptationKey);
      return this.generateFromAdaptation(adaptation, features, message);
    }
    
    // Fallback : réponse de base améliorée
    return this.generateEnhancedResponse(features, message, profile);
  }

  findSimilarPatterns(features) {
    const similar = [];
    
    for (const [key, pattern] of this.patterns.entries()) {
      const similarity = this.calculateSimilarity(features, pattern.features);
      if (similarity > 0.6) { // seuil de similarité
        similar.push({ pattern, similarity, key });
      }
    }
    
    // Trier par similarité décroissante
    return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  }

  calculateSimilarity(features1, features2) {
    let score = 0;
    let total = 0;
    
    // Similarité des intentions
    if (features1.intent === features2.intent) {
      score += 3;
    }
    total += 3;
    
    // Similarité des contextes
    if (features1.contextType === features2.contextType) {
      score += 2;
    }
    total += 2;
    
    // Similarité des mots-clés
    const commonKeywords = features1.keywords.filter(k => 
      features2.keywords.includes(k)
    ).length;
    score += commonKeywords;
    total += Math.max(features1.keywords.length, features2.keywords.length);
    
    // Similarité du ton émotionnel
    if (features1.emotionalTone === features2.emotionalTone) {
      score += 1;
    }
    total += 1;
    
    return total > 0 ? score / total : 0;
  }

  generateFromPatterns(similarPatterns, features, profile) {
    const bestPattern = similarPatterns[0].pattern;
    const successfulReply = bestPattern.successfulReplies[bestPattern.successfulReplies.length - 1];
    
    // Adapter la réponse réussie au contexte actuel
    let adaptedReply = successfulReply.reply;
    
    // Personnaliser avec le profil
    if (profile.type_fonctionnement === 'TSA') {
      adaptedReply = this.adaptForTSA(adaptedReply, features);
    } else if (profile.type_fonctionnement === 'TDAH') {
      adaptedReply = this.adaptForTDAH(adaptedReply, features);
    }
    
    // Ajouter des éléments contextuels
    adaptedReply = this.addContextualElements(adaptedReply, features);
    
    return adaptedReply;
  }

  adaptForTSA(reply, features) {
    // Adapter pour TSA : plus de structure, moins de ambiguïté
    if (features.complexity === 'high') {
      reply = this.simplifyStructure(reply);
    }
    
    if (features.emotionalTone === 'anxious') {
      reply = this.addReassurance(reply);
    }
    
    return reply;
  }

  adaptForTDAH(reply, features) {
    // Adapter pour TDAH : plus dynamique, moins de monotonie
    if (features.emotionalTone === 'neutral') {
      reply = this.addMotivation(reply);
    }
    
    if (features.complexity === 'high') {
      reply = this.breakIntoSteps(reply);
    }
    
    return reply;
  }

  simplifyStructure(reply) {
    // Simplifier la structure pour TSA
    const lines = reply.split('\n').filter(line => line.trim());
    return lines.slice(0, 5).join('\n'); // Garder max 5 lignes
  }

  addReassurance(reply) {
    const reassurance = "\n\nRappelle-toi : tu fais de ton mieux avec ce que tu as.";
    return reply + reassurance;
  }

  addMotivation(reply) {
    const motivation = "\n\nLet's go ! Tu peux le faire !";
    return reply + motivation;
  }

  breakIntoSteps(reply) {
    // Diviser en étapes plus courtes pour TDAH
    if (!/\d+\)/.test(reply)) {
      const sentences = reply.split('. ').filter(s => s.trim());
      return sentences.map((s, i) => `${i + 1}) ${s.trim()}.`).join('\n');
    }
    return reply;
  }

  addContextualElements(reply, features) {
    // Ajouter des éléments contextuels pertinents
    let contextualReply = reply;
    
    if (features.timeOfDay >= 18 && features.timeOfDay <= 22) {
      contextualReply += "\n\nC'est la fin de journée, sois indulgent avec toi-même.";
    }
    
    if (features.contextType === 'work') {
      contextualReply += "\n\nAu travail, priorise l'efficacité sur la perfection.";
    }
    
    return contextualReply;
  }

  generateFromAdaptation(adaptation, features, message) {
    // Générer basé sur les adaptations utilisateur
    const similarExample = adaptation.examples.find(ex => 
      this.calculateSimilarity(features, ex.context) > 0.7
    );
    
    if (similarExample) {
      return this.adaptReply(similarExample.reply, message, features);
    }
    
    // Utiliser les préférences de l'utilisateur
    return this.generateWithPreferences(adaptation.preferences, features, message);
  }

  adaptReply(baseReply, newMessage, features) {
    // Adapter une réponse existante au nouveau contexte
    let adapted = baseReply;
    
    // Remplacer les mots-clés contextuels
    features.keywords.forEach(keyword => {
      if (adapted.includes('exemple')) {
        adapted = adapted.replace('exemple', keyword);
      }
    });
    
    return adapted;
  }

  generateWithPreferences(preferences, features, message) {
    // Générer une réponse selon les préférences utilisateur
    let response = '';
    
    // Structure selon préférence
    switch (preferences.preferredStructure) {
      case 'numbered':
        response = this.generateNumberedResponse(features, message);
        break;
      case 'bullets':
        response = this.generateBulletResponse(features, message);
        break;
      case 'paragraphs':
        response = this.generateParagraphResponse(features, message);
        break;
      default:
        response = this.generateSimpleResponse(features, message);
    }
    
    // Ajuster la longueur
    response = this.adjustLength(response, preferences.preferredLength);
    
    // Ajuster le ton
    response = this.adjustTone(response, preferences.preferredTone);
    
    return response;
  }

  generateNumberedResponse(features, message) {
    const steps = this.generateSteps(features);
    return steps.map((step, i) => `${i + 1}) ${step}`).join('\n');
  }

  generateBulletResponse(features, message) {
    const points = this.generatePoints(features);
    return points.map(point => `- ${point}`).join('\n');
  }

  generateParagraphResponse(features, message) {
    const intro = this.generateIntro(features);
    const body = this.generateBody(features);
    const conclusion = this.generateConclusion(features);
    
    return `${intro}\n\n${body}\n\n${conclusion}`;
  }

  generateSimpleResponse(features, message) {
    const mainPoint = this.generateMainPoint(features);
    return mainPoint;
  }

  generateSteps(features) {
    const steps = [];
    
    switch (features.intent) {
      case 'blockage':
        steps.push('Identifie ce qui te bloque précisément');
        steps.push('Choisis la plus petite action possible');
        steps.push('Fais cette action maintenant');
        break;
      case 'start_action':
        steps.push('Prépare ce dont tu as besoin');
        steps.push('Fixe un timer très court (2-5 minutes)');
        steps.push('Commence sans réfléchir davantage');
        break;
      case 'planning':
        steps.push('Note ton objectif principal');
        steps.push('Décompose en 3 micro-étapes');
        steps.push('Commence la première étape');
        break;
      default:
        steps.push('Respire profondément');
        steps.push('Choisis une action simple');
        steps.push('Fais-la maintenant');
    }
    
    return steps;
  }

  generatePoints(features) {
    const points = [];
    
    if (features.emotionalTone === 'anxious') {
      points.push('Ton anxiété est normale, pas un échec');
      points.push('Respire : 4 sec inspire, 4 sec expire');
      points.push('Fais UNE seule chose maintenant');
    }
    
    if (features.complexity === 'high') {
      points.push('Simplifie : choisis UN seul aspect');
      points.push('Réduis le temps : 5 minutes maximum');
      points.push('Pas de perfection, juste l\'action');
    }
    
    return points;
  }

  generateIntro(features) {
    const intros = {
      blockage: 'Je comprends que tu sois bloqué. C\'est une situation difficile mais temporaire.',
      anxiety: 'Je sens ton anxiété. C\'est normal de se sentir comme ça.',
      start_action: 'Excellente initiative de commencer ! C\'est souvent le plus difficile.',
      planning: 'C\'est une bonne idée de planifier. Ça va te donner de la clarté.'
    };
    
    return intros[features.intent] || 'Je suis là pour t\'aider à avancer.';
  }

  generateBody(features) {
    const bodies = {
      work: 'Au travail, il est important de rester concentré sur l\'essentiel. Priorise les tâches qui ont le plus grand impact.',
      home: 'À la maison, tu peux te permettre d\'être plus flexible. L\'important est de progresser, pas d\'être parfait.',
      school: 'Pour les études, la régularité est plus importante que l\'intensité. De courtes sessions régulières sont plus efficaces.'
    };
    
    return bodies[features.contextType] || 'L\'important est de faire un pas à la fois.';
  }

  generateConclusion(features) {
    const conclusions = {
      TSA: 'N\'oublie pas que ton cerveau fonctionne différemment, et c\'est une force. Sois patient avec toi-même.',
      TDAH: 'Ton énergie et ta créativité sont des atouts. Canalise-les progressivement.',
      mixte: 'Tu as des forces uniques. Utilise-les à ton avantage.'
    };
    
    const profileType = features.userProfile?.type_fonctionnement || 'mixte';
    return conclusions[profileType] || 'Tu fais de ton mieux, et c\'est déjà suffisant.';
  }

  generateMainPoint(features) {
    const mainPoints = {
      blockage: 'Identifie la plus petite action possible et fais-la maintenant.',
      anxiety: 'Respire profondément et fais une seule action simple.',
      start_action: 'Commence immédiatement avec une action très simple.',
      planning: 'Décompose ton objectif en micro-étapes et commence la première.'
    };
    
    return mainPoints[features.intent] || 'Fais une petite action maintenant.';
  }

  adjustLength(response, preferredLength) {
    const words = response.split(/\s+/);
    
    switch (preferredLength) {
      case 'short':
        return words.slice(0, 20).join(' ');
      case 'medium':
        return words.slice(0, 50).join(' ');
      default:
        return response;
    }
  }

  adjustTone(response, preferredTone) {
    switch (preferredTone) {
      case 'enthusiastic':
        return response.replace(/(\.)/g, ' !');
      case 'reassuring':
        return response + '\n\nTout va bien se passer.';
      case 'professional':
        return response.replace(/(!)/g, '.');
      default:
        return response;
    }
  }

  generateEnhancedResponse(features, message, profile) {
    // Réponse améliorée quand aucun pattern n'est disponible
    const templates = {
      help_request: {
        TSA: "Je vois que tu as besoin d'aide. Dis-moi précisément ce que tu veux accomplir, et je t'aiderai à le décomposer en étapes très simples.",
        TDAH: "Besoin d'aide ! Super ! Dis-moi ce que tu veux faire et on va transformer ça en mission rapide et motivante.",
        mixte: "Je suis là pour t'aider. Explique-moi ce que tu veux faire et je te proposerai une approche adaptée."
      },
      blockage: {
        TSA: "Tu es bloqué, c'est normal. Ton cerveau a besoin de clarté. Quelle est LA SEULE chose que tu peux faire maintenant ?",
        TDAH: "Bloqué ? Transformons ça en défi ! Quelle micro-action tu peux faire pour débloquer la situation ?",
        mixte: "Le blocage est un signal. Quelle est la plus petite action qui pourrait faire bouger les choses ?"
      }
    };
    
    const profileType = profile?.type_fonctionnement || 'mixte';
    const intent = features.intent;
    
    return templates[intent]?.[profileType] || "Je suis là pour t'aider. Dis-moi ce dont tu as besoin.";
  }
}

module.exports = LocalLearningEngine;
