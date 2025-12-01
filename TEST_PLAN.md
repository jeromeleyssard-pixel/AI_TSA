# Plan de Test Complet - TSA Assistant Vercel

## 🎯 Objectif
Vérifier que toutes les fonctionnalités sont opérationnelles après les corrections critiques

---

## 📋 Checklist de Test (à faire sur URL Vercel)

### 🟢 Test 1: Fonctionnalités de Base (5 min)

#### 1.1 Connexion et Interface
- [ ] L'application se charge sans erreur 404/500
- [ ] L'icône personnalisée apparaît dans l'onglet
- [ ] Le timer 5 minutes est visible dans l'interface
- [ ] Le champ de saisie fonctionne

#### 1.2 Messages Simples
- [ ] **Test: "bonjour"** 
  - ✅ Attendu: "Bonjour ! Je suis ton assistant TSA/TDAH..."
  - ❌ Échec: "j'ai un problème technique" ou erreur 500
  
- [ ] **Test: "salut"**
  - ✅ Attendu: Variation différente de "bonjour"
  - ❌ Échec: Même réponse ou erreur

- [ ] **Test: "aide-moi"**
  - ✅ Attendu: "Bien sûr que je vais t'aider !..."
  - ❌ Échec: Réponse générique ou erreur

---

### 🧠 Test 2: Anti-Répétition (3 min)

#### 2.1 Détection de Répétition
- [ ] **Message 1: "je stresse"**
  - ✅ Attendu: Technique de respiration
  - Note: Copier la réponse exacte

- [ ] **Message 2: "je stresse encore"** 
  - ✅ Attendu: Réponse DIFFÉRENTE du message 1
  - ❌ Échec: Même réponse que message 1

- [ ] **Message 3: "ça va pas"**
  - ✅ Attendu: 3ème variation différente
  - ❌ Échec: Répétition des précédentes

#### 2.2 Variations des Techniques
- [ ] **Test: "j'ai peur"**
  - ✅ Attendu: Variation de respiration différente
  - ❌ Échec: Même technique que "je stresse"

---

### 🎯 Test 3: Raisonnement Contextuel (5 min)

#### 3.1 Détection de Patterns
- [ ] **Anxiété répétée (2ème fois):**
  - Messages: "je stresse" → réponse → "je stresse encore"
  - ✅ Attendu: "Je vois que l'anxiété revient. Cette fois, essayons une approche différente..."
  - ❌ Échec: Template normal ou erreur

#### 3.2 Messages Complexes
- [ ] **Test: "je stresse beaucoup à cause du travail et de ma famille"**
  - ✅ Attendu: "Ton message montre plusieurs sources d'inquiétude. Décomposons ça..."
  - ❌ Échec: Réponse simple ou erreur

#### 3.3 Énergie et Procrastination
- [ ] **Test: "j'ai la flemme mais je dois travailler"**
  - ✅ Attendu: "J'analyse ta situation : tu mentions vouloir faire quelque chose mais je sens une faible énergie..."
  - ❌ Échec: Template normal

---

### 💾 Test 4: Sauvegarde Profil (3 min)

#### 4.1 Création Profil
- [ ] Aller dans l'onboarding ou profil
- [ ] Remplir le formulaire:
  - Type: TDAH ou TSA
  - Longueur: courte
  - Format: liste
- [ ] **Sauvegarder**
  - ✅ Attendu: "Profile saved successfully" (pas d'erreur 500)
  - ❌ Échec: Erreur 500 ou "Failed to save profile"

#### 4.2 Utilisation Profil
- [ ] Retourner au chat
- [ ] **Test: "bonjour"** (avec profil)
  - ✅ Attendu: Réponse adaptée au profil (TSA/TDAH)
  - ❌ Échec: Même réponse qu'avant profil

---

### ⏱️ Test 5: Timer 5 Minutes (2 min)

#### 5.1 Fonctionnalités Timer
- [ ] **Clique sur "⏱️ 5 min"**
  - ✅ Attendu: Timer démarre, progression visible
  - ❌ Échec: Timer ne démarre pas ou erreur

- [ ] **Couleurs de progression:**
  - ✅ Attendu: Vert → Orange → Rouge selon temps
  - ❌ Échec: Pas de changement de couleur

- [ ] **Pause/Reprise:**
  - ✅ Attendu: Bouton pause fonctionne, reprise possible
  - ❌ Échec: Pause ne fonctionne pas

- [ ] **Notification finale:**
  - ✅ Attendu: Notification sonore et visuelle à 5 minutes
  - ❌ Échec: Pas de notification

---

### 🔧 Test 6: Robustesse (2 min)

#### 6.1 Messages Edge Cases
- [ ] **Test: Message vide** → Pas de crash
- [ ] **Test: Message très long (500+ chars)** → Pas de crash
- [ ] **Test: Caractères spéciaux** → Pas de crash
- [ ] **Test: "??????"** → Réponse cohérente

#### 6.2 Navigation
- [ ] **Recharger la page** → Conversation préservée
- [ ] **Ouvrir nouvel onglet** → Nouvelle session
- [ ] **Revenir après 5 min** → Toujours fonctionnel

---

## 📊 Grille de Résultats

### Score de Succès: ____/20

#### Points Critiques (10 points):
- [ ] Pas d'erreur 500 sur les messages (3 pts)
- [ ] Anti-répétition fonctionne (3 pts) 
- [ ] Raisonnement contextuel actif (2 pts)
- [ ] Profil se sauvegarde (2 pts)

#### Points Importants (6 points):
- [ ] Timer 5 minutes fonctionnel (2 pts)
- [ ] Variations intelligentes (2 pts)
- [ ] Interface stable (2 pts)

#### Points Bonus (4 points):
- [ ] Icöne personnalisée visible (1 pt)
- [ ] Réponses contextuelles (1 pt)
- [ ] Robustesse edge cases (1 pt)
- [ ] Performance rapide (1 pt)

---

## 🎯 Critères de Validation

### ✅ Succès (16-20/20):
- Application entièrement fonctionnelle
- Toutes les fonctionnalités principales actives
- Expérience utilisateur fluide

### ⚠️ Partiel (10-15/20):
- Fonctionnalités de base actives
- Quelques problèmes mineurs
- Utilisable mais améliorable

### ❌ Échec (<10/20):
- Problèmes critiques (erreurs 500)
- Fonctionnalités principales cassées
- Non utilisable

---

## 🚀 Instructions de Test

1. **Ouvrir l'URL Vercel**
2. **Suivre la checklist dans l'ordre**
3. **Noter chaque résultat ✅/❌**
4. **Calculer le score final**
5. **Reporter les problèmes spécifiques**

---

## 📝 Template de Report

```
## Résultats Test - [Date]

### Score Final: __/20
### Statut: ✅ Succès / ⚠️ Partiel / ❌ Échec

### Problèmes Identifiés:
- [Liste des problèmes avec détails]

### Fonctionnalités OK:
- [Liste de ce qui fonctionne]

### Recommandations:
- [Actions correctives si besoin]
```

---

## ⏡ Temps Estimé: 20-25 minutes

Ce plan de test complet garantit que toutes les corrections sont validées et que l'application est prête pour la production !
