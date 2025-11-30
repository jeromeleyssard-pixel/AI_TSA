async function loadQuestionnaire() {
  const res = await fetch('/onboarding/schema');
  const schema = await res.json();
  document.getElementById('intro').textContent = schema.title || 'Questionnaire';
  const form = document.getElementById('onboardForm');
  // load current profile to prefill
  let currentProfile = {};
  try {
    const p = await fetch('/profile');
    currentProfile = await p.json();
  } catch (e) {
    currentProfile = {};
  }
  schema.questions.forEach(q => {
    const wrapper = document.createElement('div');
    wrapper.className = 'q';
    const label = document.createElement('label');
    label.textContent = q.text;
    wrapper.appendChild(label);

    if (q.type === 'single_choice') {
      q.options.forEach(opt => {
        const optValue = (typeof opt === 'string') ? opt : opt.value;
        const optLabel = (typeof opt === 'string') ? opt : opt.label;
        const id = `q_${q.id}_${optValue}`.replace(/\s+/g, '_');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = q.id;
        input.value = optValue;
        input.id = id;
        // prefill if matches current profile
        if (currentProfile[q.id] && currentProfile[q.id] === optValue) input.checked = true;
        const span = document.createElement('span');
        span.textContent = optLabel;
        const div = document.createElement('div');
        div.appendChild(input);
        div.appendChild(span);
        wrapper.appendChild(div);
      });
    } else if (q.type === 'multi_choice') {
      q.options.forEach(opt => {
        const optValue = (typeof opt === 'string') ? opt : opt.value;
        const optLabel = (typeof opt === 'string') ? opt : opt.label;
        const id = `q_${q.id}_${optValue}`.replace(/\s+/g, '_');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = q.id;
        input.value = optValue;
        input.id = id;
        if (Array.isArray(currentProfile[q.id]) && currentProfile[q.id].includes(optValue)) input.checked = true;
        const span = document.createElement('span');
        span.textContent = optLabel;
        const div = document.createElement('div');
        div.appendChild(input);
        div.appendChild(span);
        wrapper.appendChild(div);
      });
    } else {
      const input = document.createElement('input');
      input.name = q.id;
      if (currentProfile[q.id]) input.value = currentProfile[q.id];
      wrapper.appendChild(input);
    }

    form.appendChild(wrapper);
  });

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Enregistrer le profil';
  form.appendChild(submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    schema.questions.forEach(q => {
      if (q.type === 'single_choice') {
        const val = form.querySelector(`input[name="${q.id}"]:checked`);
        if (val) data[q.id] = val.value;
      } else if (q.type === 'multi_choice') {
        const vals = Array.from(form.querySelectorAll(`input[name="${q.id}"]:checked`)).map(i => i.value);
        data[q.id] = vals;
      } else {
        const val = form.querySelector(`[name="${q.id}"]`).value;
        data[q.id] = val;
      }
    });

    const resp = await fetch('/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await resp.json();
    const result = document.getElementById('result');
    if (resp.ok && json && json.status === 'ok') {
      result.innerHTML = '<strong>Profil sauvegardé.</strong><pre>' + JSON.stringify(json.profile, null, 2) + '</pre>';
      submit.textContent = 'Modifier le profil';
    } else {
      // show errors if provided
      if (json && json.errors) {
        result.innerHTML = '<strong>Erreur de validation :</strong><pre>' + JSON.stringify(json.errors, null, 2) + '</pre>';
      } else if (json && json.error) {
        result.textContent = 'Erreur : ' + json.error;
      } else {
        result.textContent = 'Erreur lors de la sauvegarde.';
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  loadQuestionnaire().catch(e => {
    document.getElementById('intro').textContent = 'Impossible de charger le questionnaire.';
  });
});