import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { generateWithOllama } from './ollama';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROFILE_PATH = path.join(DATA_DIR, 'profile.json');
const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'prompt_system.txt');

function readProfile(): any {
  try {
    const raw = fs.readFileSync(PROFILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function writeProfile(profile: any): void {
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf8');
}

function getLengthPreference(profile: any): 'court' | 'moyen' | 'long' {
  const pref = (profile && profile.longueur_pref) || '';
  if (pref === 'court') return 'court';
  if (pref === 'moyen') return 'moyen';
  return 'long';
}

function getFormatPreference(profile: any): 'bullets' | 'steps' | 'texte_court' {
  const pref = (profile && profile.format_pref) || '';
  if (pref === 'liste') return 'bullets';
  if (pref === 'etapes') return 'steps';
  return 'texte_court';
}

function addValidationIfNeeded(profile: any, text: string): string {
  if (!profile || profile.besoin_validation !== 'eleve') return text;
  const validation = [
    "Ce que tu vis est fréquent chez les personnes TSA/TDAH.",
    "Ce n’est pas un manque de volonté, c’est ton fonctionnement neuro. On va adapter ensemble."
  ].join(' ');
  return `${validation}\n\n${text}`;
}

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/profile', (req: Request, res: Response) => {
  const profile = readProfile();
  res.json(profile);
});

app.get('/onboarding/schema', (req: Request, res: Response) => {
  const schemaPath = path.join(__dirname, '..', 'onboarding', 'questionnaire.json');
  try {
    const raw = fs.readFileSync(schemaPath, 'utf8');
    res.type('application/json').send(raw);
  } catch (e) {
    res.status(500).json({ error: 'questionnaire not found' });
  }
});

// Load and compile JSON schema for profile validation (if available)
let profileSchema: any = null;
try {
  const schemaRaw = fs.readFileSync(path.join(__dirname, '..', 'schema', 'profile.schema.json'), 'utf8');
  profileSchema = JSON.parse(schemaRaw);
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('profile schema not found or invalid');
}
const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);
const validateProfile = profileSchema ? ajv.compile(profileSchema) : null;

const EMB_SERVICE_URL = process.env.EMB_SERVICE_URL || 'http://127.0.0.1:8700';

