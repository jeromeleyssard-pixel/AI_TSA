const express = require('express');
const path = require('path');
const fs = require('fs');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration du cloud
const CLOUD_ENABLED = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
let cloudLLMService = null;

// Forcer l'initialisation du cloud si clé disponible
if (CLOUD_ENABLED) {
  try {
    const CloudLLMService = require('../src/cloud_llm');
    cloudLLMService = new CloudLLMService();
    console.log('[CLOUD] LLM service initialized with', cloudLLMService.provider);
  } catch (error) {
    console.warn('[CLOUD] Failed to initialize cloud LLM:', error.message);
  }
}

// Optional local LLM (Ollama) configuration
const OLLAMA_ENABLED = process.env.OLLAMA_ENABLED === 'true';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const PROFILE_PATH = path.join(DATA_DIR, 'profile.json');
const PROMPT_PATH = path.join(__dirname, 'prompts', 'prompt_system.txt');
const CASE_LIBRARY_PATH = path.join(DATA_DIR, 'case_library.json');
const PLAN_ROUTING_PATH = path.join(DATA_DIR, 'plan_routing.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PROFILE_PATH)) fs.writeFileSync(PROFILE_PATH, JSON.stringify({}, null, 2), 'utf8');
  const fbPath = path.join(DATA_DIR, 'feedback.json');
  if (!fs.existsSync(fbPath)) fs.writeFileSync(fbPath, JSON.stringify({ items: [] }, null, 2), 'utf8');
  const exPath = path.join(DATA_DIR, 'examples.json');
  if (!fs.existsSync(exPath)) fs.writeFileSync(exPath, JSON.stringify({ items: [] }, null, 2), 'utf8');
  const routingPath = path.join(DATA_DIR, 'plan_routing.json');
  if (!fs.existsSync(routingPath)) fs.writeFileSync(routingPath, JSON.stringify({ entries: [] }, null, 2), 'utf8');
} catch (e) {
  console.error('Failed to ensure data directory/files:', e);
}

