(function(){
  const chatEl = document.getElementById('chat');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const editProfile = document.getElementById('editProfile');
  const verbosity = document.getElementById('verbosity');

  // Mode buttons behaviour and persistence
  const modeButtons = document.querySelectorAll('.mode-btn');
  function setActiveMode(m){
    modeButtons.forEach(b=> b.classList.toggle('active', b.dataset.mode===m));
    try{ sessionStorage.setItem('tsa_mode', m); }catch(e){}
  }
  modeButtons.forEach(b=> b.addEventListener('click', ()=> setActiveMode(b.dataset.mode)));
  try{ const saved = sessionStorage.getItem('tsa_mode'); if (saved) setActiveMode(saved); else setActiveMode('standard'); }catch(e){}
  try{ const v = sessionStorage.getItem('tsa_verbosity'); if (v && verbosity) verbosity.value = v; }catch(e){}
  if (verbosity) verbosity.addEventListener('change', ()=>{ try{ sessionStorage.setItem('tsa_verbosity', verbosity.value); }catch(e){} });

  // Advanced toggle: hide advanced controls by default
  const toggleAdvanced = document.getElementById('toggleAdvanced');
  const advancedControls = document.getElementById('advancedControls');
  if (advancedControls) advancedControls.style.display = 'none';
  if (toggleAdvanced) toggleAdvanced.addEventListener('change', (ev)=>{
    if (ev.target.checked) advancedControls.style.display = 'flex'; else advancedControls.style.display = 'none';
  });

  // Keyboard behaviour: Enter to send, Shift+Enter newline
  if (input) input.addEventListener('keydown', (ev)=>{
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      form.requestSubmit();
    }
  });

  // After sending, focus back to input
  if (form) form.addEventListener('submit', ()=> setTimeout(()=> input && input.focus(), 50));

  // Edit profile button
  if (editProfile) {
    editProfile.addEventListener('click', () => {
      window.location.href = '/onboarding.html';
    });
  }

  function appendMessage(text, who){
    const d = document.createElement('div');
    d.className = 'msg ' + (who === 'user' ? 'user' : 'bot');
    // preserve newlines
    const pre = document.createElement('div');
    pre.className = 'msg-text';
    pre.textContent = text;
    d.appendChild(pre);
    chatEl.appendChild(d);
    chatEl.scrollTop = chatEl.scrollHeight;
    return d;
  }

  function renderExamplesBlock(container, examples){
    if (!examples || !examples.length) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'examples-block-wrapper';

    const toggleRow = document.createElement('div');
    toggleRow.className = 'ex-toggle';
    const title = document.createElement('div');
    title.textContent = `Exemples pertinents (${examples.length})`;
    const btn = document.createElement('button');
    btn.textContent = 'Afficher';
    btn.className = 'ex-toggle-btn';
    toggleRow.appendChild(title);
    toggleRow.appendChild(btn);
    wrapper.appendChild(toggleRow);

    const exBlock = document.createElement('div');
    exBlock.className = 'examples-block';
    exBlock.style.display = 'none';
    examples.forEach((e, idx) => {
      const item = document.createElement('div');
      item.className = 'ex-item';
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = `Exemple ${idx+1} — score: ${Number(e.score||0).toFixed(2)}`;
      const um = document.createElement('div'); um.className = 'ex-user'; um.textContent = `Utilisateur: ${e.message || '(vide)'}`;
      const rp = document.createElement('div'); rp.className = 'ex-reply'; rp.textContent = `Réponse: ${e.reply || ''}`;
      item.appendChild(meta); item.appendChild(um); item.appendChild(rp);
      exBlock.appendChild(item);
    });
    wrapper.appendChild(exBlock);

    btn.addEventListener('click', ()=>{
      const open = exBlock.style.display === 'block';
      exBlock.style.display = open ? 'none' : 'block';
      btn.textContent = open ? 'Afficher' : 'Masquer';
    });

    container.appendChild(wrapper);
  }

  function appendBotWithFeedback(replyText, originalMessage, examples, actions, steps, oneLine){
    const container = document.createElement('div');
    container.className = 'msg bot';

    // one-line summary for quick scanning (if provided by server)

    // examples block
    renderExamplesBlock(container, examples || []);

    // On n'affiche plus one_line pour éviter les répétitions visuelles

    const orig = (originalMessage || '').trim().toLowerCase();
    const isGreeting = orig && /^(bonjour|salut|coucou|hey|hi|hello)([\s\!\.]|$)/.test(orig) && orig.length < 30;
    const isChoice123 = orig === '1' || orig === '2' || orig === '3';

    // steps block (checklist) — pas pour bonjour / 1 / 2 / 3
    if (!isGreeting && !isChoice123 && steps && Array.isArray(steps) && steps.length) {
      const stepsWrap = document.createElement('div'); stepsWrap.className = 'steps-block';
      const stTitle = document.createElement('div'); stTitle.className = 'steps-title'; stTitle.textContent = `Étapes (${steps.length})`;
      stepsWrap.appendChild(stTitle);
      const ol = document.createElement('ol'); ol.className = 'steps-list';
      // accessibility: mark as list and give a clear label
      ol.setAttribute('role', 'list');
      ol.setAttribute('aria-label', `Liste d'étapes — ${steps.length} éléments`);
      steps.forEach(s => {
        const li = document.createElement('li'); li.className = 'step-item';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'step-cb'; cb.id = `step-${s.id}`;
        const lbl = document.createElement('label'); lbl.htmlFor = cb.id; lbl.textContent = `${s.text} (${s.est_minutes} min)`;
        li.appendChild(cb); li.appendChild(lbl);
        ol.appendChild(li);
      });
      stepsWrap.appendChild(ol);
      container.appendChild(stepsWrap);
    }

    // reply
    const replyDiv = document.createElement('div'); replyDiv.className = 'bot-reply';
    // preserve newlines
    replyDiv.textContent = replyText || '';
    container.appendChild(replyDiv);

    // actions (quick buttons) — éviter la surcharge sur un simple bonjour
    if (!isGreeting && actions && Array.isArray(actions) && actions.length){
      const actionsRow = document.createElement('div'); actionsRow.className = 'actions-row';
      actions.forEach((a)=>{
        const b = document.createElement('button');
        b.className = 'quick-action';
        b.textContent = a.label || a.name || 'Action';
        b.setAttribute('tabindex', '0');
        b.setAttribute('role', 'button');
        b.setAttribute('aria-label', a.label || a.name || 'Action rapide');
        b.addEventListener('click', ()=>{
          // disable while processing
          b.disabled = true;

          // Si c'est le bouton 5 minutes, ouvrir le minuteur visuel
          if (a.id === 'start-5') {
            openFiveMinuteTimer();
          }

          // Construire la payload envoyée à /ask à partir de a.payload (si objet) ou du message d'origine
          let base = (a && typeof a.payload === 'object' && a.payload !== null)
            ? Object.assign({}, a.payload)
            : { message: originalMessage };

          // Pour le bouton "Petit plan en 3 étapes", on garde le contexte de la demande
          // initiale et on ajoute simplement la consigne de plan, pour éviter une réponse
          // générique déconnectée (ex: lettre de motivation).
          if (a.id === 'get-plan') {
            const ctx = (originalMessage || '').trim();
            const suffix = ' Peux-tu me proposer un petit plan en 3 étapes très simples ?';
            base.message = ctx ? (ctx + '\n\n' + suffix) : suffix;
            base.mode = 'planification';
          }

          // Texte affiché côté utilisateur
          const displayText = (typeof base.message === 'string' && base.message.trim())
            ? base.message
            : (a.label || a.name || originalMessage);

          const payload = base;
          payload.phase = payload.phase || 'apres_plan';
          try { payload.mode = payload.mode || sessionStorage.getItem('tsa_mode') || 'standard'; } catch(e) { payload.mode = payload.mode || 'standard'; }
          try { payload.verbosity = payload.verbosity || ((verbosity && verbosity.value) ? verbosity.value : (sessionStorage.getItem('tsa_verbosity') || 'short')); } catch(e) { payload.verbosity = payload.verbosity || 'short'; }

          // Ajouter un message d'attente si la requête pourrait utiliser le LLM
          const mightUseLlm = payload.message && 
            payload.message.length > 8 && 
            !/(bonjour|salut|coucou|hey|hi|hello)[\s\!\.\,]*$/i.test(payload.message.trim()) &&
            !/^[123]$/.test(payload.message.trim()) &&
            payload.mode !== 'planification'; // Le mode planification utilise surtout les heuristiques
          
          let waitingMessage = null;
          if (mightUseLlm) {
            waitingMessage = appendMessage('🤔 Un peu de patience, je réfléchis à ta demande...', 'bot');
          }

          fetch('/ask', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
            .then(r=>r.json().catch(()=>({})))
            .then(j=>{
              // Supprimer le message d'attente
              if (waitingMessage) {
                waitingMessage.remove();
              }
              
              // afficher le texte utilisateur correspondant à l'action
              appendMessage(displayText, 'user');
              const newSteps = j.steps || [];
              const newExamples = j.examples || [];
              const newActions = j.actions || [];
              const newOne = j.one_line || '';
              appendBotWithFeedback(j.reply || j.text || '[pas de réponse]', payload.message, newExamples, newActions, newSteps, newOne);
            }).catch(()=>{
              // Supprimer le message d'attente même en cas d'erreur
              if (waitingMessage) {
                waitingMessage.remove();
              }
            }).finally(()=>{ b.disabled = false; });
        });
        actionsRow.appendChild(b);
      });
      container.appendChild(actionsRow);
    }

    // feedback controls
    const fb = document.createElement('div'); fb.className = 'feedback-controls'; fb.style.marginTop = '6px';
    const up = document.createElement('button'); up.textContent = '👍'; up.title = 'Utile'; up.className = 'fb-btn';
    const down = document.createElement('button'); down.textContent = '👎'; down.title = 'Pas utile'; down.className = 'fb-btn';
    fb.appendChild(up); fb.appendChild(down);
    container.appendChild(fb);

    function sendFeedback(helpful){
      up.disabled = down.disabled = true;
      fetch('/feedback', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ message: originalMessage, reply: replyText, helpful }) }).catch(()=>{});
      
      // Si feedback négatif, proposer de choisir une catégorie
      if (!helpful) {
        showCategorySelector(originalMessage, replyText, container);
      }
    }
    up.addEventListener('click', ()=> sendFeedback(true));
    down.addEventListener('click', ()=> sendFeedback(false));

    chatEl.appendChild(container);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function showCategorySelector(originalMessage, replyText, parentContainer) {
    // Créer un bloc pour la sélection de catégorie
    const selectorBlock = document.createElement('div');
    selectorBlock.className = 'category-selector';

    const question = document.createElement('div');
    question.textContent = 'Cette réponse ne t\'a pas aidé·e. Ta situation ressemble le plus à :';
    selectorBlock.appendChild(question);

    const categories = [
      { id: 'sante_medical', label: 'Santé' },
      { id: 'travail_pro', label: 'Travail / projet pro' },
      { id: 'etudes_revisions', label: 'Études / devoirs' },
      { id: 'menage_rangement', label: 'Maison / rangement' },
      { id: 'relations_voisinage', label: 'Relations / voisin / bruit' },
      { id: 'amour_couple', label: 'Amour / couple' },
      { id: 'emotions_stress', label: 'Émotions / stress' },
      { id: 'administratif', label: 'Administratif' },
      { id: 'autre', label: 'Autre' }
    ];

    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'category-buttons-row';

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.textContent = cat.label;
      btn.className = 'category-btn';

      btn.addEventListener('click', () => {
        // Envoyer la catégorie au backend
        fetch('/feedback/category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: originalMessage,
            reply: replyText,
            category: cat.id
          })
        }).then(() => {
          // Remplacer le sélecteur par un message de confirmation
          selectorBlock.innerHTML = '';
          const thanks = document.createElement('div');
          thanks.textContent = 'Merci ! Je m\'en souviendrai pour les prochaines fois.';
          thanks.style.color = '#4caf50';
          thanks.style.fontStyle = 'italic';
          thanks.style.padding = '8px';
          selectorBlock.appendChild(thanks);
        }).catch(() => {
          selectorBlock.innerHTML = '';
          const error = document.createElement('div');
          error.textContent = 'Erreur lors de l\'enregistrement.';
          error.style.color = '#f44336';
          error.style.padding = '8px';
          selectorBlock.appendChild(error);
        });
      });

      buttonsRow.appendChild(btn);
    });

    selectorBlock.appendChild(buttonsRow);
    parentContainer.appendChild(selectorBlock);
  }

  form.addEventListener('submit', async (e) =>{
    e.preventDefault();
    const msg = (input && input.value || '').trim();
    if (!msg) return;
    appendMessage(msg, 'user');
    if (input) input.value = '';
    const placeholder = appendMessage('...', 'bot');
    try {
      const payload = { message: msg, phase: 'initiale' };
      try { payload.mode = sessionStorage.getItem('tsa_mode') || 'standard'; } catch(e) { payload.mode = 'standard'; }
      try { payload.verbosity = (verbosity && verbosity.value) ? verbosity.value : (sessionStorage.getItem('tsa_verbosity') || 'short'); } catch(e) { payload.verbosity = 'short'; }
      
      // Ajouter un message d'attente si Ollama est activé et le message n'est pas trivial
      const shouldUseLlm = msg && 
        msg.length > 8 && 
        !/(bonjour|salut|coucou|hey|hi|hello)[\s\!\.\,]*$/i.test(msg.trim()) &&
        !/^[123]$/.test(msg.trim()) &&
        !/(ok|d'accord|merci|au revoir|bye|à plus|à bientôt)[\s\!\.\,]*$/i.test(msg.trim());
      
      let waitingMessage = null;
      if (shouldUseLlm) {
        waitingMessage = appendMessage('🤔 Un peu de patience, je réfléchis à ta demande...', 'bot');
      }
      
      const res = await fetch('/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json().catch(()=> ({}));
      
      // Supprimer le message d'attente
      if (waitingMessage) {
        waitingMessage.remove();
      }
      
      if (!res.ok){
        const errMsg = json?.error ? `${json.error}` : `Erreur ${res.status}`;
        const details = json?.details ? ` — ${json.details}` : '';
        placeholder.remove();
        appendMessage(`${errMsg}${details}`, 'bot');
        return;
      }
      const reply = json.reply || json?.text || json?.details || '[pas de réponse]';
      const examples = json.examples || [];
      const actions = json.actions || [];
      const steps = json.steps || [];
      const oneLine = json.one_line || '';
      // replace placeholder
      placeholder.remove();
      appendBotWithFeedback(reply, msg, examples, actions, steps, oneLine);
    } catch (err) {
      const last = chatEl.querySelectorAll('.msg.bot');
      if (last.length) last[last.length-1].textContent = 'Erreur de communication: ' + String(err);
      else appendMessage('Erreur de communication: ' + String(err), 'bot');
    }
  });

  // Message d’accueil simple dès l’ouverture du chat (sans étapes ni actions)
  const welcomeText = "Bienvenue dans cet outil pensé pour t’aider dans ton quotidien si tu es concerné·e par le TSA, le TDAH ou un profil mixte. On va rester sur des messages courts, concrets et en plusieurs petites étapes si tu le souhaites.";
  appendBotWithFeedback(welcomeText, '', [], [], [], 'Bienvenue — aide au quotidien TSA/TDAH');

  if (editProfile) editProfile.addEventListener('click', ()=>{ window.location.href = '/onboarding.html'; });
  
  // Minuteur visuel 5 minutes (type time timer)
  function openFiveMinuteTimer(){
    const overlay = document.createElement('div');
    overlay.className = 'timer-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'timer-dialog';

    const title = document.createElement('div');
    title.className = 'timer-title';
    title.textContent = '5 minutes sur une seule petite étape';

    const sub = document.createElement('div');
    sub.className = 'timer-sub';
    sub.textContent = 'Tu peux juste laisser tourner. Quand le temps est fini, tu peux noter si ça t’a aidé.';

    const circle = document.createElement('div');
    circle.className = 'timer-circle';
    const inner = document.createElement('div');
    inner.className = 'timer-circle-inner';
    inner.textContent = '05:00';
    circle.appendChild(inner);

    const actions = document.createElement('div');
    actions.className = 'timer-actions';
    const cancel = document.createElement('button');
    cancel.className = 'timer-cancel';
    cancel.textContent = 'Arrêter';

    let remaining = 5 * 60; // secondes
    let startTs = Date.now();

    function update(){
      const now = Date.now();
      const elapsed = Math.floor((now - startTs)/1000);
      remaining = Math.max(0, 5*60 - elapsed);
      const m = String(Math.floor(remaining/60)).padStart(2,'0');
      const s = String(remaining%60).padStart(2,'0');
      inner.textContent = m+':'+s;

      const ratio = remaining / (5*60);
      const deg = 360 * ratio;
      circle.style.background = 'conic-gradient(#ff7043 0deg, #ff7043 '+deg+'deg, #e0e0e0 '+deg+'deg, #e0e0e0 360deg)';

      if (remaining <= 0){
        clearInterval(timerId);
      }
    }

    const timerId = setInterval(update, 500);
    update();

    cancel.addEventListener('click', ()=>{
      clearInterval(timerId);
      overlay.remove();
    });

    actions.appendChild(cancel);

    dialog.appendChild(title);
    dialog.appendChild(sub);
    dialog.appendChild(circle);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) {}

    // Rendre la fenêtre déplaçable à la souris (drag & drop simple)
    let drag = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;

    function onMouseDown(ev){
      drag = true;
      startX = ev.clientX;
      startY = ev.clientY;
      const rect = dialog.getBoundingClientRect();
      offsetX = rect.left;
      offsetY = rect.top;
      dialog.classList.add('dragging');
      ev.preventDefault();
    }

    function onMouseMove(ev){
      if (!drag) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      dialog.style.position = 'fixed';
      dialog.style.left = (offsetX + dx) + 'px';
      dialog.style.top = (offsetY + dy) + 'px';
    }

    function onMouseUp(){ 
      drag = false;
      dialog.classList.remove('dragging');
    }

    // Rendre toute la fenêtre draggable (pas seulement le titre)
    dialog.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Nettoyer les handlers quand on ferme
    function cleanup(){
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dialog.removeEventListener('mousedown', onMouseDown);
    }

    cancel.addEventListener('click', ()=>{
      clearInterval(timerId);
      overlay.remove();
      cleanup();
    });
  }
})();
