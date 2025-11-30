(function(){
  const examplesList = document.getElementById('examplesList');
  const feedbackList = document.getElementById('feedbackList');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnRebuild = document.getElementById('btnRebuild');
  const btnReindex = document.getElementById('btnReindex');
  const btnAdd = document.getElementById('btnAddExample');
  const newMsg = document.getElementById('newMsg');
  const newReply = document.getElementById('newReply');

  async function fetchExamples(){
    try{
      const r = await fetch('/examples');
      const j = await r.json();
      return j.items || [];
    }catch(e){return []}
  }

  async function fetchFeedback(){
    try{
      const r = await fetch('/feedback');
      const j = await r.json();
      return j.items || [];
    }catch(e){return []}
  }

  function renderExamples(items){
    examplesList.innerHTML = '';
    if (!items.length) { examplesList.textContent = 'Aucun exemple pour le moment.'; return; }
    items.forEach(it => {
      const d = document.createElement('div'); d.className='item';
      const meta = document.createElement('div'); meta.className='meta'; meta.textContent = `${it.ts} • id:${it.id}`;
      const msg = document.createElement('div'); msg.textContent = it.message || '(vide)';
      const rep = document.createElement('div'); rep.textContent = it.reply || '';
      const actions = document.createElement('div'); actions.className='action-group';
      const del = document.createElement('button'); del.textContent='Supprimer'; del.className='btn-small secondary';
      del.addEventListener('click', async ()=>{
        if (!confirm('Supprimer cet exemple ?')) return;
        try{ await fetch('/examples/'+encodeURIComponent(it.id), { method:'DELETE' }); refresh(); }catch(e){alert('Erreur');}
      });
      actions.appendChild(del);
      d.appendChild(meta); d.appendChild(msg); d.appendChild(rep); d.appendChild(actions);
      examplesList.appendChild(d);
    });
  }

  function renderFeedback(items){
    feedbackList.innerHTML = '';
    if (!items.length) { feedbackList.textContent = 'Aucun feedback pour le moment.'; return; }
    items.slice().reverse().forEach(it => {
      const d = document.createElement('div'); d.className='item';
      const meta = document.createElement('div'); meta.className='meta'; meta.textContent = `${it.ts} • id:${it.id} • helpful:${it.helpful}`;
      const msg = document.createElement('div'); msg.textContent = it.message || '(vide)';
      const rep = document.createElement('div'); rep.textContent = it.reply || '';
      const actions = document.createElement('div'); actions.className='action-group';
      const promote = document.createElement('button'); promote.textContent='Promouvoir'; promote.className='btn-small';
      promote.addEventListener('click', async ()=>{
        try{
          await fetch('/examples', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message: it.message, reply: it.reply }) });
          refresh();
        }catch(e){ alert('Erreur lors de la promotion'); }
      });
      actions.appendChild(promote);
      d.appendChild(meta); d.appendChild(msg); d.appendChild(rep); d.appendChild(actions);
      feedbackList.appendChild(d);
    });
  }

  async function refresh(){
    btnRefresh.disabled = true;
    const [ex, fb] = await Promise.all([fetchExamples(), fetchFeedback()]);
    renderExamples(ex);
    renderFeedback(fb);
    btnRefresh.disabled = false;
  }

  btnRefresh.addEventListener('click', refresh);

  btnRebuild.addEventListener('click', async ()=>{
    if (!confirm('Reconstruire examples.json à partir du feedback (déduplication) ?')) return;
    try{
      const r = await fetch('/rebuild-index', { method:'POST' });
      const j = await r.json();
      alert('Rebuild: ' + (j.count || JSON.stringify(j)));
      refresh();
    }catch(e){ alert('Erreur de rebuild'); }
  });

  btnReindex.addEventListener('click', async ()=>{
    try{
      btnReindex.disabled = true;
      const r = await fetch('/embeddings/reindex', { method:'POST' });
      const j = await r.json();
      alert('Reindex: ' + JSON.stringify(j));
      btnReindex.disabled = false;
    }catch(e){ alert('Erreur de reindex'); btnReindex.disabled = false; }
  });

  btnAdd.addEventListener('click', async ()=>{
    const m = newMsg.value.trim();
    const r = newReply.value.trim();
    if (!r) { alert('La réponse est requise'); return; }
    try{
      await fetch('/examples', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message: m, reply: r }) });
      newMsg.value=''; newReply.value=''; refresh();
    }catch(e){ alert('Erreur'); }
  });

  // initial
  refresh();
})();