function readProfile() {
  try {
    const raw = fs.readFileSync(PROFILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function writeProfile(profile) {
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf8');
}

function readPlanRouting() {
  try {
    const raw = fs.readFileSync(PLAN_ROUTING_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { entries: [] };
  }
}

function writePlanRouting(routing) {
  try {
    fs.writeFileSync(PLAN_ROUTING_PATH, JSON.stringify(routing, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write plan routing', e);
  }
}

function extractKeywords(message) {
  if (!message) return [];
  const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'mais', 'pour', 'avec', 'sur', 'par', 'dans', 'en', 'un', 'une', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'ce', 'se', 'ne', 'pas', 'plus', 'moins', 'très', 'trop', 'bien', 'fait', 'faire', 'être', 'avoir', 'vouloir', 'pouvoir', 'aller', 'venir', 'voir', 'dire', 'prendre', 'donner', 'savoir', 'devoir', 'falloir']);
  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  return words.slice(0, 5);
}

let caseLibrary = { surcharge: [] };
try {
  if (fs.existsSync(CASE_LIBRARY_PATH)) {
    const rawLib = fs.readFileSync(CASE_LIBRARY_PATH, 'utf8');
    const parsed = JSON.parse(rawLib);
    if (parsed && typeof parsed === 'object') {
      caseLibrary = parsed;
    }
  }
} catch (e) {
  console.warn('failed to load case_library.json', e);
}

function getSurchargeTips(message, profile) {
  const items = (caseLibrary && Array.isArray(caseLibrary.surcharge)) ? caseLibrary.surcharge : [];
  if (!items.length) return [];
  const m = (message || '').toLowerCase();
  const type = (profile && profile.type_fonctionnement) || 'mixte';
  const filtered = items.filter(it => {
    const okProfile = !Array.isArray(it.profiles) || it.profiles.includes(type) || it.profiles.includes('mixte');
    if (!okProfile) return false;
    if (!Array.isArray(it.contexts) || !it.contexts.length) return true;
    return it.contexts.some(c => m.includes(String(c).toLowerCase()));
  });
  const chosen = filtered.length ? filtered : items;
  const first = chosen[0];
  if (!first) return [];
  const tips = [];
  if (Array.isArray(first.common_tips)) tips.push(...first.common_tips);
  if (Array.isArray(first.tsa_specific) && type === 'TSA') tips.push(...first.tsa_specific);
  if (Array.isArray(first.tdah_specific) && type === 'TDAH') tips.push(...first.tdah_specific);
  if (Array.isArray(first.tdah_specific) && type === 'mixte') tips.push(first.tdah_specific[0] || '');
  return tips.filter(Boolean).slice(0, 3);
}

// Plan en 3 étapes adapté au contexte (organisation, santé, travail, études, relations, etc.)
function buildThreeStepPlan(message) {
  const m = (message || '').toString().toLowerCase();

  // 1) Vérifier d'abord si une catégorie apprise correspond
  const routing = readPlanRouting();
  const matchedEntry = routing.entries.find(entry => {
    if (!entry.keywords || !Array.isArray(entry.keywords)) return false;
    return entry.keywords.some(kw => m.includes(kw.toLowerCase()));
  });

  if (matchedEntry) {
    switch (matchedEntry.category) {
      case 'lettre_emploi':
        return "Plan en 3 étapes pour ta lettre de motivation :\n1) Paragraphe 1 : dire pour quel poste tu postules et pourquoi ce poste t'intéresse.\n2) Paragraphe 2 : donner 3 compétences ou expériences concrètes qui montrent que tu peux faire le travail.\n3) Paragraphe 3 : dire que tu es motivé·e, remercier et proposer un contact (entretien, appel).";
      case 'organisation_journee':
        return "Plan en 3 étapes pour organiser ta journée :\n1) Note 3 choses importantes à faire aujourd'hui (pas plus).\n2) Choisis celle qui te semble la plus faisable et décide d'un créneau de 10–20 minutes pour la commencer.\n3) Prépare juste ce qu'il faut pour ce créneau (matériel, fichier, lieu calme) et lance un minuteur.";
      case 'etudes_revisions':
        return "Plan en 3 étapes pour réviser :\n1) Choisis UN seul chapitre ou exercice à travailler (pas tout le programme).\n2) Fixe un temps court (10–20 minutes) et prépare ton matériel (cours, stylo, minuteur).\n3) Pendant ce temps, concentre‑toi uniquement sur ce chapitre, puis note en 1 phrase ce que tu as retenu ou ce qui reste flou.";
      case 'menage_rangement':
        return "Plan en 3 étapes pour la maison :\n1) Choisis une seule zone (bureau, lit, sol, évier, table).\n2) Mets tout ce qui traîne dans un seul panier / sac pour dégager visuellement la zone.\n3) Prends 5–10 minutes pour trier juste ce panier (garder, jeter, à ranger plus tard) sans chercher la perfection.";
      case 'sante_medical':
        return "Plan en 3 étapes pour la santé :\n1) Note clairement ce que tu dois faire (par ex. prendre un rendez‑vous, renouveler une ordonnance, aller à la pharmacie).\n2) Prépare en une fois les infos utiles (nom du pro, numéro, carte vitale, ordonnance).\n3) Fais une micro‑action maintenant : appeler, envoyer un mail ou remplir le formulaire, même si tu ne finis pas tout.";
      case 'travail_pro':
        return "Plan en 3 étapes pour le travail :\n1) Écris en une phrase ce que tu dois avancer (projet, dossier, mail important).\n2) Découpe en 3 mini‑actions concrètes faisables en 10–20 minutes chacune.\n3) Choisis la mini‑action la plus simple et commence‑la pendant un temps court (5–15 minutes).";
      case 'relations_voisinage':
        return "Plan en 3 étapes pour une situation sociale ou de voisinage :\n1) Clarifie ce que tu veux demander ou exprimer, en une ou deux phrases simples et neutres.\n2) Prépare un message très court et respectueux, par exemple : \"Bonjour, j'aimerais te parler de [sujet]. Serait-il possible d'en discuter quelques minutes ?\".\n3) Choisis le moment et le moyen les plus simples pour toi (message écrit, discussion rapide) et reste factuel dans ta communication.";
      case 'amour_couple':
        return "Plan en 3 étapes pour une situation amoureuse :\n1) Note ce que tu ressens et ce que tu aimerais (ex. plus de temps ensemble, clarifier une situation).\n2) Écris un message ou quelques phrases simples pour l'exprimer sans te juger (par exemple: je ressens..., j'aimerais...).\n3) Choisis un moment calme pour envoyer ce message ou en parler, et propose une petite action concrète (ex. discuter 10–15 minutes).";
      case 'emotions_stress':
        return "Plan en 3 étapes pour gérer tes émotions :\n1) Mets des mots simples sur ce que tu ressens (ex. fatigué·e, énervé·e, triste, débordé·e).\n2) Choisis une micro‑action de régulation qui te convient (respirer, t'isoler quelques minutes, écouter un son doux, bouger un peu).\n3) Après 5–10 minutes, note en une phrase si ça a un peu aidé et si tu as besoin d'une aide humaine supplémentaire (message à quelqu'un, appel).";
      case 'administratif':
        return "Plan en 3 étapes pour l'administratif :\n1) Choisis UN seul dossier ou formulaire à traiter (facture, mail, formulaire).\n2) Regroupe au même endroit les documents utiles (courrier, mail ouvert, identifiants).\n3) Prends 10–15 minutes pour remplir ou répondre à ce dossier, même si tu ne termines pas tout : l'objectif est d'avancer d'un cran.";
      default:
        break;
    }
  }

  // 2) Sinon, utiliser les heuristiques existantes

  // Lettres / emploi / candidature (déjà très fréquent)
  if (/(lettre de motivation|lettre motivation|candidature|entretien|cv|emploi|poste)/.test(m)) {
    return "Plan en 3 étapes pour ta lettre de motivation :\n1) Paragraphe 1 : dire pour quel poste tu postules et pourquoi ce poste t’intéresse.\n2) Paragraphe 2 : donner 3 compétences ou expériences concrètes qui montrent que tu peux faire le travail.\n3) Paragraphe 3 : dire que tu es motivé·e, remercier et proposer un contact (entretien, appel).";
  }

  // Organisation de journée / temps
  if (/(journée|journee|planning|agenda|horaires|matin|soir|semaine)/.test(m)) {
    return "Plan en 3 étapes pour organiser ta journée :\n1) Note 3 choses importantes à faire aujourd’hui (pas plus).\n2) Choisis celle qui te semble la plus faisable et décide d’un créneau de 10–20 minutes pour la commencer.\n3) Prépare juste ce qu’il faut pour ce créneau (matériel, fichier, lieu calme) et lance un minuteur.";
  }

  // Études / devoirs / examens
  if (/(devoir|examen|controle|contrôle|révision|revision|cours|leçon|lecon)/.test(m)) {
    return "Plan en 3 étapes pour réviser :\n1) Choisis UN seul chapitre ou exercice à travailler (pas tout le programme).\n2) Fixe un temps court (10–20 minutes) et prépare ton matériel (cours, stylo, minuteur).\n3) Pendant ce temps, concentre‑toi uniquement sur ce chapitre, puis note en 1 phrase ce que tu as retenu ou ce qui reste flou.";
  }

  // Tâches maison / rangement
  if (/(ranger|ménage|menage|vaisselle|linge|lessive|poussière|poussiere|chambre|cuisine|salon)/.test(m)) {
    return "Plan en 3 étapes pour la maison :\n1) Choisis une seule zone (bureau, lit, sol, évier, table).\n2) Mets tout ce qui traîne dans un seul panier / sac pour dégager visuellement la zone.\n3) Prends 5–10 minutes pour trier juste ce panier (garder, jeter, à ranger plus tard) sans chercher la perfection.";
  }

  // Santé / rendez‑vous médicaux / administratif santé
  if (/(médecin|medecin|rdv|rendez-vous|rendez vous|ordonnance|médical|medical|psychologue|psy|kiné|kine|dentiste|pharmacie)/.test(m)) {
    return "Plan en 3 étapes pour la santé :\n1) Note clairement ce que tu dois faire (par ex. prendre un rendez‑vous, renouveler une ordonnance, aller à la pharmacie).\n2) Prépare en une fois les infos utiles (nom du pro, numéro, carte vitale, ordonnance).\n3) Fais une micro‑action maintenant : appeler, envoyer un mail ou remplir le formulaire, même si tu ne finis pas tout.";
  }

  // Travail / projet pro
  if (/(travail|boulot|job|projet|dossier|rapport|présentation|presentation|mission|client|employeur)/.test(m)) {
    return "Plan en 3 étapes pour le travail :\n1) Écris en une phrase ce que tu dois avancer (projet, dossier, mail important).\n2) Découpe en 3 mini‑actions concrètes faisables en 10–20 minutes chacune.\n3) Choisis la mini‑action la plus simple et commence‑la pendant un temps court (5–15 minutes).";
  }

  // Relations sociales / famille / amis
  if (/(ami|amis|famille|parents|frère|soeur|frere|soeur|collègue|collegue|repas|soirée|soiree|sortie|voisin|voisine|voisinage|bruit|bruyant)/.test(m)) {
    return "Plan en 3 étapes pour une situation sociale ou de voisinage :\n1) Clarifie ce que tu veux demander ou exprimer, en une ou deux phrases simples et neutres.\n2) Prépare un message très court et respectueux, par exemple : \"Bonjour, j'aimerais te parler de [sujet]. Serait-il possible d'en discuter quelques minutes ?\".\n3) Choisis le moment et le moyen les plus simples pour toi (message écrit, discussion rapide) et reste factuel dans ta communication.";
  }

  // Amour / couple
  if (/(couple|partenaire|petit ami|petite amie|relation amoureuse|amour|crush)/.test(m)) {
    return "Plan en 3 étapes pour une situation amoureuse :\n1) Note ce que tu ressens et ce que tu aimerais (ex. plus de temps ensemble, clarifier une situation).\n2) Écris un message ou quelques phrases simples pour l'exprimer sans te juger (par exemple: je ressens..., j'aimerais...).\n3) Choisis un moment calme pour envoyer ce message ou en parler, et propose une petite action concrète (ex. discuter 10–15 minutes).";
  }

  // Émotions / surcharge émotionnelle (mais pas crise aigüe -> déjà gérée ailleurs)
  if (/(émotion|emotion|stressé|stresse|anxieux|anxieuse|angoisse|triste|colère|colere|fatigue mentale)/.test(m)) {
    return "Plan en 3 étapes pour gérer tes émotions :\n1) Mets des mots simples sur ce que tu ressens (ex. fatigué·e, énervé·e, triste, débordé·e).\n2) Choisis une micro‑action de régulation qui te convient (respirer, t’isoler quelques minutes, écouter un son doux, bouger un peu).\n3) Après 5–10 minutes, note en une phrase si ça a un peu aidé et si tu as besoin d’une aide humaine supplémentaire (message à quelqu’un, appel).";
  }

  // Administratif / paperasse
  if (/(impôts|impots|facture|factures|caf|sécurité sociale|securite sociale|dossier|formulaire|administratif|administration)/.test(m)) {
    return "Plan en 3 étapes pour l’administratif :\n1) Choisis UN seul dossier ou formulaire à traiter (facture, mail, formulaire).\n2) Regroupe au même endroit les documents utiles (courrier, mail ouvert, identifiants).\n3) Prends 10–15 minutes pour remplir ou répondre à ce dossier, même si tu ne termines pas tout : l’objectif est d’avancer d’un cran.";
  }

  // Par défaut : plan générique
  return "Plan simple en 3 étapes :\n1) Écris ton objectif en une phrase très simple.\n2) Découpe cet objectif en 3 petites actions concrètes et faisables.\n3) Choisis la première action et commence‑la pendant 5–15 minutes.";
}

async function callOllamaChat(prompt, message, profile, mode, phase) {
  try {
    const systemParts = [];
    if (prompt) systemParts.push(prompt);
    if (profile && profile.type_fonctionnement) {
      systemParts.push(`Profil utilisateur: ${String(profile.type_fonctionnement)}`);
    }
    const systemText = systemParts.join('\n\n');

    // Optimisation : prompt plus court pour Mistral
    const userText = [
      message || '',
      mode ? `mode=${mode}` : '',
      phase ? `phase=${phase}` : ''
    ].filter(Boolean).join(' ');

    const body = {
      model: OLLAMA_MODEL,
      messages: [
        systemText ? { role: 'system', content: systemText.slice(0, 500) } : null, // Limiter le système
        { role: 'user', content: userText.trim().slice(0, 300) || 'Aide-moi.' } // Limiter le user
      ].filter(Boolean),
      stream: false,
      options: {
        temperature: 0.3,  // Plus déterministe = plus rapide
        top_p: 0.8,
        repeat_penalty: 1.1,
        num_predict: 150,  // Limiter la longueur de réponse
        num_ctx: 2048      // Contexte plus court = plus rapide
      }
    };

    const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.warn('Ollama call failed:', resp.status, txt);
      return null;
    }

    const data = await resp.json().catch(() => null);
    if (!data || !data.message || typeof data.message.content !== 'string') {
      console.warn('[OLLAMA] Réponse mal formatée:', data);
      return null;
    }
    let replyText = data.message.content.trim();
    // Si la réponse ressemble à du JSON, essayer de l'extraire
    if (replyText.startsWith('{') && replyText.endsWith('}')) {
      try {
        const parsed = JSON.parse(replyText);
        if (parsed.reply || parsed.response || parsed.text) {
          replyText = parsed.reply || parsed.response || parsed.text;
        }
      } catch (e) {
        // Si ce n'est pas du JSON valide, garder le texte original
        console.warn('[OLLAMA] Tentative de parsing JSON échouée, utilisation du texte brut');
      }
    }
    console.log('[OLLAMA] Réponse générée par', OLLAMA_MODEL);
    return replyText;
  } catch (e) {
    console.error('Error calling Ollama:', e);
    return null;
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/profile', (req, res) => {
  const profile = readProfile();
  res.json(profile);
});

// Serve onboarding questionnaire schema
app.get('/onboarding/schema', (req, res) => {
  const schemaPath = path.join(__dirname, 'onboarding', 'questionnaire.json');
  try {
    const raw = fs.readFileSync(schemaPath, 'utf8');
    res.type('application/json').send(raw);
  } catch (e) {
    res.status(500).json({ error: 'questionnaire not found' });
  }
});

// Receive onboarding submission and save as profile
// Load and compile JSON schema for profile validation (if available)
let profileSchema = null;
try {
  const schemaRaw = fs.readFileSync(path.join(__dirname, 'schema', 'profile.schema.json'), 'utf8');
  profileSchema = JSON.parse(schemaRaw);
} catch (e) {
  console.warn('profile schema not found or invalid');
}
const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);
const validateProfile = profileSchema ? ajv.compile(profileSchema) : null;

app.get('/onboarding', (req, res) => {
  res.redirect('/onboarding.html');
});


  // Feedback store for simple learning loop
  const FEEDBACK_PATH = path.join(DATA_DIR, 'feedback.json');

  function readFeedback() {
    try {
      const raw = fs.readFileSync(FEEDBACK_PATH, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return { items: [] };
    }
  }

  function writeFeedback(fb) {
    try {
      fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(fb, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write feedback', e);
    }
  }

  // Examples store (derived from positive feedback)
  const EXAMPLES_PATH = path.join(DATA_DIR, 'examples.json');

  function readExamples() {
    try {
      const raw = fs.readFileSync(EXAMPLES_PATH, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return { items: [] };
    }
  }

  function writeExamples(ex) {
    try {
      fs.writeFileSync(EXAMPLES_PATH, JSON.stringify(ex, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write examples', e);
    }
  }

app.post('/onboarding/submit', (req, res) => {
  const submitted = req.body;
  // Basic normalization: map keys from questionnaire to profile schema
  const profile = Object.assign({}, readProfile());
  if (submitted.type_fonctionnement) profile.type_fonctionnement = submitted.type_fonctionnement;
  if (submitted.longueur_pref) profile.longueur_pref = submitted.longueur_pref;
  if (submitted.format_pref) profile.format_pref = submitted.format_pref;
  if (Array.isArray(submitted.difficultes_principales)) profile.difficultes_principales = submitted.difficultes_principales;
  if (submitted.sensibilite_stimulations) profile.sensibilite_stimulations = submitted.sensibilite_stimulations;
  if (submitted.besoin_validation) profile.besoin_validation = submitted.besoin_validation;
  if (Array.isArray(submitted.usages_frequents)) profile.usages_frequents = submitted.usages_frequents;
  profile.derniere_mise_a_jour = new Date().toISOString();

  // Validate final profile against JSON Schema if available
  if (validateProfile) {
    const valid = validateProfile(profile);
    if (!valid) {
      return res.status(400).json({ status: 'error', errors: validateProfile.errors });
    }
  }

  try {
    writeProfile(profile);
    res.json({ status: 'ok', profile });
  } catch (e) {
    res.status(500).json({ status: 'error', error: 'failed to write profile' });
  }
});

app.put('/profile', (req, res) => {
  const newProfile = req.body;
  writeProfile(newProfile);
  res.json({ status: 'ok', profile: newProfile });
});

// Simple local rule-based responder that respects "mode" and profile
app.post('/ask', async (req, res) => {
  const { message, mode } = req.body;
  const phase = (req.body && req.body.phase) || 'initiale';
  const profile = readProfile();
  const prompt = fs.existsSync(PROMPT_PATH) ? fs.readFileSync(PROMPT_PATH, 'utf8') : '';

  // Very simple heuristic responder (placeholder for LLM)
  function miniSummary(text) {
    const s = text.trim();
    if (!s) return 'Tu n’as rien envoyé.';
    return s.split(/[\.\!\?]\s/)[0].slice(0, 200);
  }
  let response = '';

  // Helper: vérifier si une réponse LLM est pertinente
  function isLlmReplyValid(reply, message) {
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

  // Optional: ask local LLM (Ollama) first pour les cas généraux uniquement.
  // Pas d’appel LLM si :
  // - message vide
  // - mode surcharge (on garde le plan très cadré)
  // - mode planification (on garde nos étapes simples)
  // - simple salutation (réponse courte locale)
  // - simple choix 1 / 2 / 3
  let llmReply = null;
  const isGreetingMsg = isGreeting(message);
  const isChoice123 = (() => {
    const trimmed = (message || '').toString().trim();
    return trimmed === '1' || trimmed === '2' || trimmed === '3';
  })();
  
  // Ajouter des exemples pertinents au prompt pour guider Mistral
  function buildContextualPrompt(basePrompt, userMessage, profile) {
    const examples = readExamples();
    const relevantExamples = examples.items
      .filter(ex => ex.message && ex.reply)
      .slice(-3); // Les 3 derniers exemples positifs
    
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
      
      if (profile.longueur_pref) {
        contextualPrompt += `- Préférence de longueur : ${profile.longueur_pref} (adapter la longueur des réponses)\n`;
      }
      
      if (profile.format_pref) {
        contextualPrompt += `- Format préféré : ${profile.format_pref} (adapter le style de présentation)\n`;
      }
    }
    
    if (relevantExamples.length > 0) {
      contextualPrompt += '\n\nExemples de réponses utiles :\n';
      relevantExamples.forEach((ex, idx) => {
        contextualPrompt += `Exemple ${idx + 1}:\nUtilisateur: ${ex.message}\nRéponse idéale: ${ex.reply}\n\n`;
      });
    }
    
    contextualPrompt += `\nMessage actuel de l'utilisateur: ${userMessage}\nRéponds de manière similaire aux exemples, en adaptant au profil TSA/TDAH et en texte simple et direct.`;
    return contextualPrompt;
  }
  // Appel LLM : priorité au cloud, fallback sur Ollama local
  console.log('[DEBUG] CLOUD_ENABLED:', !!CLOUD_ENABLED);
  console.log('[DEBUG] cloudLLMService:', !!cloudLLMService);
  console.log('[DEBUG] ANTHROPIC_API_KEY:', !!process.env.ANTHROPIC_API_KEY);
  console.log('[DEBUG] OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY);
  
  if (
    message &&
    mode !== 'surcharge' &&
    mode !== 'planification' &&
    !isGreetingMsg &&
    !isChoice123
  ) {
    // 1) Essayer le cloud LLM d'abord
    if (CLOUD_ENABLED && cloudLLMService) {
      console.log('[DEBUG] Tentative appel cloud LLM...');
      try {
        llmReply = await cloudLLMService.callLLM(prompt, message, profile, mode, phase);
        if (llmReply && !cloudLLMService.validateReply(llmReply, message)) {
          console.warn('[CLOUD] Réponse invalide, fallback sur autre méthode');
          llmReply = null;
        } else if (llmReply) {
          console.log('[CLOUD] Réponse générée par', cloudLLMService.provider);
        }
      } catch (error) {
        console.warn('[CLOUD] Erreur appel LLM:', error.message);
        llmReply = null;
      }
    } else {
      console.log('[DEBUG] Cloud non disponible, utilisation heuristiques');
    }
    
    // 2) Fallback sur Ollama local si cloud échoue
    if (!llmReply && OLLAMA_ENABLED && OLLAMA_MODEL) {
      try {
        const contextualPrompt = buildContextualPrompt(prompt, message, profile);
        llmReply = await callOllamaChat(contextualPrompt, message, profile, mode, phase);
        if (llmReply && !isLlmReplyValid(llmReply, message)) {
          console.warn('[OLLAMA] Réponse invalide, fallback sur heuristiques');
          llmReply = null;
        }
      } catch (error) {
        console.warn('[OLLAMA] Erreur appel Ollama:', error.message);
        llmReply = null;
      }
    }
  }

  // Helper: detect greeting-only messages
  function isGreeting(text) {
    if (!text) return false;
    const t = text.trim().toLowerCase();
    return /^(bonjour|salut|coucou|hey|hi|hello)([\s\!\.]|$)/i.test(t) && t.length < 30;
  }

  // Safe profile summary to avoid injecting unexpected strings
  function profileSummaryText(p) {
    if (!p) return '';
    const parts = [];
    if (p.type_fonctionnement) parts.push(`Profil: ${String(p.type_fonctionnement)}`);
    if (p.longueur_pref) parts.push(`Préférence longueur: ${String(p.longueur_pref)}`);
    if (p.format_pref) parts.push(`Format préféré: ${String(p.format_pref)}`);
    return parts.length ? parts.join(' • ') + '\n\n' : '';
  }

  const safeProfilePrefix = profileSummaryText(profile);

  // Use profile preferences to adapt tone, length and format
  const prefLengthRaw = (profile && profile.longueur_pref) ? String(profile.longueur_pref).toLowerCase() : (req.body.verbosity || 'short');
  // Normalize into short|medium|long
  let prefLength = 'short';
  if (/long|longue|détaillé|detaillé/.test(prefLengthRaw)) prefLength = 'long';
  else if (/med|medium|moyen|normal/.test(prefLengthRaw)) prefLength = 'medium';
  else prefLength = 'short';
  const prefFormat = (profile && profile.format_pref) ? String(profile.format_pref).toLowerCase() : 'bullets';
  const besoinValidation = !!(profile && profile.besoin_validation);

  function shortLine(text) { return text.replace(/\s+/g, ' ').trim(); }

  // Compose accessible responses (FALC-inspired: court, clair, étapes)
  if (!message || !message.trim()) {
    response = "Tu n'as rien envoyé. Écris ce que tu veux faire (ex: finir une tâche).";
  } else if (isGreetingMsg) {
    response = (prefLength === 'long') ?
      "Bonjour. Je suis ton assistant. Tu peux choisir :\n1) Une micro‑tâche\n2) Un plan en étapes\n3) Expliquer ce qui te bloque.\nRéponds par 1, 2 ou 3." :
      "Bonjour. Veux‑tu : 1) Une micro‑tâche  2) Un petit plan  3) Parler du blocage ?";
  } else if (isChoice123) {
    const t = String(message).trim();
    if (t === '1') {
      response = "On commence par une seule micro‑tâche. Dis en une phrase ce que tu veux faire en premier.";
    } else if (t === '2') {
      response = "OK pour un petit plan. Écris ton objectif en une phrase, je t’aiderai à le découper.";
    } else {
      response = "Explique en une phrase ce qui te bloque le plus en ce moment, je t’aiderai à trouver une 1ère petite étape.";
    }
  } else if (
    mode === 'surcharge' ||
    (profile && profile.sensibilite_stimulations === 'elevee' && mode !== 'planification') ||
    /(meltdown|shutdown|trop plein|trop-plein|surcharge|surmené|surmene|débordé|deborde|exploser|crise)/i.test((message || '').toString())
  ) {
    const t = (message || '').toString().toLowerCase();
    const contexteMaison = /(maison|chez moi|appart|appartement|chambre|salon|cuisine)/.test(t);
    const contexteTravail = /(travail|bureau|collègue|collegue|réunion|reunion|équipe|equipe)/.test(t);
    const contexteSocial = /(famille|amis|ami|soiree|soirée|repas|sortie)/.test(t);
    const shutdown = /(shutdown|plus d\s*énergie|plus denergie|vide|plus rien)/.test(t);

    const lignes = [];
    if (contexteSocial) {
      lignes.push("Tu es en surcharge dans un contexte social, on va viser le minimum vital, pas la performance sociale.");
    } else if (contexteTravail) {
      lignes.push("Tu es en surcharge au travail, on va sécuriser une micro‑pause avant de penser au reste.");
    } else if (contexteMaison) {
      lignes.push("Tu es en surcharge à la maison, priorité au calme, pas au rangement ni aux tâches.");
    } else {
      lignes.push("On est en mode surcharge, on va viser le minimum vital, pas la performance.");
    }

    lignes.push("1) Si tu peux, éloigne‑toi un peu de la source de surcharge (autre pièce, casque, baisser la lumière).");
    lignes.push("2) Fais 5 respirations lentes : inspire 4 sec, bloque 2 sec, souffle 6 sec.");
    lignes.push("3) Réduis les stimulations pendant quelques minutes (son, notifications, interactions).");

    if (contexteMaison) {
      lignes.push("À la maison, tu peux t’isoler quelques minutes (chambre, salle de bain) si c’est possible.");
      lignes.push("Le désordre peut attendre : priorité = te calmer, pas ranger.");
    }
    if (contexteTravail) {
      lignes.push("Au travail, si tu peux, prends une micro‑pause (toilettes, verre d’eau) pour sortir de la situation quelques minutes.");
    }
    if (contexteSocial) {
      lignes.push("Pendant un repas de famille ou une situation avec beaucoup de monde, tu peux t’autoriser à sortir quelques minutes (dehors, autre pièce, balcon) sans tout expliquer.");
    }
    if (shutdown) {
      lignes.push("Si tu es plutôt en shutdown (plus d’énergie, difficile de parler), contente‑toi de t’asseoir ou t’allonger dans un endroit un peu plus calme et de fermer les yeux ou regarder un point fixe.");
    }

    const extraTips = getSurchargeTips(message, profile);
    if (extraTips.length) {
      lignes.push("");
      lignes.push("Quelques idées supplémentaires qui aident souvent dans ce type de situation :");
      extraTips.forEach(tip => {
        lignes.push(`- ${tip}`);
      });
    }

    lignes.push("Si tu es en danger ou vraiment au bord de la rupture, essaie de joindre une personne de confiance ou les urgences de ton pays.");

    response = (prefLength === 'long')
      ? lignes.join("\n")
      : "On vise le minimum vital : t’éloigner un peu, respirer lentement, réduire les stimulations quelques minutes. Tu peux ensuite m’écrire quand tu te sens un peu plus stable.";
  } else if (mode === 'planification') {
    if (/je commence maintenant/.test((message || '').toString().toLowerCase())) {
      response = "OK, on fait simple : 5 minutes sur une seule petite étape. Quand tu as terminé, dis-moi juste si ça a aidé ou ce qui a coincé.";
    } else {
      response = buildThreeStepPlan(message);
    }
  } else {
    // standard: soit on utilise la réponse LLM, soit on retombe sur les heuristiques
    if (llmReply) {
      response = (req.body && req.body.verbosity === 'short')
        ? miniSummary(llmReply)
        : llmReply;
    } else {
      if (prefFormat === 'puces' || prefFormat === 'bullets' || prefFormat === 'list') {
        response = (prefLength === 'long') ?
          "Actions :\n- Identifie la première petite étape.\n- Fais une action pendant 5 minutes.\n- Reviens me dire si ça a aidé." :
          "- Trouve la 1ère petite étape.\n- Fais 5 minutes maintenant.";
      } else {
        response = (prefLength === 'long') ?
          "Commence par identifier la toute première petite étape, puis fais une action pendant 5 minutes. Ensuite dis‑moi si tu veux un plan détaillé." :
          "Identifie la 1ère petite étape et fais 5 minutes maintenant.";
      }
    }
  }

  // Build suggested quick actions pour le chat (version FALC, limitée)
  const actions = [];
  // Pas d’actions pour un simple bonjour ou un choix 1/2/3
  if (!isGreetingMsg && !isChoice123) {
    // Actions adaptées au profil
    if (Array.isArray(profile.usages_frequents)) {
      // Quick actions personnalisées selon les usages fréquents
      if (profile.usages_frequents.includes('organisation')) {
        actions.push({ id: 'get-plan', label: 'Plan d\'organisation', payload: { message: 'Je veux m\'organiser', mode: 'planification' } });
      }
      if (profile.usages_frequents.includes('concentration')) {
        actions.push({ id: 'start-5', label: '5 min concentration', payload: { message: 'Je me concentre 5 minutes', mode: 'planification' } });
      }
      if (profile.usages_frequents.includes('regulation')) {
        actions.push({ id: 'regulate', label: 'Apaiser mon stress', payload: { message: 'Je me sens tendu, aide-moi à réguler', mode: 'surcharge' } });
      }
    }
    
    // Actions par défaut si aucune personnalisation
    if (actions.length === 0) {
      actions.push({ id: 'start-5', label: 'Faire 5 minutes maintenant', payload: { message: 'Je commence maintenant: je vais faire 5 minutes', mode: 'planification' } });
      actions.push({ id: 'get-plan', label: 'Petit plan en 3 étapes', payload: { message: 'Donne-moi un plan en 3 micro-tâches', mode: 'planification' } });
    }
    
    // Action de régulation si sensibilité élevée
    if (profile.sensibilite_stimulations === 'elevee') {
      actions.push({ id: 'calm', label: 'Calmer mon surcharge', payload: { message: 'Je suis en surcharge sensorielle', mode: 'surcharge' } });
    }
  }

  // One-line summary to help quick scanning
  const oneLine = miniSummary(response || message || '');

  // Profile summary as structured field (client renders it separately)
  const profileSummary = safeProfilePrefix.trim();
  // Try to fetch top examples from local embeddings service (optional)
  const EMB_URL = process.env.EMB_URL || 'http://127.0.0.1:8700/similar';
  let examples = [];
  try {
    const r = await fetch(EMB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: message, k: 3 })
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      if (j && Array.isArray(j.items)) examples = j.items.map(it => ({ score: it.score, message: it.item.message, reply: it.item.reply }));
    }
  } catch (e) {
    // embeddings service not available — skip
  }

  // Do not merge examples into the reply text; return structured payload so client can render cleanly
  const finalReply = response; // profileSummary returned separately
  // Build a short list of concrete steps (micro‑tâches) pour aider à démarrer.
  // Aucune étape pour bonjour / 1 / 2 / 3 : on attend d’abord la formulation du besoin.
  const steps = [];
  const estShort = 5;
  const estMedium = 10;
  const estLong = 20;

  function pushStep(text, est) {
    steps.push({ id: `s${steps.length+1}`, text: shortLine(text), est_minutes: est || estShort });
  }

  // Heuristics to create steps based on mode / message intent
  const msgLower = (message || '').toString().toLowerCase();
  if (isGreetingMsg || isChoice123) {
    // pas d’étapes pour ces premiers échanges
  } else if (mode === 'planification') {
    // en mode planification, le plan en 3 étapes est déjà dans le texte (buildThreeStepPlan)
    // on évite de rajouter une checklist générique qui brouille le message.
  } else if (llmReply) {
    // si la réponse vient du LLM (ex: lettre de motivation), on évite d'ajouter
    // les étapes génériques "Trouve la 1ère petite étape / Fais 5 minutes".
  } else if (/plan|découpe|micro|étape|tâche/.test(msgLower)) {
    pushStep('Écris l’objectif en une phrase.');
    pushStep('Divise cet objectif en 3 petites étapes.');
    pushStep('Commence la première étape pendant 5 minutes.');
  } else if (mode === 'surcharge' || /(meltdown|shutdown|trop plein|trop-plein|surcharge|surmené|surmene|débordé|deborde|exploser|crise)/i.test(msgLower)) {
    if (phase === 'initiale') {
      pushStep('Arrête ce que tu fais et éloigne‑toi un peu de la source de surcharge.');
      pushStep('Fais 5 respirations lentes (4 sec inspire, 2 sec blocage, 6 sec souffle).');
    } else {
      pushStep('Note si t’éloigner / respirer t’a un peu aidé ou pas.');
      pushStep('Si c’est encore trop intense, cherche uniquement à te mettre dans un endroit plus calme et sûr, sans te forcer à rester dans la situation.');
    }
  } else if (/aide|aide-moi|bloqu/.test(msgLower)) {
    pushStep('Décris ce qui bloque en 1 phrase.');
    pushStep('Choisis la plus petite action possible (30–60 sec ou 5 min).');
    pushStep('Essaie cette action maintenant.');
  } else {
    // default short guidance influenced by profile length preference
    if (prefLength === 'long') {
      pushStep('Identifie la première petite étape à faire.');
      pushStep('Fais-la pendant 10 minutes.');
      pushStep('Dis‑moi si tu veux la suite.');
    } else {
      pushStep('Trouve la 1ère petite étape.');
      pushStep('Fais 5 minutes maintenant.');
    }
  }

  // Trim to max 6 steps to avoid overload
  const maxSteps = 6;
  const finalSteps = steps.slice(0, maxSteps);

  res.json({ prompt_used: prompt.slice(0, 200), reply: finalReply, one_line: oneLine, steps: finalSteps, examples, actions, profileSummary });
});
// Simple feedback endpoints
app.post('/feedback', (req, res) => {
  const { message, reply, helpful } = req.body || {};
  if (typeof helpful !== 'boolean') return res.status(400).json({ error: 'missing helpful boolean' });
  const fb = readFeedback();
  const entry = { id: Date.now(), ts: new Date().toISOString(), message: message || '', reply: reply || '', helpful };
  fb.items.push(entry);
  writeFeedback(fb);
  // If helpful, add to examples store (avoid exact-duplicate replies)
  if (helpful) {
    try {
      const ex = readExamples();
      const exists = ex.items.some(it => (it.reply || '').trim() === (reply || '').trim());
      if (!exists) {
        ex.items.push({ id: entry.id, ts: entry.ts, message: entry.message, reply: entry.reply });
        writeExamples(ex);
      }
    } catch (e) {
      console.error('Failed to update examples from feedback', e);
    }
  }
  res.json({ status: 'ok' });
});

// Endpoint pour enregistrer une catégorie apprise via thumbs down
app.post('/feedback/category', (req, res) => {
  const { message, reply, category } = req.body || {};
  if (!message || !category) return res.status(400).json({ error: 'missing message or category' });
  
  const routing = readPlanRouting();
  const keywords = extractKeywords(message);
  
  // Vérifier si une entrée similaire existe déjà
  const existingEntry = routing.entries.find(e => e.category === category);
  
  if (existingEntry && Array.isArray(existingEntry.keywords)) {
    // Fusionner les mots-clés sans doublons
    const mergedKeywords = [...new Set([...existingEntry.keywords, ...keywords])];
    existingEntry.keywords = mergedKeywords.slice(0, 8); // Limiter à 8 mots-clés max
  } else {
    // Créer une nouvelle entrée
    const newEntry = {
      id: Date.now(),
      category,
      keywords,
      ts: new Date().toISOString()
    };
    routing.entries.push(newEntry);
  }
  
  writePlanRouting(routing);
  res.json({ status: 'ok', keywords });
});

app.get('/feedback', (req, res) => {
  const fb = readFeedback();
  res.json(fb);
});

// Return example pairs derived from positive feedback
app.get('/examples', (req, res) => {
  const ex = readExamples();
  res.json(ex);
});

// Rebuild examples.json from feedback.json (dedupe by reply)
app.post('/rebuild-index', (req, res) => {
  try {
    const fb = readFeedback();
    const positives = (fb.items || []).filter(i => i.helpful === true);
    const map = new Map();
    positives.forEach(p => {
      const key = (p.reply || '').trim();
      if (!key) return;
      if (!map.has(key)) map.set(key, { id: p.id, ts: p.ts, message: p.message, reply: p.reply });
    });
    const items = Array.from(map.values());
    writeExamples({ items });
    res.json({ status: 'ok', count: items.length });
  } catch (e) {
    console.error('Failed to rebuild examples', e);
    res.status(500).json({ error: 'rebuild_failed', details: String(e) });
  }
});

// Add an example manually
app.post('/examples', (req, res) => {
  const { message, reply } = req.body || {};
  if (!reply) return res.status(400).json({ error: 'missing reply' });
  try {
    const ex = readExamples();
    const id = Date.now();
    ex.items.push({ id, ts: new Date().toISOString(), message: message || '', reply });
    writeExamples(ex);
    res.json({ status: 'ok', id });
  } catch (e) {
    console.error('Failed to add example', e);
    res.status(500).json({ error: 'add_failed' });
  }
});

// Configuration cloud endpoints
app.get('/cloud-config', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cloud-config.html'));
});

app.get('/get-cloud-config', (req, res) => {
  res.json({
    openai: {
      apiKey: process.env.OPENAI_API_KEY ? '***' : '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ? '***' : '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307'
    },
    ollama: {
      enabled: process.env.OLLAMA_ENABLED === 'true',
      model: process.env.OLLAMA_MODEL || 'mistral',
      url: process.env.OLLAMA_URL || 'http://localhost:11434'
    }
  });
});

app.post('/test-cloud', async (req, res) => {
  const { provider, apiKey, model } = req.body;
  
  try {
    if (provider === 'openai') {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey });
      
      const completion = await openai.chat.completions.create({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Bonjour, réponds simplement "OK OpenAI fonctionne"' }
        ],
        max_tokens: 10
      });
      
      const reply = completion.choices[0]?.message?.content;
      if (reply && reply.includes('OK')) {
        res.json({ success: true, message: 'Connecté et fonctionnel' });
      } else {
        res.json({ success: false, error: 'Réponse inattendue' });
      }
      
    } else if (provider === 'anthropic') {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey });
      
      const message = await anthropic.messages.create({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Bonjour, réponds simplement "OK Anthropic fonctionne"' }
        ]
      });
      
      const reply = message.content[0]?.text;
      if (reply && reply.includes('OK')) {
        res.json({ success: true, message: 'Connecté et fonctionnel' });
      } else {
        res.json({ success: false, error: 'Réponse inattendue' });
      }
    }
    
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/save-cloud-config', async (req, res) => {
  // Note: En production, les clés API devraient être chiffrées
  // Pour le développement, on utilise les variables d'environnement
  
  try {
    const { openai, anthropic, ollama } = req.body;
    
    // Mettre à jour les variables d'environnement (pour cette session)
    if (openai?.apiKey) {
      process.env.OPENAI_API_KEY = openai.apiKey;
      process.env.OPENAI_MODEL = openai.model || 'gpt-4o-mini';
    }
    
    if (anthropic?.apiKey) {
      process.env.ANTHROPIC_API_KEY = anthropic.apiKey;
      process.env.ANTHROPIC_MODEL = anthropic.model || 'claude-3-haiku-20240307';
    }
    
    if (ollama) {
      process.env.OLLAMA_ENABLED = ollama.enabled ? 'true' : 'false';
      process.env.OLLAMA_MODEL = ollama.model || 'mistral';
      process.env.OLLAMA_URL = ollama.url || 'http://localhost:11434';
    }
    
    // Réinitialiser le service cloud avec nouvelles clés
    if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
      try {
        const CloudLLMService = require('./src/cloud_llm');
        cloudLLMService = new CloudLLMService();
        console.log('[CLOUD] Service rechargé avec nouvelle configuration');
      } catch (error) {
        console.warn('[CLOUD] Erreur rechargement:', error.message);
      }
    }
    
    res.json({ success: true, message: 'Configuration sauvegardée' });
    
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Delete example by id
app.delete('/examples/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  try {
    const ex = readExamples();
    const before = ex.items.length;
    ex.items = ex.items.filter(it => Number(it.id) !== id);
    writeExamples(ex);
    res.json({ status: 'ok', removed: before - ex.items.length });
  } catch (e) {
    console.error('Failed to delete example', e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

// Proxy endpoint to request embeddings service to reindex
app.post('/embeddings/reindex', async (req, res) => {
  const EMB_REINDEX = process.env.EMB_REINDEX_URL || 'http://127.0.0.1:8700/reindex';
  try {
    const r = await fetch(EMB_REINDEX, { method: 'POST' });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return res.status(502).json({ error: 'emb_reindex_failed', details: txt });
    }
    const j = await r.json().catch(() => null);
    res.json({ status: 'ok', detail: j });
  } catch (e) {
    console.error('embeddings reindex proxy failed', e);
    res.status(500).json({ error: 'proxy_failed', details: String(e) });
  }
});

app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

app.listen(PORT, () => {
  console.log(`TSA Assistant prototype listening on port ${PORT}`);
});

