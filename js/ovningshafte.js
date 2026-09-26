/* ============================================================
   Gemensam logik för de korta parövningarna.
   Varje del aktiveras bara om sidan innehåller den.
   Allt som skrivs sparas i localStorage — inget lämnar webbläsaren.
   ============================================================ */

(function () {
  const PREFIX = 'hafte:';
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(PREFIX + k); return v === null ? fallback : v; }
      catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(PREFIX + k, v); } catch (e) {} },
    keys() {
      try { return Object.keys(localStorage).filter(k => k.indexOf(PREFIX) === 0); }
      catch (e) { return []; }
    }
  };

  /* ---------- Sparstatus ---------- */
  const notes = Array.from(document.querySelectorAll('.save-note'));
  let noteTimer = null;
  function flagSaved() {
    if (!notes.length) return;
    notes.forEach(n => { n.textContent = 'Sparat i din webbläsare ✓'; n.classList.add('saved'); });
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      notes.forEach(n => { n.textContent = ''; n.classList.remove('saved'); });
    }, 2200);
  }

  /* ---------- Autosparade fält ---------- */
  function grow(el) {
    if (el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }

  document.querySelectorAll('[data-save]').forEach(el => {
    const saved = store.get(el.dataset.save, null);
    if (saved !== null) el.value = saved;
    grow(el);
    let t = null;
    el.addEventListener('input', () => {
      grow(el);
      updateCounts();
      clearTimeout(t);
      t = setTimeout(() => { store.set(el.dataset.save, el.value); flagSaved(); }, 400);
    });
  });

  /* ---------- Räknare: "3 av 5 ifyllda" ---------- */
  function updateCounts() {
    document.querySelectorAll('[data-count-of]').forEach(el => {
      const pre = el.dataset.countOf;
      const all = Array.from(document.querySelectorAll('[data-save^="' + pre + '"]'));
      const done = all.filter(f => f.value.trim()).length;
      el.textContent = done + ' av ' + all.length + ' ifyllda';
      el.classList.toggle('full', done === all.length && all.length > 0);
    });
  }
  updateCounts();

  /* ---------- Timrar ---------- */
  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [0, 0.28, 0.56].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 660;
        osc.connect(gain); gain.connect(ctx.destination);
        const t0 = ctx.currentTime + offset;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        osc.start(t0); osc.stop(t0 + 0.22);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch (e) {}
  }

  function mmss(sec) {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.max(0, sec) % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  document.querySelectorAll('[data-timer]').forEach(host => {
    const steps = host.dataset.timer.split('|').map(part => {
      const bits = part.split(':');
      return { label: bits[0], min: parseFloat(bits[1]) };
    });

    host.innerHTML =
      '<span class="timer-clock">00:00</span>' +
      '<div class="timer-steps">' +
        steps.map((s, i) => `<button type="button" class="timer-step" data-i="${i}">${s.label} · ${s.min} min</button>`).join('') +
      '</div>' +
      '<div class="timer-btns">' +
        '<button type="button" class="timer-btn" data-act="start">Starta</button>' +
        '<button type="button" class="timer-btn" data-act="reset">Nollställ</button>' +
      '</div>';

    const clock = host.querySelector('.timer-clock');
    const startBtn = host.querySelector('[data-act="start"]');
    let idx = 0, remaining = 0, running = false, tick = null, endAt = 0;

    function paint() {
      clock.textContent = mmss(Math.round(remaining));
      host.querySelectorAll('.timer-step').forEach(b => b.classList.toggle('on', +b.dataset.i === idx));
      host.classList.toggle('running', running);
      startBtn.textContent = running ? 'Pausa' : 'Starta';
    }
    function stop() { running = false; clearInterval(tick); }
    function start() {
      if (remaining <= 0) return;
      running = true;
      endAt = Date.now() + remaining * 1000;
      host.classList.remove('done');
      clearInterval(tick);
      tick = setInterval(() => {
        remaining = (endAt - Date.now()) / 1000;
        if (remaining <= 0) {
          remaining = 0;
          stop();
          host.classList.add('done');
          beep();
          if (idx < steps.length - 1) { idx++; remaining = steps[idx].min * 60; }
        }
        paint();
      }, 200);
      paint();
    }
    function select(i, autostart) {
      idx = i;
      remaining = steps[i].min * 60;
      host.classList.remove('done');
      stop();
      paint();
      if (autostart) start();
    }

    host.querySelectorAll('.timer-step').forEach(b => {
      b.addEventListener('click', () => select(+b.dataset.i, true));
    });
    startBtn.addEventListener('click', () => { running ? stop() : start(); paint(); });
    host.querySelector('[data-act="reset"]').addEventListener('click', () => select(idx, false));

    select(0, false);
  });

  /* ---------- Valbara kort (ämnen, öppna frågor) ---------- */
  document.querySelectorAll('[data-pick]').forEach(group => {
    const key = group.dataset.pick;
    const chosen = store.get(key, '');
    const cards = Array.from(group.querySelectorAll('.pick'));
    cards.forEach(c => c.classList.toggle('on', c.dataset.v === chosen));
    function pick(el) {
      cards.forEach(c => c.classList.remove('on'));
      el.classList.add('on');
      store.set(key, el.dataset.v);
      flagSaved();
    }
    cards.forEach(el => {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.addEventListener('click', () => pick(el));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(el); }
      });
    });
  });

  /* ---------- Mitt träd: de fyra temperamenten ---------- */
  const TEMPS = [
    { key: 'sang', emoji: '🎆', name: 'Sangviniker', items: [
      'Får energi av människor', 'Skrattar högt och ofta', 'Reagerar direkt', 'Bär inget agg',
      'Börjar mer än jag avslutar', 'Blir lätt entusiastisk — och lika lätt uttråkad',
      'Pratar gärna, ibland för mycket', 'Tycker om att bli sedd' ] },
    { key: 'kol', emoji: '🚜', name: 'Koleriker', items: [
      'Vill få saker gjorda', 'Tar naturligt ledningen', 'Ger inte upp vid motstånd',
      'Ser lösningen snabbt', 'Har svårt att erkänna fel', 'Blir otålig med långsamhet',
      'Har svårt att be om förlåtelse', 'Litar mycket på mitt eget omdöme' ] },
    { key: 'fleg', emoji: '🛋️', name: 'Flegmatiker', items: [
      'Blir sällan upprörd', 'Undviker konflikt', 'Trivs med rutiner',
      'Irriteras av det oplanerade', 'Skjuter upp saker', 'Har svårt att bestämma mig',
      'Säger sällan ifrån', 'Nöjer mig lätt med hur det är' ] },
    { key: 'mel', emoji: '🌊', name: 'Melankoliker', items: [
      'Tänker efter länge', 'Känslor sitter i länge', 'Vill förstå på djupet',
      'Ser detaljer andra missar', 'Sätter ribban högt', 'Grubblar och oroar mig',
      'Rädd för vad andra tänker', 'Dras till stillhet och eftertanke' ] }
  ];

  const tradHost = document.getElementById('mittTrad');
  let tradState = { me: {}, partner: {} };
  let who = 'me';

  function tradLoad() {
    try {
      const raw = store.get('mittTrad', null);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.me && parsed.partner) tradState = parsed;
      }
    } catch (e) {}
    TEMPS.forEach(t => {
      ['me', 'partner'].forEach(p => {
        if (!Array.isArray(tradState[p][t.key])) tradState[p][t.key] = new Array(t.items.length).fill(false);
      });
    });
  }

  function totals(p) {
    return TEMPS.map(t => ({ t: t, n: tradState[p][t.key].filter(Boolean).length }));
  }

  function verdict(p, label) {
    const rows = totals(p);
    const max = Math.max.apply(null, rows.map(r => r.n));
    if (max === 0) return '';
    const top = rows.filter(r => r.n === max);
    const bars = rows.map(r => `
      <div class="result-bar-row ${r.n === max ? 'top' : ''}">
        <span>${r.t.emoji} ${r.t.name}</span>
        <div class="result-bar-track"><div class="result-bar-fill" style="width:${Math.round(r.n / r.t.items.length * 100)}%"></div></div>
        <span class="pct">${r.n}/${r.t.items.length}</span>
      </div>`).join('');
    const line = top.length === 1
      ? `${label} känner mest igen sig i <strong>${top[0].t.emoji} ${top[0].t.name}</strong> — ${max} av ${top[0].t.items.length} drag.`
      : `${label} ligger jämnt mellan <strong>${top.map(r => r.t.emoji + ' ' + r.t.name).join(' och ')}</strong>. Det är vanligare än man tror.`;
    return `<div class="temp-out-who">${label}</div><p class="temp-verdict">${line}</p><div class="result-bars">${bars}</div>`;
  }

  function tradRender() {
    const grid = TEMPS.map(t => `
      <div class="temp-col">
        <h4><span>${t.emoji}</span>${t.name}</h4>
        ${t.items.map((item, i) => `
          <label class="temp-item">
            <input type="checkbox" data-t="${t.key}" data-i="${i}" ${tradState[who][t.key][i] ? 'checked' : ''}>
            <span>${item}</span>
          </label>`).join('')}
        <div class="temp-sum">Summa: <b>${tradState[who][t.key].filter(Boolean).length}</b></div>
      </div>`).join('');

    const outMe = verdict('me', 'Du');
    const outPartner = verdict('partner', 'Din partner');

    tradHost.innerHTML = `
      <div class="temp-switch noprint" role="group" aria-label="Vem fyller vi i för?">
        <button type="button" data-who="me" class="${who === 'me' ? 'on' : ''}">Jag</button>
        <button type="button" data-who="partner" class="${who === 'partner' ? 'on' : ''}">Min partner</button>
      </div>
      <p class="ex-note print-only" style="margin:0 0 10px;">Kryssa för dig själv — och ringa in, eller använd en annan färg, för din partner.</p>
      <div class="temp-grid">${grid}</div>
      ${(outMe || outPartner) ? `<div class="temp-out">${outMe}${outPartner ? '<div style="margin-top:22px">' + outPartner + '</div>' : ''}</div>` : ''}`;

    tradHost.querySelectorAll('.temp-switch button').forEach(b => {
      b.addEventListener('click', () => { who = b.dataset.who; tradRender(); });
    });
    tradHost.querySelectorAll('.temp-item input').forEach(cb => {
      cb.addEventListener('change', () => {
        tradState[who][cb.dataset.t][+cb.dataset.i] = cb.checked;
        store.set('mittTrad', JSON.stringify(tradState));
        flagSaved();
        tradRender();
      });
    });
  }

  if (tradHost) { tradLoad(); tradRender(); }

  /* ---------- Skriv ut och rensa ---------- */
  document.querySelectorAll('[data-print]').forEach(b => {
    b.addEventListener('click', () => window.print());
  });

  document.querySelectorAll('[data-clear]').forEach(b => {
    b.addEventListener('click', () => {
      if (!confirm('Rensa det ni skrivit i övningarna? Det går inte att ångra.')) return;
      store.keys().forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
      document.querySelectorAll('[data-save]').forEach(el => { el.value = ''; grow(el); });
      document.querySelectorAll('.pick').forEach(p => p.classList.remove('on'));
      if (tradHost) { tradState = { me: {}, partner: {} }; tradLoad(); tradRender(); }
      updateCounts();
      notes.forEach(n => { n.textContent = 'Rensat.'; n.classList.remove('saved'); });
    });
  });

  /* ---------- Fäll ut alla dragspel vid utskrift ---------- */
  const opened = new Set();
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('details').forEach(d => { if (!d.open) { opened.add(d); d.open = true; } });
  });
  window.addEventListener('afterprint', () => {
    opened.forEach(d => { d.open = false; });
    opened.clear();
  });
})();
