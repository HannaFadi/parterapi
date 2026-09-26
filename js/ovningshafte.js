/* ============================================================
   Övningshäftet "Blomstra upp som par"
   - sparar allt som skrivs i localStorage (aldrig till server)
   - temperamentstest, timrar, ordbrickor, export & utskrift
   ============================================================ */

(function () {
  const PREFIX = 'hafte:';
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(PREFIX + k); return v === null ? fallback : v; }
      catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(PREFIX + k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) {} },
    keys() {
      try { return Object.keys(localStorage).filter(k => k.indexOf(PREFIX) === 0); }
      catch (e) { return []; }
    }
  };

  /* ---------- Sparstatus ---------- */
  const note = document.getElementById('saveNote');
  let noteTimer = null;
  function flagSaved() {
    if (!note) return;
    note.textContent = 'Sparat i din webbläsare ✓';
    note.classList.add('saved');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note.textContent = ''; note.classList.remove('saved'); }, 2200);
  }

  /* ---------- Autosparade fält ---------- */
  function grow(el) {
    if (el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }

  const fields = Array.from(document.querySelectorAll('[data-save]'));
  fields.forEach(el => {
    const saved = store.get(el.dataset.save, null);
    if (saved !== null) el.value = saved;
    grow(el);
    let t = null;
    el.addEventListener('input', () => {
      grow(el);
      clearTimeout(t);
      t = setTimeout(() => { store.set(el.dataset.save, el.value); flagSaved(); }, 400);
    });
  });

  /* ---------- Innehållsmenyn följer läsningen ---------- */
  const tocLinks = Array.from(document.querySelectorAll('.hafte-toc a'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const targets = tocLinks
      .map(a => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        tocLinks.forEach(a => a.classList.toggle('here', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-120px 0px -70% 0px' });
    targets.forEach(t => spy.observe(t));
  }

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
    function select(i, autostart) {
      idx = i;
      remaining = steps[i].min * 60;
      host.classList.remove('done');
      stop();
      paint();
      if (autostart) start();
    }
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
    function stop() { running = false; clearInterval(tick); }

    host.querySelectorAll('.timer-step').forEach(b => {
      b.addEventListener('click', () => select(+b.dataset.i, true));
    });
    startBtn.addEventListener('click', () => { running ? stop() : start(); paint(); });
    host.querySelector('[data-act="reset"]').addEventListener('click', () => select(idx, false));

    select(0, false);
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

  function tradSave() { store.set('mittTrad', JSON.stringify(tradState)); flagSaved(); }

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
        <div class="temp-sum">Summa: <b data-sum="${t.key}">${tradState[who][t.key].filter(Boolean).length}</b></div>
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
        tradSave();
        tradRender();
      });
    });
  }

  if (tradHost) { tradLoad(); tradRender(); }

  /* ---------- Översättningen: Rosenbergs fyra steg ---------- */
  const SENTENCES = [
    'Du kollar ju alltid mobilen när jag pratar med dig.',
    'Du bryr dig mer om ditt jobb än om oss.',
    'Vi gör aldrig något roligt tillsammans längre.',
    'Du tar aldrig initiativ till att göra något åt det.',
    'Du håller alltid med din mamma och aldrig med mig.',
    'Du kommer alltid för sent, det är respektlöst.'
  ];
  const FEEL_NEG = ['irriterad', 'arg', 'besviken', 'ledsen', 'sårad', 'orolig', 'rädd', 'trött', 'ensam', 'frustrerad', 'maktlös', 'osäker', 'uppgiven', 'avundsjuk', 'skamsen', 'rastlös', 'överväldigad', 'missförstådd'];
  const FEEL_POS = ['glad', 'tacksam', 'lugn', 'trygg', 'lättad', 'rörd', 'varm', 'stolt', 'hoppfull', 'nyfiken', 'uppmuntrad', 'avspänd', 'nöjd', 'älskad', 'sedd', 'fri', 'förväntansfull'];
  const NEEDS = ['uppskattning', 'vila', 'trygghet', 'närhet', 'att bli sedd', 'att bli förstådd', 'gemenskap', 'frihet', 'ordning', 'mening', 'stöd', 'respekt', 'tillit', 'ömhet', 'lek', 'stillhet', 'att räknas med'];

  const oversattHost = document.getElementById('oversattWidget');

  function stepFields(prefix) {
    return `
      <label class="write">
        <span class="write-label">1 · Observation <span class="opt">— vad jag faktiskt såg eller hörde, utan tolkning</span></span>
        <textarea data-save="${prefix}-obs" rows="2" placeholder="”När jag …”"></textarea>
      </label>
      <label class="write">
        <span class="write-label">2 · Känsla <span class="opt">— vad det väcker i mig</span></span>
        <textarea data-save="${prefix}-kansla" rows="2" placeholder="”… blir jag …”"></textarea>
      </label>
      <div class="chips-wrap">
        <div class="chips-label">Ordbrickor — klicka för att lägga till i känslorutan:</div>
        <div class="chips" data-into="${prefix}-kansla">${FEEL_NEG.map(w => `<button type="button" class="chip">${w}</button>`).join('')}</div>
        <details class="lang-detail" style="margin-top:10px; box-shadow:none;">
          <summary style="padding:12px 16px; font-size:0.9rem;">Känslor när behovet <em>är</em> fyllt</summary>
          <div class="detail-body" style="padding:0 16px 16px;">
            <div class="chips" data-into="${prefix}-kansla">${FEEL_POS.map(w => `<button type="button" class="chip">${w}</button>`).join('')}</div>
          </div>
        </details>
      </div>
      <label class="write">
        <span class="write-label">3 · Behov <span class="opt">— vad som ligger bakom känslan</span></span>
        <textarea data-save="${prefix}-behov" rows="2" placeholder="”… för jag behöver …”"></textarea>
      </label>
      <div class="chips-wrap">
        <div class="chips-label">Behov att välja bland:</div>
        <div class="chips need" data-into="${prefix}-behov">${NEEDS.map(w => `<button type="button" class="chip">${w}</button>`).join('')}</div>
      </div>
      <label class="write">
        <span class="write-label">4 · Önskan <span class="opt">— en konkret, möjlig begäran</span></span>
        <textarea data-save="${prefix}-onskan" rows="2" placeholder="”Skulle du kunna …?”"></textarea>
      </label>`;
  }

  if (oversattHost) {
    oversattHost.innerHTML = `
      <p class="write-label">a) Välj en mening att översätta</p>
      <div class="chips" id="sentChips" style="margin-bottom:14px;">
        ${SENTENCES.map((s, i) => `<button type="button" class="chip" data-s="${i}">${s}</button>`).join('')}
      </div>
      <label class="write" style="margin-top:0">
        <span class="write-label">Meningen jag översätter</span>
        <input type="text" data-save="nvc-ex-mening" placeholder="Klicka på en mening ovan — eller skriv en egen.">
      </label>
      ${stepFields('nvc-ex')}
      <div style="border-top:1px dashed var(--line); margin:34px 0 26px;"></div>
      <p class="write-label">b) Nu en egen sak — något litet som skavt den senaste månaden</p>
      ${stepFields('nvc-min')}
      <p class="ex-note">c) Läs upp den för varandra. Den som lyssnar svarar med <strong>en</strong> mening: ”Det jag hör att du behöver är …”</p>`;

    // Fälten skapades efter första genomgången — koppla på sparning och brickor.
    oversattHost.querySelectorAll('[data-save]').forEach(el => {
      const saved = store.get(el.dataset.save, null);
      if (saved !== null) el.value = saved;
      grow(el);
      let t = null;
      el.addEventListener('input', () => {
        grow(el);
        clearTimeout(t);
        t = setTimeout(() => { store.set(el.dataset.save, el.value); flagSaved(); }, 400);
      });
    });

    oversattHost.querySelectorAll('#sentChips .chip').forEach(b => {
      b.addEventListener('click', () => {
        const input = oversattHost.querySelector('[data-save="nvc-ex-mening"]');
        input.value = SENTENCES[+b.dataset.s];
        store.set('nvc-ex-mening', input.value);
        flagSaved();
        oversattHost.querySelectorAll('#sentChips .chip').forEach(o => o.style.borderColor = '');
        b.style.borderColor = 'var(--accent)';
      });
    });

    oversattHost.querySelectorAll('.chips[data-into] .chip').forEach(b => {
      b.addEventListener('click', () => {
        const target = oversattHost.querySelector('[data-save="' + b.parentElement.dataset.into + '"]');
        if (!target) return;
        const word = b.textContent;
        const cur = target.value.trim();
        target.value = cur ? (/[.,;:!?]$/.test(cur) ? cur + ' ' + word : cur + ', ' + word) : word;
        store.set(target.dataset.save, target.value);
        grow(target);
        flagSaved();
        target.focus();
      });
    });
  }

  /* ---------- Sittplikten: ämnen ---------- */
  const TOPICS = [
    { t: 'Oss själva och oss två', d: 'Relationens kvalitet · mina ansträngningar och framsteg · mina svagheter · det som är svårt just nu' },
    { t: 'Våra barn', d: 'Uppfostran · hälsa · karaktär · framsteg · svårigheter' },
    { t: 'Familj och vänner', d: 'Våra föräldrar · barnbarn · åldrande eller sjuka anhöriga · våra vänner' },
    { t: 'Yrkeslivet', d: 'Oro · glädjeämnen · besvikelser · kollegor · beslut som väntar' },
    { t: 'Våra åtaganden', d: 'Vad vi gör · med vilka medel · mot vilka mål · vad det ger och vad det kostar' }
  ];
  const topicHost = document.getElementById('sittTopics');
  if (topicHost) {
    const chosen = store.get('sitt-amne', '');
    topicHost.innerHTML = TOPICS.map((o, i) =>
      `<div class="topic ${chosen === String(i) ? 'on' : ''}" data-i="${i}" role="button" tabindex="0"><strong>${o.t}</strong><span>${o.d}</span></div>`
    ).join('');
    function pick(el) {
      topicHost.querySelectorAll('.topic').forEach(t => t.classList.remove('on'));
      el.classList.add('on');
      store.set('sitt-amne', el.dataset.i);
      flagSaved();
    }
    topicHost.querySelectorAll('.topic').forEach(el => {
      el.addEventListener('click', () => pick(el));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(el); } });
    });
  }

  /* ---------- Skriv ut, exportera, rensa ---------- */
  const printBtn = document.getElementById('printBtn');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  const txtBtn = document.getElementById('txtBtn');
  if (txtBtn) txtBtn.addEventListener('click', () => {
    const lines = ['BLOMSTRA UPP SOM PAR — våra svar', new Date().toLocaleDateString('sv-SE'), ''];

    if (tradHost) {
      ['me', 'partner'].forEach(p => {
        const rows = totals(p);
        if (!rows.some(r => r.n > 0)) return;
        lines.push((p === 'me' ? 'MITT TRÄD — jag' : 'MITT TRÄD — min partner'));
        rows.forEach(r => lines.push('  ' + r.t.name + ': ' + r.n + '/' + r.t.items.length));
        lines.push('');
      });
    }

    document.querySelectorAll('[data-save]').forEach(el => {
      const val = (el.value || '').trim();
      if (!val) return;
      const wrap = el.closest('.write') || el.closest('.write-num');
      let label = '';
      if (wrap) {
        const l = wrap.querySelector('.write-label') || wrap.querySelector('span');
        if (l) label = l.textContent.replace(/\s+/g, ' ').trim();
      }
      lines.push((label ? label + ':' : '') + '\n  ' + val.replace(/\n/g, '\n  '), '');
    });

    const amne = store.get('sitt-amne', '');
    if (amne !== '' && TOPICS[+amne]) lines.push('Valt ämne för sittplikten: ' + TOPICS[+amne].t, '');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'blomstra-som-par-vara-svar.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });

  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (!confirm('Rensa allt ni skrivit i häftet? Det går inte att ångra.')) return;
    store.keys().forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    document.querySelectorAll('[data-save]').forEach(el => { el.value = ''; grow(el); });
    if (tradHost) {
      tradState = { me: {}, partner: {} };
      tradLoad();
      tradRender();
    }
    document.querySelectorAll('#sittTopics .topic').forEach(t => t.classList.remove('on'));
    if (note) { note.textContent = 'Rensat.'; note.classList.remove('saved'); }
  });
})();

/* Fäll ut alla dragspel när sidan skrivs ut — inget innehåll ska falla bort. */
(function () {
  const all = () => document.querySelectorAll('details');
  const opened = new Set();
  window.addEventListener('beforeprint', () => {
    all().forEach(d => { if (!d.open) { opened.add(d); d.open = true; } });
  });
  window.addEventListener('afterprint', () => {
    opened.forEach(d => { d.open = false; });
    opened.clear();
  });
})();
