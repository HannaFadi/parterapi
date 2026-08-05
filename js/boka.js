// Bokningsflöde: kalender → tid → formulär → bekräftelse.
// Demoversion utan backend: tillgängliga tider genereras lokalt och
// bokningsförfrågan skickas som förifyllt e-postmeddelande.

(function () {
  const body = document.getElementById('bookingBody');
  if (!body) return;

  const MONTHS = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
  const DOW = ['Mån','Tis','Ons','Tor','Fre','Lör','Sön'];
  const BOOKING_EMAIL = 'kontakt@mariecuchethanna.se';
  const SWISH_NUMBER = '123 456 78 90'; // ersätts med Maries riktiga Swish-nummer

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
  maxDate.setDate(maxDate.getDate() + 56); // 8 veckor framåt

  state.viewYear = today.getFullYear();
  state.viewMonth = today.getMonth();

  // Tillgänglighet (demo): tis/ons/tor kvällar + varannan lördag förmiddag.
  function isAvailable(d) {
    if (d <= today || d > maxDate) return false;
    const dow = d.getDay(); // 0=sön
    if (dow === 2 || dow === 3 || dow === 4) return true;
    if (dow === 6) {
      const week = Math.floor((d - today) / (7 * 864e5));
      return week % 2 === 0;
    }
    return false;
  }

  function slotsFor(d) {
    return d.getDay() === 6 ? ['10:00', '12:00'] : ['16:00', '17:45', '19:30'];
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
    if (!firstRender) body.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    firstRender = false;
  }

  /* ---------- Steg 1: Kalender ---------- */
  function renderCalendar() {
    const y = state.viewYear, m = state.viewMonth;
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7; // måndag först
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const prevDisabled = y === today.getFullYear() && m === today.getMonth();
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
      html += `<button class="cal-day${avail ? ' available' : ''}${sel ? ' selected' : ''}"
                ${avail ? `data-date="${d.toISOString()}"` : 'disabled tabindex="-1"'}>${day}</button>`;
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
      <div class="booking-summary">📅 <strong>${fmtDate(state.date)}</strong> — välj en tid nedan</div>
      <h3>Lediga tider</h3>
      <div class="time-grid">`;
    slotsFor(state.date).forEach(t => {
      html += `<button class="time-slot${state.time === t ? ' selected' : ''}" data-time="${t}">${t}</button>`;
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
      <div class="booking-summary">📅 <strong>${fmtDate(state.date)}</strong> kl <strong>${state.time}</strong> · 90 min · 450 kr</div>
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
          <label for="fAbout">Berätta kort om er <span class="opt">(några rader räcker)</span></label>
          <textarea id="fAbout" placeholder="T.ex. hur länge ni varit tillsammans, vad som gör att ni söker parterapi just nu, och vad ni hoppas få ut av samtalen.">${f.about || ''}</textarea>
          <p class="hint">Det ni skriver behandlas konfidentiellt och läses endast av Marie.</p>
        </div>

        <div class="consent-box">
          <h4>Frivilligt: inspelning i utbildningssyfte</h4>
          <p>Som en del av Maries utbildning till certifierad EFT-terapeut kan samtal ibland filmas eller ljudinspelas, för att sedan gås igenom tillsammans med hennes handledare. <strong>Detta är helt frivilligt</strong> — ert svar påverkar varken pris, bemötande eller er möjlighet att gå i terapi, och ni kan när som helst ändra er.</p>
          <p>Inspelningar lagras krypterat, delas aldrig utanför handledningen, och raderas senast när utbildningen är avslutad. Läs mer i vår <a href="integritet.html" target="_blank">integritetspolicy</a>.</p>
          <label class="check-row"><input type="radio" name="consent" value="ja" ${f.consent === 'ja' ? 'checked' : ''}> Ja, vi kan tänka oss att samtal spelas in i utbildningssyfte</label>
          <label class="check-row"><input type="radio" name="consent" value="nej" ${f.consent === 'nej' || !f.consent ? 'checked' : ''}> Nej tack, vi vill inte bli inspelade</label>
        </div>

        <label class="check-row" style="margin-bottom: 26px;">
          <input type="checkbox" id="fGdpr" required>
          <span>Jag godkänner att mina uppgifter behandlas enligt <a href="integritet.html" target="_blank">integritetspolicyn</a> för att hantera bokningen. *</span>
        </label>

        <div class="booking-actions">
          <button type="button" class="btn btn-secondary" id="backBtn">‹ Ändra tid</button>
          <button type="submit" class="btn btn-primary">Slutför bokning ›</button>
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
      consent: consentEl ? consentEl.value : 'nej'
    };
  }

  /* ---------- Steg 4: Bekräftelse ---------- */
  function renderConfirm() {
    const f = state.form;
    const subject = encodeURIComponent(`Bokningsförfrågan: parsamtal ${fmtDate(state.date)} kl ${state.time}`);
    const bodyTxt = encodeURIComponent(
      `Hej Marie,\n\nVi vill boka ett parsamtal.\n\n` +
      `Datum: ${fmtDate(state.date)}\nTid: ${state.time}\n\n` +
      `Namn: ${f.name}\nTelefon: ${f.phone}\nE-post: ${f.email}\n\n` +
      `Om oss:\n${f.about || '—'}\n\n` +
      `Inspelning i utbildningssyfte: ${f.consent === 'ja' ? 'Ja, det går bra' : 'Nej tack'}\n`
    );

    body.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style="font-size:1.7rem">Tack, ${f.name.split('&')[0].split(' ')[0] || 'och välkomna'}!</h2>
        <p style="max-width:32em; margin: 12px auto 0;">Er bokningsförfrågan är klar att skickas. Klicka på knappen nedan så öppnas ett förifyllt mejl — skicka det, så bekräftar Marie er tid via e-post inom en arbetsdag.</p>

        <dl class="confirm-details">
          <div><dt>Datum</dt><dd>${fmtDate(state.date)}</dd></div>
          <div><dt>Tid</dt><dd>${state.time} (90 min)</dd></div>
          <div><dt>Namn</dt><dd style="text-transform:none">${f.name}</dd></div>
          <div><dt>Pris</dt><dd>450 kr</dd></div>
          <div><dt>Inspelning (frivillig)</dt><dd>${f.consent === 'ja' ? 'Ja' : 'Nej'}</dd></div>
        </dl>

        <a class="btn btn-primary" href="mailto:${BOOKING_EMAIL}?subject=${subject}&body=${bodyTxt}">Skicka bokningsförfrågan ✉</a>

        <h3 style="margin: 40px 0 6px;">Betalning</h3>
        <p style="font-size:0.92rem;">Ni betalar efter varje samtal — välj det som passar er bäst:</p>
        <div class="pay-options">
          <div class="pay-option">
            <span class="swish-logo">Swish</span>
            <span>Swisha 450 kr till<br><strong>${SWISH_NUMBER}</strong></span>
          </div>
          <div class="pay-option">
            <strong>💳 Kort</strong>
            <span>Betala med bank- eller kreditkort på plats</span>
          </div>
        </div>

        <button class="btn btn-secondary btn-small" id="restartBtn" style="margin-top: 20px;">Boka en till tid</button>
      </div>`;

    document.getElementById('restartBtn').addEventListener('click', () => {
      state.step = 1;
      state.date = null;
      state.time = null;
      render();
    });
  }

  render();
})();
