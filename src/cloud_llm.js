/**
 * Service LLM Cloud - Support OpenAI et Anthropic
 * Permet d'utiliser des APIs externes pour la portabilité mobile/web
 */

class CloudLLMService {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'openai';
    this.apiKey = null;
    this.model = null;
    this.initializeProvider();
  }

  initializeProvider() {
    switch (this.provider) {
      case 'openai':
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        break;
      case 'anthropic':
        this.apiKey = process.env.ANTHROPIC_API_KEY;
        this.model = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
        break;
      default:
        throw new Error(`Provider ${this.provider} not supported`);
    }

    if (!this.apiKey) {
      throw new Error(`API key not found for provider ${this.provider}`);
    }
  }

  async callLLM(prompt, message, profile, mode, phase) {
    try {
      const contextualPrompt = this.buildContextualPrompt(prompt, message, profile, mode, phase);
      
      switch (this.provider) {
        case 'openai':
          return await this.callOpenAI(contextualPrompt, message);
        case 'anthropic':
          return await this.callAnthropic(contextualPrompt, message);
        default:
          throw new Error(`Provider ${this.provider} not implemented`);
      }
    } catch (error) {
      console.error(`[CloudLLM] Error with ${this.provider}:`, error);
      return null;
    }
  }

  buildContextualPrompt(basePrompt, userMessage, profile, mode, phase) {
    let contextualPrompt = basePrompt;
    
    // Ajouter le profil détaillé pour personnalisation
    if (profile && Object.keys(profile).length > 0) {
      contextualPrompt += '\n\nProfil utilisateur à adapter :\n';
      
      if (profile.type_fonctionnement) {
        contextualPrompt += `- Type: ${profile.type_fonctionnement} (adapter les réponses à ce profil)\n`;
      }
      
      if (Array.isArray(profile.difficultes_principales) && profile.difficultes_principales.length > 0) {
        contextualPrompt += `- Difficultés principales : ${profile.difficultes_principales.join(', ')} (proposer des solutions ciblées)\n`;
      }
      
      if (profile.sensibilite_stimulations) {
        contextualPrompt += `- Sensibilité aux stimulations : ${profile.sensibilite_stimulations} (adapter l'environnement et les suggestions)\n`;
      }
      
      if (profile.besoin_validation) {
        contextualPrompt += `- Besoin de validation : ${profile.besoin_validation} (ton plus rassurant et validant)\n`;
      }
      
      if (Array.isArray(profile.usages_frequents) && profile.usages_frequents.length > 0) {
        contextualPrompt += `- Usages fréquents : ${profile.usages_frequents.join(', ')} (prioriser ces types d'aide)\n`;
      }
    }
    
    // Ajouter des exemples si disponibles
    try {
      const fs = require('fs');
      const path = require('path');
      const examplesPath = path.join(__dirname, '..', 'data', 'examples.json');
      if (fs.existsSync(examplesPath)) {
        const examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
        const relevantExamples = examples.items
          .filter(ex => ex.message && ex.reply)
          .slice(-3);
        
        if (relevantExamples.length > 0) {
          contextualPrompt += '\n\nExemples de réponses utiles :\n';
          relevantExamples.forEach((ex, idx) => {
            contextualPrompt += `Exemple ${idx + 1}:\nUtilisateur: ${ex.message}\nRéponse idéale: ${ex.reply}\n\n`;
          });
        }
      }
    } catch (e) {
      // Ignorer les erreurs de lecture d'exemples
    }
    
    contextualPrompt += `\nMessage actuel de l'utilisateur: ${userMessage}\nRéponds de manière similaire aux exemples, en adaptant au profil TSA/TDAH et en texte simple et direct.`;
    return contextualPrompt;
  }

  async callOpenAI(prompt, userMessage) {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: this.apiKey });

    const completion = await openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 300,
      temperature: 0.3,
      stream: false
    });

    return completion.choices[0]?.message?.content?.trim() || null;
  }

  async callAnthropic(prompt, userMessage) {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: this.apiKey });

    const message = await anthropic.messages.create({
      model: this.model,
      max_tokens: 300,
      temperature: 0.3,
      system: prompt,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });

    return message.content[0]?.text?.trim() || null;
  }

  validateReply(reply, message) {
    if (!reply || typeof reply !== 'string') return false;
    const clean = reply.trim();
    if (clean.length < 10) return false;
    
    // Réponses génériques à rejeter
    const genericPatterns = [
      /^(bonjour|salut|coucou|bienvenue|hello|hi)[\s\!\.\,]*$/i,
      /^(je comprends|je vois|ok|d'accord|entendu)[\s\!\.\,]*$/i,
      /^(comment puis-je|de quoi ai-je besoin|en quoi puis-je)[\s\!\.\,]*$/i,
      /^(je suis là|je suis prêt|je suis disponible)[\s\!\.\,]*$/i,
      /^\{[\s\S]*\}$/,  // Rejeter le JSON brut
      /^(error|erreur|fail|échec)/i  // Rejeter les messages d'erreur
    ];
    
    if (genericPatterns.some(pattern => pattern.test(clean))) return false;
    
    // Vérifier que la réponse contient un minimum de contenu utile
    const hasUsefulContent = /[a-zA-ZÀ-ÿ]{3,}/.test(clean) && clean.split(/\s+/).length > 2;
    
    return hasUsefulContent;
  }
}

module.exports = CloudLLMService;