async function fetchSimilarExamples(query: string, k = 5): Promise<any[]> {
  if (!query) return [];
  try {
    const res = await fetch(`${EMB_SERVICE_URL}/similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, k })
    } as any);
    if (!res.ok) return [];
    const json: any = await res.json();
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

function detectUseCase(message: string): 'organisation' | 'communication' | 'rendezvous' | 'routine' | 'surcharge_emotionnelle' | 'autre' {
  const m = (message || '').toLowerCase();
  if (/(organis|organisation|projet|devoir|maison|bazar|ranger|tâches|taches)/.test(m)) return 'organisation';
  if (/(mail|email|message|sms|répondre|repondre|réponse|reponse|écrire|ecrire)/.test(m)) return 'communication';
  if (/(rendez[- ]?vous|rdv|médecin|medecin|psy|entretien|réunion|reunion|école|ecole|employeur)/.test(m)) return 'rendezvous';
  if (/(matin|soir|routine|quotidien|habitude)/.test(m)) return 'routine';
  if (/(meltdown|shutdown|trop plein|surmené|surmene|débordé|deborde|crise|exploser|effondrer)/.test(m)) return 'surcharge_emotionnelle';
  return 'autre';
}

function limitPoints(points: string[], profile: any): string[] {
  const pref = getLengthPreference(profile);
  if (pref === 'court') return points.slice(0, 3);
  if (pref === 'moyen') return points.slice(0, 6);
  return points;
}

function formatList(title: string, points: string[], profile: any): string {
  const limited = limitPoints(points, profile);
  const body = limited.map(p => `- ${p}`).join('\n');
  return `${title}\n\n${body}`;
}

function formatSteps(title: string, steps: string[], profile: any): string {
  const limited = limitPoints(steps, profile);
  const body = limited.map((s, i) => `${i + 1}) ${s}`).join('\n');
  return `${title}\n\n${body}`;
}

function buildOrganisationReply(message: string, profile: any, miniSummary: (t: string) => string): string {
  const header = miniSummary(message);
  const format = getFormatPreference(profile);
  const points = [
    "Choisis une seule zone ou tâche (ex. juste le bureau, ou juste le devoir X).",
    "Définis une micro‑tâche de 5 minutes (ex. ramasser les papiers visibles, ouvrir le document du devoir).",
    "Lance un timer de 5 minutes et arrête‑toi quand il sonne, même si tu n’as pas tout fini.",
    "Si tu te sens encore ok, refais un autre bloc de 5 minutes, sinon fais une pause.",
    "Note quelque part ce que tu as déjà fait pour visualiser l’avancement.",
    "Si tu bloques, réduis encore: une seule action comme ouvrir le fichier ou prendre un sac poubelle."
  ];

  let body: string;
  if (format === 'steps') {
    body = formatSteps('Plan d’organisation en micro‑tâches :', points, profile);
  } else {
    body = formatList('Plan d’organisation en micro‑tâches :', points, profile);
  }

  const text = `${header}\n\n${body}\n\nTu peux t’arrêter après un seul bloc de 5 minutes, ça compte déjà. Si tu veux, je peux t’aider à détailler pour une tâche précise.`;
  return addValidationIfNeeded(profile, text);
}

function buildCommunicationReply(message: string, profile: any, miniSummary: (t: string) => string): string {
  const header = miniSummary(message);
  const scripts = [
    'Version courte et neutre :\n"Bonjour,\nJe vous remercie pour votre message. Voici ma réponse : [ta réponse en 1–2 phrases].\nCordialement,\n[ton prénom]"',
    'Version un peu plus détaillée :\n"Bonjour,\nMerci pour votre message. Je voulais préciser quelques points :\n- [point 1]\n- [point 2]\nSi quelque chose n’est pas clair, n’hésitez pas à me le dire.\nCordialement,\n[ton prénom]"',
    'Si tu veux signaler ton profil neuroatypique :\n"Je préfère préciser que j’ai un fonctionnement neuroatypique (TSA/TDAH). J’ai parfois besoin que les informations soient très claires et directes. N’hésitez pas à me reformuler si besoin."'
  ];
  const body = scripts.join('\n\n');
  const text = `${header}\n\nVoici quelques modèles de réponses que tu peux copier‑coller et adapter :\n\n${body}`;
  return addValidationIfNeeded(profile, text);
}

function buildRendezVousReply(message: string, profile: any, miniSummary: (t: string) => string): string {
  const header = miniSummary(message);
  const steps = [
    'Note les motifs du rendez‑vous : ce qui te pose problème en ce moment (symptômes, situations difficiles, questions).',
    'Prépare 3 points maximum que tu veux absolument aborder pendant le rendez‑vous.',
    'Note des exemples concrets (situations vécues) pour illustrer chaque point.',
    'Prépare une phrase d’intro sur ton fonctionnement : ex. "J’ai un fonctionnement TSA/TDAH, j’ai parfois besoin que les explications soient claires et concrètes."',
    'Prends de quoi écrire ou ton téléphone pour noter les réponses importantes.',
    'Si c’est possible, viens avec quelqu’un de confiance ou envoie tes notes au professionnel avant le rendez‑vous.'
  ];
  const body = formatSteps('Plan pour préparer ton rendez‑vous :', steps, profile);
  const text = `${header}\n\n${body}\n\nTu peux aussi imprimer ou montrer ces notes pendant le rendez‑vous.`;
  return addValidationIfNeeded(profile, text);
}

function buildRoutineReply(message: string, profile: any, miniSummary: (t: string) => string): string {
  const header = miniSummary(message);
  const format = getFormatPreference(profile);
  const minimum = [
    'Boire un verre d’eau.',
    'Te laver le visage ou les dents (au choix).',
    'Prendre un médicament important s’il y en a.',
    'Manger quelque chose de simple (même un petit snack).'
  ];
  const standard = [
    'Te lever et ouvrir les volets / la fenêtre si possible.',
    'Boire un verre d’eau.',
    'Faire un passage rapide par la salle de bain (dents, visage, déodorant).',
    'Manger un petit déjeuner simple.',
    'Regarder ton planning du jour (3 tâches maximum à retenir).'
  ];

  let bodyMin: string;
  let bodyStd: string;
  if (format === 'steps') {
    bodyMin = formatSteps('Routine minimum pour les jours de grosse fatigue :', minimum, profile);
    bodyStd = formatSteps('Routine standard :', standard, profile);
  } else {
    bodyMin = formatList('Routine minimum pour les jours de grosse fatigue :', minimum, profile);
    bodyStd = formatList('Routine standard :', standard, profile);
  }

  const text = `${header}\n\n${bodyMin}\n\n${bodyStd}\n\nTu peux cocher chaque étape ou les mettre sous forme de liste visuelle (post‑it, tableau, appli).`;
  return addValidationIfNeeded(profile, text);
}

function buildSurchargeEmotionnelleReply(message: string, profile: any, miniSummary: (t: string) => string): string {
  const header = miniSummary(message);
  const m = (message || '').toLowerCase();
  const contexteMaison = /(maison|chez moi|appart|appartement|chambre|salon|cuisine)/.test(m);
  const contexteTravail = /(travail|bureau|collègue|collegue|réunion|reunion|équipe|equipe)/.test(m);
  const contexteSocial = /(famille|amis|ami|soiree|soirée|repas|sortie)/.test(m);
  const shutdown = /(shutdown|plus d\s*énergie|plus denergie|vide|plus rien)/.test(m);

  const baseSteps = [
    'Si tu peux, éloigne‑toi légèrement de la source de surcharge (changer de pièce, mettre un casque, baisser la lumière).',
    'Fais 5 respirations lentes : inspire 4 secondes, bloque 2 secondes, souffle 6 secondes.',
    'Réduis les stimulations pendant quelques minutes : son, notifications, lumières, interactions.',
    'Choisis une seule chose à communiquer aux autres (si tu peux) : par exemple "Je suis en surcharge, j’ai besoin de calme quelques minutes."',
    'Si tu es en danger ou que tu te sens vraiment au bord de la rupture, contacte une personne de confiance ou les services d’urgence de ton pays.'
  ];

  const extraMaison = contexteMaison
    ? [
        'Si tu n’es qu’avec des personnes de confiance, tu peux t’isoler dans une pièce (chambre, salle de bain) quelques minutes.',
        'Si le désordre te surcharge, ne t’en occupe pas maintenant : priorité = te calmer, le rangement pourra venir plus tard.'
      ]
    : [];

  const extraTravail = contexteTravail
    ? [
        'Si c’est possible au travail, prétexte une courte pause (toilettes, verre d’eau, appel rapide) pour sortir de la situation quelques minutes.',
        'Tu peux utiliser une phrase courte avec un collègue de confiance : "Je suis submergé·e, je prends 5 minutes de pause et je reviens."'
      ]
    : [];

  const extraSocial = contexteSocial
    ? [
        'Dans un contexte social (famille, amis), tu peux t’autoriser à sortir quelques minutes (aller dehors, dans une autre pièce, aux toilettes).',
        'Tu peux envoyer un message écrit plutôt que parler si c’est plus facile pour toi.'
      ]
    : [];

  const extraShutdown = shutdown
    ? [
        'Si tu es en mode "shutdown" (plus d’énergie, difficulté à parler), concentre‑toi sur des gestes très simples : t’asseoir ou t’allonger dans un endroit un peu plus calme, fermer les yeux ou regarder un point fixe.',
        'Tu peux utiliser un message ou une carte pré‑écrite pour expliquer plus tard ce qui s’est passé, quand tu auras récupéré un peu d’énergie.'
      ]
    : [];

  const allSteps = baseSteps.concat(extraMaison, extraTravail, extraSocial, extraShutdown);
  const body = formatSteps('Plan très simple pour traverser la surcharge maintenant :', allSteps, profile);
  let text = `${header}\n\n${body}\n\nJe ne remplace pas un suivi médical ou une aide humaine. Si la situation devient trop difficile ou dangereuse, il est important de chercher du soutien auprès de professionnels ou de personnes de confiance.`;
  text = addValidationIfNeeded(profile, text);
  return text;
}

app.get('/onboarding', (req: Request, res: Response) => {
  res.redirect('/onboarding.html');
});

app.post('/onboarding/submit', (req: Request, res: Response) => {
  const submitted = req.body || {};
  const profile = Object.assign({}, readProfile());
  if (submitted.type_fonctionnement) profile.type_fonctionnement = submitted.type_fonctionnement;
  if (submitted.longueur_pref) profile.longueur_pref = submitted.longueur_pref;
  if (submitted.format_pref) profile.format_pref = submitted.format_pref;
  if (Array.isArray(submitted.difficultes_principales)) profile.difficultes_principales = submitted.difficultes_principales;
  if (submitted.sensibilite_stimulations) profile.sensibilite_stimulations = submitted.sensibilite_stimulations;
  if (submitted.besoin_validation) profile.besoin_validation = submitted.besoin_validation;
  if (Array.isArray(submitted.usages_frequents)) profile.usages_frequents = submitted.usages_frequents;
  profile.derniere_mise_a_jour = new Date().toISOString();

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

app.put('/profile', (req: Request, res: Response) => {
  const newProfile = req.body;
  writeProfile(newProfile);
  res.json({ status: 'ok', profile: newProfile });
});

// /ask can use Ollama if available. Otherwise use local heuristic.
app.post('/ask', async (req: Request, res: Response) => {
  const { message, mode } = req.body || {};
  const profile = readProfile();
  const prompt = fs.existsSync(PROMPT_PATH) ? fs.readFileSync(PROMPT_PATH, 'utf8') : '';

  function miniSummary(text: string) {
    const s = (text || '').trim();
    if (!s) return 'Tu n’as rien envoyé.';
    return s.split(/[\.\!\?]\s/)[0].slice(0, 200);
  }

  // If environment variable OLLAMA_ENABLED=true, try to call Ollama
  if (process.env.OLLAMA_ENABLED === 'true') {
    try {
      const model = process.env.OLLAMA_MODEL || 'llama2';
      const promptToSend = `${prompt}\nUtilisateur: ${message}`;
      const text = await generateWithOllama(promptToSend, { model });
      const examples = await fetchSimilarExamples(message || '', 5);
      return res.json({ prompt_used: prompt.slice(0, 200), reply: text, examples });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Ollama error, falling back to heuristic', err);
    }
  }

  const useCase = detectUseCase(message || '');
  let response = '';

  if (mode === 'surcharge' || (profile && profile.sensibilite_stimulations === 'elevee' && mode !== 'planification')) {
    const text = `${miniSummary(message)}\n\n- Micro‑tâche : choisis une seule petite action (ex. ouvrir le document, sortir un cahier).\n- Si tu te sens saturé·e, fais une pause de 3 à 5 minutes dans un endroit plus calme si possible.`;
    response = addValidationIfNeeded(profile, text);
  } else if (mode === 'planification') {
    const steps = [
      'Écrire en une phrase ce que tu veux avoir terminé.',
      'Découper en petites étapes de 5 à 25 minutes maximum.',
      'Placer 1 à 3 blocs dans ton planning (pas toute la semaine si c’est trop).',
      'Prévoir une micro‑récompense après chaque bloc (pause, activité agréable).'
    ];
    const body = formatSteps('Planification simple :', steps, profile);
    const text = `${miniSummary(message)}\n\n${body}\n\nOn pourra ensuite détailler chaque étape si tu le souhaites.`;
    response = addValidationIfNeeded(profile, text);
  } else {
    switch (useCase) {
      case 'organisation':
        response = buildOrganisationReply(message || '', profile, miniSummary);
        break;
      case 'communication':
        response = buildCommunicationReply(message || '', profile, miniSummary);
        break;
      case 'rendezvous':
        response = buildRendezVousReply(message || '', profile, miniSummary);
        break;
      case 'routine':
        response = buildRoutineReply(message || '', profile, miniSummary);
        break;
      case 'surcharge_emotionnelle':
        response = buildSurchargeEmotionnelleReply(message || '', profile, miniSummary);
        break;
      case 'autre':
      default: {
        const format = getFormatPreference(profile);
        const points = [
          'Clarifier ce qui te pose le plus problème en ce moment (une phrase).',
          'Choisir une seule petite action pour avancer un peu.',
          'Prévoir une courte pause après cette action.',
          'Si tu veux, tu peux me demander un plan en étapes plus détaillé.'
        ];
        const body = format === 'steps'
          ? formatSteps('Proposition de prochaine petite étape :', points, profile)
          : formatList('Proposition de prochaine petite étape :', points, profile);
        const text = `${miniSummary(message)}\n\n${body}`;
        response = addValidationIfNeeded(profile, text);
        break;
      }
    }
  }

  let prefix = '';
  if (profile && profile.type_fonctionnement) {
    prefix += `Profil: ${profile.type_fonctionnement}`;
    if (profile.format_pref) prefix += ` • Préf: ${profile.format_pref}`;
    prefix += '\n\n';
  }

  const examples = await fetchSimilarExamples(message || '', 5);

  res.json({ prompt_used: prompt.slice(0, 200), reply: prefix + response, examples });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TSA Assistant prototype listening on port ${PORT}`);
});
