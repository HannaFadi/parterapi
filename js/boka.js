// Bokningsflöde: kalender → tid → formulär → skicka förfrågan.
// Ingen server: paret väljer en tid ur Maries angivna tillgänglighet och
// skickar en FÖRFRÅGAN som förifyllt e-postmeddelande. Tiden är bokad
// först när Marie har svarat. Flödet säger det rakt ut i varje steg.

(function () {
  const body = document.getElementById('bookingBody');
  if (!body) return;

  /* ══════════════════════════════════════════════════════════════════
     MARIES TILLGÄNGLIGHET — det här är det enda som behöver ändras
     ══════════════════════════════════════════════════════════════════
     Nyckel = veckodag (0 = söndag, 1 = måndag … 5 = fredag, 6 = lördag).
     Värde  = listan med starttider. Varje samtal är 90 minuter, så
              '14.00' betyder 14.00–15.30.
     Ta bort en dag helt genom att radera raden.
     Lägg in enstaka stängda datum i STANGT (formatet 'ÅÅÅÅ-MM-DD'). */

  const TILLGANGLIGHET = {
    5: ['14.00', '16.00']   // fredagar: 14.00–15.30 och 16.00–17.30
  };

  const STANGT = [
    // '2026-12-25',
  ];

  /* Adress till bokningstjänsten. Lämnas tom tills servern finns:
     då hämtas inga upptagna tider och förfrågan skickas som e-post.
     När servern är på plats, sätt t.ex. 'https://api.mariehanna.se'. */
  const API_BAS = '';

  const VECKOR_FRAMAT = 8;          // hur långt fram kalendern går
  const SAMTAL_MINUTER = 90;
  const BOOKING_EMAIL = 'kontakt@mariehanna.se';
  const SWISH_NUMBER = '073-983 07 66';
  /* ════════════════════════════════════════════════════════════════ */

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + VECKOR_FRAMAT * 7);

  // Öppna på första månaden som faktiskt har en ledig dag, annars innevarande
  (function valjStartmanad() {
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
  })();

  function isAvailable(d) {
    if (d <= today || d > maxDate) return false;
    if (STANGT.indexOf(iso(d)) !== -1) return false;
    const tider = TILLGANGLIGHET[d.getDay()];
    return !!(tider && tider.length);
  }

  /* Tider som redan är bokade, nyckel 'ÅÅÅÅ-MM-DD' → ['14.00', …].
     Fylls av hamtaUpptagna() när API_BAS är satt. */
  let upptagna = {};

  async function hamtaUpptagna() {
    if (!API_BAS) return;
    try {
      const svar = await fetch(API_BAS + '/tider', { headers: { 'Accept': 'application/json' } });
      if (!svar.ok) return;
      const data = await svar.json();
      if (data && typeof data === 'object') upptagna = data;
    } catch (e) {
      /* Nätverksfel: kalendern visar alla tider och Marie får dubbletten
         i mejl i stället — bättre än en kalender som vägrar visas. */
    }
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
            <input type="text" id="fName" required value="${f.name || ''}" placeholder="Anna & Erik Svensson" autocomplete="name">
          </div>
          <div class="field">
            <label for="fPhone">Telefon *</label>
            <input type="tel" id="fPhone" required value="${f.phone || ''}" placeholder="07X-XXX XX XX" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label for="fEmail">E-post *</label>
          <input type="email" id="fEmail" required value="${f.email || ''}" placeholder="er@epost.se" autocomplete="email">
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
          <textarea id="fAbout" placeholder="T.ex. hur länge ni varit tillsammans och vad som gör att ni söker parterapi just nu. Det räcker med en mening — resten tar vi i rummet.">${f.about || ''}</textarea>
          <p class="hint">Det ni skriver behandlas konfidentiellt och läses bara av mig.</p>
        </div>

        <div class="consent-box">
          <h4>Frivilligt: inspelning i utbildningssyfte</h4>
          <p>Som en del av min utbildning till certifierad EFT-terapeut kan samtal ibland filmas eller ljudinspelas, för att sedan gås igenom tillsammans med min handledare. <strong>Detta är helt frivilligt</strong> — ert svar påverkar varken pris, bemötande eller er möjlighet att gå i terapi, och ni kan när som helst ändra er.</p>
          <p>Inspelningar lagras krypterat, delas aldrig utanför handledningen, och raderas senast när utbildningen är avslutad. Läs mer i <a href="integritet.html" target="_blank">integritetspolicyn</a>.</p>
          <label class="check-row"><input type="radio" name="consent" value="ja" ${f.consent === 'ja' ? 'checked' : ''}> Ja, vi kan tänka oss att samtal spelas in i utbildningssyfte</label>
          <label class="check-row"><input type="radio" name="consent" value="nej" ${f.consent === 'nej' || !f.consent ? 'checked' : ''}> Nej tack, vi vill inte bli inspelade</label>
        </div>

        <label class="check-row" style="margin-bottom: 26px;">
          <input type="checkbox" id="fGdpr" required>
          <span>Jag godkänner att mina uppgifter behandlas enligt <a href="integritet.html" target="_blank">integritetspolicyn</a> för att hantera bokningen. *</span>
        </label>

        <div class="booking-actions">
          <button type="button" class="btn btn-secondary" id="backBtn">‹ Ändra tid</button>
          <button type="submit" class="btn btn-primary">Granska och skicka förfrågan ›</button>
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
    const consentEl = document.querySelector('input[name="consent"]:checked');
    state.form = {
      name: get('fName'),
      phone: get('fPhone'),
      email: get('fEmail'),
      about: get('fAbout'),
      lang: get('fLang') || 'svenska',
      consent: consentEl ? consentEl.value : 'nej'
    };
  }

  /* ---------- Steg 4: Bekräftelse ---------- */
  function renderConfirm() {
    const f = state.form;
    const subject = encodeURIComponent(`Bokningsförfrågan: parsamtal ${fmtDate(state.date)} kl. ${state.time}`);
    const bodyTxt = encodeURIComponent(
      `Hej Marie,\n\nVi vill boka ett parsamtal.\n\n` +
      `Datum: ${fmtDate(state.date)}\nTid: kl. ${tidSpann(state.time)} (90 min)\n` +
      `Språk: ${f.lang === 'franska' ? 'Franska' : 'Svenska'}\n\n` +
      `Namn: ${f.name}\nTelefon: ${f.phone}\nE-post: ${f.email}\n\n` +
      `Om oss:\n${f.about || '—'}\n\n` +
      `Inspelning i utbildningssyfte: ${f.consent === 'ja' ? 'Ja, det går bra' : 'Nej tack'}\n`
    );

    body.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style="font-size:1.7rem">Nästan klart — en knapptryckning kvar</h2>
        <p style="max-width:34em; margin: 12px auto 0;">Er förfrågan är sammanställd men <strong>inte skickad än</strong>. Klicka på knappen nedan så öppnas ett färdigskrivet mejl — skicka det, så svarar jag med en bekräftelse inom en arbetsdag. <strong>Tiden är er först när ni fått mitt svar.</strong></p>

        <dl class="confirm-details">
          <div><dt>Datum</dt><dd>${fmtDate(state.date)}</dd></div>
          <div><dt>Tid</dt><dd>kl. ${tidSpann(state.time)} (90 min)</dd></div>
          <div><dt>Namn</dt><dd style="text-transform:none">${f.name}</dd></div>
          <div><dt>Språk</dt><dd>${f.lang === 'franska' ? 'Franska' : 'Svenska'}</dd></div>
          <div><dt>Pris</dt><dd>450 kr</dd></div>
          <div><dt>Inspelning (frivillig)</dt><dd>${f.consent === 'ja' ? 'Ja' : 'Nej'}</dd></div>
        </dl>

        <a class="btn btn-primary" href="mailto:${BOOKING_EMAIL}?subject=${subject}&body=${bodyTxt}">Skicka förfrågan ✉</a>
        <p style="font-size:0.88rem; margin-top:16px;">Öppnas inget mejlprogram?
          <button type="button" class="btn btn-secondary btn-small" id="copyBtn">Kopiera uppgifterna</button>
          och mejla dem till <a href="mailto:${BOOKING_EMAIL}">${BOOKING_EMAIL}</a>.</p>

        <h3 style="margin: 40px 0 6px;">Betalning</h3>
        <p style="font-size:0.92rem;">Ni betalar efter varje samtal — välj det som passar er bäst:</p>
        <div class="pay-options">
          <div class="pay-option">
            <span class="swish-logo">Swish</span>
            <span>Swisha 450 kr efter samtalet till<br><strong>${SWISH_NUMBER}</strong></span>
          </div>
          <div class="pay-option">
            <strong>💳 Kort</strong>
            <span>Betala med bank- eller kreditkort på plats</span>
          </div>
        </div>

        <button class="btn btn-secondary btn-small" id="restartBtn" style="margin-top: 20px;">Välj en annan tid</button>
      </div>`;

    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const text = decodeURIComponent(bodyTxt);
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = 'Kopierat ✓';
        } catch (e) {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); copyBtn.textContent = 'Kopierat ✓'; }
          catch (e2) { copyBtn.textContent = 'Markera texten i mejlet i stället'; }
          document.body.removeChild(ta);
        }
        setTimeout(() => { copyBtn.textContent = 'Kopiera uppgifterna'; }, 4000);
      });
    }

    document.getElementById('restartBtn').addEventListener('click', () => {
      state.step = 1;
      state.date = null;
      state.time = null;
      render();
    });
  }

  render();
  // Rita bara om ifall servern faktiskt gav oss upptagna tider — annars
  // skulle omritningen rulla och flytta fokus direkt vid sidladdning.
  if (API_BAS) {
    hamtaUpptagna().then(() => {
      if (Object.keys(upptagna).length && (state.step === 1 || state.step === 2)) render();
    });
  }
})();
