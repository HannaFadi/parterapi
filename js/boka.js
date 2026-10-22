// Bokningsflöde: kalender → tid → formulär → betalning.
// Maries schema och redan tagna tider hämtas från /api/tider (källan är
// src/tillganglighet.json). Vid betalning reserverar servern tiden och
// skickar paret till Stripe Checkout (Swish eller kort); tiden är bokad
// när betalningen gått igenom.

(function () {
  const body = document.getElementById('bookingBody');
  if (!body) return;

  const SAMTAL_MINUTER = 90;
  const BOOKING_EMAIL = 'kontakt@mariehanna.se';

  // Fylls av hamtaTider()
  let TILLGANGLIGHET = {};
  let STANGT = [];
  let VECKOR_FRAMAT = 8;

  const MONTHS = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
  const DOW = ['Mån','Tis','Ons','Tor','Fre','Lör','Sön'];
  const DOW_FULL = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'];

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function slutTid(start) {
    const [h, m] = start.split('.').map(Number);
    const t = h * 60 + m + SAMTAL_MINUTER;
    return String(Math.floor(t / 60) % 24) + '.' + String(t % 60).padStart(2, '0');
  }
  function tidSpann(start) { return start + '–' + slutTid(start); }

  const state = {
    step: 1,
    viewYear: 0,
    viewMonth: 0,
    date: null,   // Date object
    time: null,   // 'HH:MM'
    form: {}
  };

  let today, maxDate;
  function satDatumgranser(idagIso) {
    // Serverns "i dag" i Stockholm, så att kalendern och servern är överens
    today = idagIso ? new Date(idagIso + 'T00:00:00') : new Date();
    today.setHours(0, 0, 0, 0);
    maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + VECKOR_FRAMAT * 7);
  }

  // Öppna på första månaden som faktiskt har en ledig dag, annars innevarande
  function valjStartmanad() {
    const d = new Date(today);
    for (let i = 0; i < VECKOR_FRAMAT * 7 + 1; i++) {
      d.setDate(d.getDate() + 1);
      if (d > maxDate) break;
      if (isAvailable(d)) {
        state.viewYear = d.getFullYear();
        state.viewMonth = d.getMonth();
        return;
      }
    }
    state.viewYear = today.getFullYear();
    state.viewMonth = today.getMonth();
  }

  function isAvailable(d) {
    if (d <= today || d > maxDate) return false;
    if (STANGT.indexOf(iso(d)) !== -1) return false;
    const tider = TILLGANGLIGHET[d.getDay()];
    return !!(tider && tider.length);
  }

  /* Tider som redan är bokade eller reserverade, nyckel 'ÅÅÅÅ-MM-DD' → ['14.00', …]. */
  let upptagna = {};

  async function hamtaTider() {
    const svar = await fetch('/api/tider', { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
    if (!svar.ok) throw new Error('HTTP ' + svar.status);
    const data = await svar.json();
    TILLGANGLIGHET = data.veckodagar || {};
    STANGT = data.stangt || [];
    VECKOR_FRAMAT = data.veckorFramat || VECKOR_FRAMAT;
    upptagna = data.upptagna || {};
    return data;
  }

  function slotsFor(d) {
    const alla = TILLGANGLIGHET[d.getDay()] || [];
    const tagna = upptagna[iso(d)] || [];
    return alla.filter(t => tagna.indexOf(t) === -1);
  }

  function fmtDate(d) {
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function setProgress() {
    document.querySelectorAll('.booking-progress span').forEach(el => {
      const n = Number(el.dataset.step);
      el.classList.toggle('active', n === state.step);
      el.classList.toggle('done', n < state.step);
    });
  }

  let firstRender = true;
  function render() {
    setProgress();
    if (state.step === 1) renderCalendar();
    else if (state.step === 2) renderTimes();
    else if (state.step === 3) renderForm();
    else renderConfirm();
    if (!firstRender) {
      body.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      body.setAttribute('tabindex', '-1');
      body.focus({ preventScroll: true });
    }
    firstRender = false;
  }

  /* ---------- Steg 1: Kalender ---------- */
  function renderCalendar() {
    const y = state.viewYear, m = state.viewMonth;
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7; // måndag först
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const prevDisabled = (y * 12 + m) <= (today.getFullYear() * 12 + today.getMonth());
    const nextDisabled = y === maxDate.getFullYear() && m === maxDate.getMonth();

    let html = `
      <div class="cal-head">
        <h3>${MONTHS[m]} ${y}</h3>
        <div>
          <button class="cal-nav-btn" id="calPrev" ${prevDisabled ? 'disabled' : ''} aria-label="Föregående månad">‹</button>
          <button class="cal-nav-btn" id="calNext" ${nextDisabled ? 'disabled' : ''} aria-label="Nästa månad">›</button>
        </div>
      </div>
      <div class="cal-grid">`;
    DOW.forEach(d => html += `<div class="cal-dow">${d}</div>`);
    for (let i = 0; i < startOffset; i++) html += '<div></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m, day);
      const avail = isAvailable(d);
      const sel = state.date && d.getTime() === state.date.getTime();
      const antal = avail ? slotsFor(d).length : 0;
      const ledig = avail && antal > 0;
      const etikett = `${DOW_FULL[d.getDay()]} ${day} ${MONTHS[m]}` +
        (ledig ? `, ${antal} ledig${antal === 1 ? ' tid' : 'a tider'}` : ', inga lediga tider');
      html += `<button class="cal-day${ledig ? ' available' : ''}${sel ? ' selected' : ''}"
                aria-label="${etikett}"${sel ? ' aria-current="date"' : ''}
                ${ledig ? `data-date="${d.toISOString()}"` : 'disabled tabindex="-1"'}>${day}</button>`;
    }
    html += `</div>
      <div class="cal-legend">
        <span><i class="lg-av"></i>Ledig dag</span>
        <span><i class="lg-sel"></i>Vald dag</span>
      </div>`;
    body.innerHTML = html;

    document.getElementById('calPrev').addEventListener('click', () => shiftMonth(-1));
    document.getElementById('calNext').addEventListener('click', () => shiftMonth(1));
    body.querySelectorAll('.cal-day.available').forEach(btn => {
      btn.addEventListener('click', () => {
        state.date = new Date(btn.dataset.date);
        state.time = null;
        state.step = 2;
        render();
      });
    });
  }

  function shiftMonth(delta) {
    let m = state.viewMonth + delta, y = state.viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    state.viewMonth = m;
    state.viewYear = y;
    renderCalendar();
    setProgress();
  }

  /* ---------- Steg 2: Tid ---------- */
  function renderTimes() {
    let html = `
      <p role="status" class="booking-status">Steg 2 av 4 — välj en tid</p>
      <div class="booking-summary">📅 <strong>${fmtDate(state.date)}</strong> — välj en tid nedan</div>
      <h3>Lediga tider</h3>
      <div class="time-grid">`;
    const lediga = slotsFor(state.date);
    if (!lediga.length) {
      html += `</div><p>Alla tider den dagen är tyvärr bokade. Välj ett annat datum.</p><div class="time-grid">`;
    }
    lediga.forEach(t => {
      html += `<button class="time-slot${state.time === t ? ' selected' : ''}" data-time="${t}"
                aria-label="Klockan ${tidSpann(t)}, 90 minuter">${tidSpann(t)}</button>`;
    });
    html += `</div>
      <div class="booking-actions">
        <button class="btn btn-secondary" id="backBtn">‹ Ändra datum</button>
      </div>`;
    body.innerHTML = html;

    body.querySelectorAll('.time-slot').forEach(btn => {
      btn.addEventListener('click', () => {
        state.time = btn.dataset.time;
        state.step = 3;
        render();
      });
    });
    document.getElementById('backBtn').addEventListener('click', () => { state.step = 1; render(); });
  }

  /* ---------- Steg 3: Formulär ---------- */
  function renderForm() {
    const f = state.form;
    body.innerHTML = `
      <p role="status" class="booking-status">Steg 3 av 4 — berätta kort om er</p>
      <div class="booking-summary">📅 <strong>${fmtDate(state.date)}</strong> kl. <strong>${tidSpann(state.time)}</strong> · 90 min · 450 kr</div>
      <form id="bookingForm" novalidate>
        <div class="form-row">
          <div class="field">
            <label for="fName">Namn (båda parter) *</label>
            <input type="text" id="fName" required value="${esc(f.name)}" placeholder="Anna & Erik Svensson" autocomplete="name">
          </div>
          <div class="field">
            <label for="fPhone">Telefon *</label>
            <input type="tel" id="fPhone" required value="${esc(f.phone)}" placeholder="07X-XXX XX XX" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label for="fEmail">E-post *</label>
          <input type="email" id="fEmail" required value="${esc(f.email)}" placeholder="er@epost.se" autocomplete="email">
        </div>
        <div class="field">
          <label for="fLang">Språk</label>
          <select id="fLang">
            <option value="svenska">Svenska</option>
            <option value="franska">Franska / français</option>
          </select>
          <p class="hint">Jag håller samtal på svenska eller franska — välj det språk ni helst talar med varandra.</p>
        </div>
        <div class="field">
          <label for="fAbout">Berätta kort om er <span class="opt">(några rader räcker, och ni kan lämna rutan tom)</span></label>
          <textarea id="fAbout" placeholder="T.ex. hur länge ni varit tillsammans och vad som gör att ni söker parterapi just nu. Det räcker med en mening — resten tar vi i rummet.">${esc(f.about)}</textarea>
          <p class="hint">Det ni skriver behandlas konfidentiellt och läses bara av mig.</p>
        </div>


        <label class="check-row" style="margin-bottom: 26px;">
          <input type="checkbox" id="fGdpr" required>
          <span>Jag godkänner att mina uppgifter behandlas enligt <a href="/integritet" target="_blank">integritetspolicyn</a> för att hantera bokningen. *</span>
        </label>

        <div class="booking-actions">
          <button type="button" class="btn btn-secondary" id="backBtn">‹ Ändra tid</button>
          <button type="submit" class="btn btn-primary">Granska och gå till betalning ›</button>
        </div>
      </form>`;

    document.getElementById('backBtn').addEventListener('click', () => { saveForm(); state.step = 2; render(); });
    document.getElementById('bookingForm').addEventListener('submit', e => {
      e.preventDefault();
      const form = e.target;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      saveForm();
      state.step = 4;
      render();
    });
  }

  function saveForm() {
    const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : (state.form[id] || ''); };
    state.form = {
      name: get('fName'),
      phone: get('fPhone'),
      email: get('fEmail'),
      about: get('fAbout'),
      lang: get('fLang') || 'svenska'
    };
  }

  /* ---------- Steg 4: Granska och betala ---------- */
  function renderConfirm(felmeddelande) {
    const f = state.form;
    body.innerHTML = `
      <div class="confirm-box">
        <p role="status" class="booking-status">Steg 4 av 4 — granska och betala</p>
        <h2 style="font-size:1.7rem">Stämmer allt?</h2>
        <p style="max-width:34em; margin: 12px auto 0;">Ni betalar 450&nbsp;kr med <strong>Swish</strong> eller <strong>kort</strong> hos vår betalpartner Stripe. <strong>Tiden är er så fort betalningen har gått igenom</strong>, och ni får en bekräftelse och ett kvitto via mejl.</p>

        <dl class="confirm-details">
          <div><dt>Datum</dt><dd>${fmtDate(state.date)}</dd></div>
          <div><dt>Tid</dt><dd>kl. ${tidSpann(state.time)} (90 min)</dd></div>
          <div><dt>Namn</dt><dd style="text-transform:none">${esc(f.name)}</dd></div>
          <div><dt>E-post</dt><dd style="text-transform:none">${esc(f.email)}</dd></div>
          <div><dt>Språk</dt><dd>${f.lang === 'franska' ? 'Franska' : 'Svenska'}</dd></div>
          <div><dt>Att betala</dt><dd>450 kr</dd></div>
        </dl>

        ${felmeddelande ? `<div class="callout warm" role="alert" style="text-align:left; margin-bottom:20px;"><p>${esc(felmeddelande)}</p></div>` : ''}

        <button type="button" class="btn btn-primary" id="payBtn">Gå till betalning – 450 kr</button>
        <p style="font-size:0.88rem; margin-top:14px;"><span class="swish-logo" style="font-size:1rem">Swish</span> eller kort · säker betalning via Stripe</p>
        <p style="font-size:0.85rem; max-width:34em; margin: 10px auto 0;">Kostnadsfri avbokning fram till 24 timmar före samtalet, då får ni tillbaka hela beloppet. Vid senare avbokning återbetalas halva avgiften.</p>

        <div class="booking-actions" style="justify-content:center; margin-top: 24px;">
          <button type="button" class="btn btn-secondary btn-small" id="editBtn">‹ Ändra uppgifter</button>
          <button type="button" class="btn btn-secondary btn-small" id="restartBtn">Välj en annan tid</button>
        </div>
      </div>`;

    const payBtn = document.getElementById('payBtn');
    payBtn.addEventListener('click', async () => {
      payBtn.disabled = true;
      payBtn.textContent = 'Öppnar betalningen …';
      try {
        const svar = await fetch('/api/boka', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            datum: iso(state.date),
            tid: state.time,
            namn: f.name,
            epost: f.email,
            telefon: f.phone,
            sprak: f.lang,
            om_oss: f.about,
            gdpr: true
          })
        });
        const data = await svar.json().catch(() => ({}));
        if (svar.ok && data.url) {
          window.location.href = data.url;
          return;
        }
        if (data.upptagen) {
          // Tiden hann tas: hämta om och låt paret välja en ny
          try { await hamtaTider(); } catch (e) { /* visa ändå */ }
          state.time = null;
          state.step = 2;
          render();
          const status = body.querySelector('.booking-status');
          if (status) status.textContent = data.fel;
          return;
        }
        renderConfirm(data.fel || `Betalningen kunde inte startas. Försök igen, eller mejla ${BOOKING_EMAIL}.`);
      } catch (e) {
        renderConfirm(`Ingen kontakt med servern. Kontrollera uppkopplingen och försök igen, eller mejla ${BOOKING_EMAIL}.`);
      }
    });

    document.getElementById('editBtn').addEventListener('click', () => { state.step = 3; render(); });
    document.getElementById('restartBtn').addEventListener('click', () => {
      state.step = 1;
      state.date = null;
      state.time = null;
      render();
    });
  }

  function esc(t) {
    return String(t || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Start ---------- */
  body.innerHTML = '<p class="booking-status" role="status">Hämtar lediga tider …</p>';
  hamtaTider().then(data => {
    satDatumgranser(data.idag);
    valjStartmanad();
    render();
    if (new URLSearchParams(location.search).get('avbruten')) {
      const status = body.querySelector('.cal-head');
      if (status) status.insertAdjacentHTML('beforebegin',
        '<p class="booking-status" role="status">Betalningen avbröts och tiden är släppt. Välj gärna en tid igen.</p>');
    }
  }).catch(() => {
    body.innerHTML = `<div class="callout warm" role="alert"><p><strong>Kalendern kunde inte laddas just nu.</strong>
      Ladda om sidan om en stund, eller mejla <a href="mailto:${BOOKING_EMAIL}">${BOOKING_EMAIL}</a> med ett par tider som passar er.</p></div>`;
  });
})();
