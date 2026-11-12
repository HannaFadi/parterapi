// Adminsidan: Marie ser sina bokningar och redigerar sina bokningsbara tider.
// All data kommer från /api/admin (src/worker.js) och kräver inloggning.
// Det paren skrivit sätts alltid in som text, aldrig som HTML.

(function () {
  const MANADER = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
  const VECKODAGAR = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'];
  const VECKA_MANDAG_FORST = [1, 2, 3, 4, 5, 6, 0];

  const $ = id => document.getElementById(id);
  let data = null;        // senaste svaret från /api/admin/oversikt
  let schema = null;      // arbetskopia som Marie redigerar
  let sparatSchema = '';  // JSON av det som ligger på servern
  let samtalMin = 90;

  /* ---------- Små hjälpare ---------- */

  function h(tagg, attribut, ...barn) {
    const el = document.createElement(tagg);
    for (const [k, v] of Object.entries(attribut || {})) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const b of barn.flat()) if (b != null && b !== false) el.append(b);
    return el;
  }

  function tillDatum(iso) { return new Date(iso + 'T12:00:00'); }
  function tillIso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function datumText(iso, medAr) {
    const d = tillDatum(iso);
    return `${VECKODAGAR[d.getDay()]} ${d.getDate()} ${MANADER[d.getMonth()]}` + (medAr ? ` ${d.getFullYear()}` : '');
  }
  function storBokstav(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function minuter(tid) { const [a, b] = tid.split('.').map(Number); return a * 60 + b; }
  function tidSpann(tid) {
    const slut = minuter(tid) + samtalMin;
    return `${tid}–${String(Math.floor(slut / 60)).padStart(2, '0')}.${String(slut % 60).padStart(2, '0')}`;
  }
  function tiderFor(iso) {
    return schema.undantag[iso] || schema.veckodagar[tillDatum(iso).getDay()] || [];
  }

  async function api(metod, sokvag, kropp) {
    let svar;
    try {
      svar = await fetch('/api/admin/' + sokvag, {
        method: metod,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: kropp ? { 'Content-Type': 'application/json' } : {},
        body: kropp ? JSON.stringify(kropp) : undefined
      });
    } catch (e) {
      throw new Error('Ingen kontakt med servern. Kontrollera uppkopplingen och försök igen.');
    }
    const json = await svar.json().catch(() => ({}));
    if (svar.status === 401 && json.utloggad) { visaLogin(); throw new Error('utloggad'); }
    if (!svar.ok) throw new Error(json.fel || 'Något gick fel. Försök igen om en stund.');
    return json;
  }

  function visaFel(text) {
    const el = $('adminFel');
    el.textContent = text || '';
    el.hidden = !text;
    if (text) el.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- Inloggning ---------- */

  function visaLogin(fel) {
    $('vyAdmin').hidden = true;
    $('loggaUt').hidden = true;
    $('vyLogin').hidden = false;
    $('loginFel').textContent = fel || '';
    $('loginFel').hidden = !fel;
    $('losenord').focus();
  }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const knapp = e.target.querySelector('button');
    knapp.disabled = true;
    try {
      await api('POST', 'login', { losenord: $('losenord').value });
      $('losenord').value = '';
      await ladda();
    } catch (fel) {
      visaLogin(fel.message === 'utloggad' ? 'Fel lösenord.' : fel.message);
    } finally {
      knapp.disabled = false;
    }
  });

  $('loggaUt').addEventListener('click', async () => {
    if (osparat() && !confirm('Du har ändringar som inte är sparade. Logga ut ändå?')) return;
    try { await api('POST', 'logout'); } catch (e) { /* visa inloggningen ändå */ }
    sparatSchema = JSON.stringify(schema);
    visaLogin();
  });

  /* ---------- Ladda och rita ---------- */

  async function ladda() {
    try {
      data = await api('GET', 'oversikt');
    } catch (fel) {
      if (fel.message !== 'utloggad') visaLogin(fel.message);
      return;
    }
    samtalMin = data.samtalMinuter || 90;
    schema = JSON.parse(JSON.stringify(data.schema));
    sparatSchema = JSON.stringify(schema);
    $('vyLogin').hidden = true;
    $('vyAdmin').hidden = false;
    $('loggaUt').hidden = false;
    visaFel('');
    ritaAllt();
  }

  function ritaAllt() {
    ritaBokningar();
    ritaAgenda();
    ritaVeckoschema();
    ritaUndantag();
    ritaVeckorFramat();
    uppdateraSpara();
  }

  /* ---------- Bokningar ---------- */

  function bokningskort(b) {
    const passerad = b.datum < data.idag;
    const markning =
      b.status === 'krock' ? h('span', { class: 'markning varning' }, 'Krock – återbetala') :
      b.status === 'avbokad' ? h('span', { class: 'markning' }, 'Avbokad') :
      b.status === 'reserverad' ? h('span', { class: 'markning' }, 'Betalar just nu') : null;

    return h('article', { class: `admin-card bokning ${b.status}${passerad ? ' passerad' : ''}` },
      h('div', { class: 'bokning-nar' }, `${storBokstav(datumText(b.datum, true))} kl. ${tidSpann(b.tid)}`, markning),
      h('div', { class: 'bokning-namn' }, b.namn),
      h('div', { class: 'bokning-kontakt' },
        h('a', { href: 'tel:' + b.telefon.replace(/[^\d+]/g, '') }, b.telefon),
        h('a', { href: 'mailto:' + b.epost }, b.epost),
        h('span', {}, 'Språk: ' + b.sprak)),
      b.om_oss ? h('div', { class: 'bokning-om' }, b.om_oss) : null,
      (b.status === 'bokad' && !passerad) ? h('div', { class: 'bokning-fot' },
        h('small', {}, b.bokad ? 'Bokad ' + new Date(b.bokad * 1000).toLocaleDateString('sv-SE') : ''),
        h('button', { type: 'button', class: 'lank-knapp', onclick: () => avboka(b) }, 'Avboka samtalet')) : null
    );
  }

  function ritaBokningar() {
    const aktiva = data.bokningar.filter(b => b.datum >= data.idag && (b.status === 'bokad' || b.status === 'krock'));
    const ovriga = data.bokningar.filter(b => !aktiva.includes(b) && b.status !== 'reserverad').reverse();

    $('kommande').replaceChildren(...(aktiva.length
      ? aktiva.map(bokningskort)
      : [h('p', { class: 'tomt' }, 'Inga kommande bokningar just nu.')]));
    $('tidigare').replaceChildren(...(ovriga.length
      ? ovriga.map(bokningskort)
      : [h('p', { class: 'tomt' }, 'Inget här än.')]));
  }

  async function avboka(b) {
    const fraga = `Avboka ${b.namn}, ${datumText(b.datum)} kl. ${b.tid}?\n\n` +
      'Tiden blir ledig i kalendern igen. Paret får inget meddelande och inga pengar tillbaka automatiskt: ' +
      'kontakta dem själv och gör återbetalningen i Stripe.';
    if (!confirm(fraga)) return;
    try {
      await api('POST', 'avboka', { id: b.id });
      b.status = 'avbokad';
      visaFel('');
      ritaBokningar();
      ritaAgenda();
    } catch (fel) {
      if (fel.message !== 'utloggad') visaFel(fel.message);
    }
  }

  /* ---------- Agenda: dag för dag de närmaste veckorna ---------- */

  function ritaAgenda() {
    const perDag = {};
    for (const b of data.bokningar) {
      if (b.status === 'bokad' || b.status === 'reserverad') (perDag[b.datum] ||= {})[b.tid] = b;
    }
    const rader = [];
    const d = tillDatum(data.idag);
    for (let i = 0; i < schema.veckorFramat * 7; i++) {
      d.setDate(d.getDate() + 1); // går att boka från i morgon
      const iso = tillIso(d);
      const bokade = perDag[iso] || {};
      const tider = [...new Set([...tiderFor(iso), ...Object.keys(bokade)])].sort();
      const harUndantag = !!schema.undantag[iso];
      if (!tider.length && !harUndantag) continue;

      rader.push(h('div', { class: 'agenda-dag' },
        h('div', { class: 'dag' }, storBokstav(datumText(iso)), harUndantag ? h('small', {}, 'Egna tider den här dagen') : null),
        h('div', { class: 'brickor' }, tider.length ? tider.map(t => {
          const b = bokade[t];
          if (!b) return h('span', { class: 'bricka' }, `${tidSpann(t)} · ledig`);
          return h('span', { class: 'bricka ' + b.status },
            `${tidSpann(t)} · ${b.status === 'bokad' ? b.namn : 'betalning pågår'}`);
        }) : h('span', { class: 'stangt' }, 'Stängt')),
        h('button', { type: 'button', class: 'lank-knapp', onclick: () => andraDag(iso) }, 'Ändra dagen')
      ));
    }
    $('agenda').replaceChildren(...(rader.length ? rader : [h('p', { class: 'tomt' }, 'Inga bokningsbara tider de närmaste veckorna.')]));
  }

  function andraDag(iso) {
    if (!schema.undantag[iso]) schema.undantag[iso] = [...tiderFor(iso)];
    visaFlik('tider');
    ritaUndantag();
    uppdateraSpara();
    const rad = document.querySelector(`[data-undantag="${iso}"]`);
    if (rad) rad.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- Schemaredigering ---------- */

  // Brickor med kryss plus en ruta för att lägga till en tid. `tider` ändras på plats.
  function tidRedigerare(tider, vidAndring, tomText) {
    const ruta = h('input', { type: 'time', step: '300', 'aria-label': 'Ny starttid' });
    const laggTill = () => {
      if (!ruta.value) { ruta.focus(); return; }
      const ny = ruta.value.slice(0, 5).replace(':', '.');
      if (tider.includes(ny)) return;
      const krock = tider.find(t => Math.abs(minuter(t) - minuter(ny)) < samtalMin);
      if (krock) {
        alert(`Tiden ${ny} krockar med ${tidSpann(krock)}. Ett samtal är ${samtalMin} minuter.`);
        return;
      }
      tider.push(ny);
      tider.sort();
      vidAndring();
    };
    ruta.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); laggTill(); } });

    return h('div', { class: 'brickor' },
      tider.length
        ? tider.map(t => h('span', { class: 'bricka' }, tidSpann(t),
            h('button', { type: 'button', 'aria-label': `Ta bort ${t}`, title: 'Ta bort',
              onclick: () => { tider.splice(tider.indexOf(t), 1); vidAndring(); } }, '×')))
        : h('span', { class: 'stangt' }, tomText),
      h('span', { class: 'ny-tid' }, ruta,
        h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: laggTill }, 'Lägg till'))
    );
  }

  function ritaVeckoschema() {
    $('veckoschema').replaceChildren(...VECKA_MANDAG_FORST.map(dag => {
      const tider = schema.veckodagar[dag] || [];
      const vidAndring = () => {
        if (tider.length) schema.veckodagar[dag] = tider; else delete schema.veckodagar[dag];
        andrat();
      };
      return h('div', { class: 'schema-rad' },
        h('div', { class: 'dag' }, storBokstav(VECKODAGAR[dag]) + 'ar'),
        tidRedigerare(tider, vidAndring, 'Inga tider'));
    }));
  }

  function ritaUndantag() {
    const datum = Object.keys(schema.undantag).sort();
    $('undantag').replaceChildren(...datum.map(iso => {
      const tider = schema.undantag[iso];
      return h('div', { class: 'schema-rad undantag-rad', 'data-undantag': iso },
        h('div', { class: 'dag' }, storBokstav(datumText(iso, true)),
          h('small', {}, h('button', { type: 'button', class: 'lank-knapp',
            onclick: () => { delete schema.undantag[iso]; andrat(); } }, 'Återgå till veckoschemat'))),
        tidRedigerare(tider, andrat, 'Stängt hela dagen'));
    }));
    $('nyttDatum').min = data.idag;
  }

  $('laggTillDatum').addEventListener('click', () => {
    const iso = $('nyttDatum').value;
    if (!iso) { $('nyttDatum').focus(); return; }
    if (iso < data.idag) { alert('Välj ett datum framåt i tiden.'); return; }
    // Börja från dagens vanliga tider: töm för att stänga, eller lägg till fler
    if (!schema.undantag[iso]) schema.undantag[iso] = [...tiderFor(iso)];
    $('nyttDatum').value = '';
    andrat();
    const rad = document.querySelector(`[data-undantag="${iso}"]`);
    if (rad) rad.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function ritaVeckorFramat() {
    const val = $('veckorFramat');
    val.replaceChildren(...[2, 3, 4, 6, 8, 10, 12, 16, 20, 26]
      .concat([2, 3, 4, 6, 8, 10, 12, 16, 20, 26].includes(schema.veckorFramat) ? [] : [schema.veckorFramat])
      .sort((a, b) => a - b)
      .map(n => h('option', { value: n, selected: n === schema.veckorFramat }, `${n} veckor`)));
  }
  $('veckorFramat').addEventListener('change', e => { schema.veckorFramat = Number(e.target.value); andrat(); });

  /* ---------- Spara ---------- */

  function osparat() { return !!schema && JSON.stringify(schema) !== sparatSchema; }

  function andrat() {
    ritaVeckoschema();
    ritaUndantag();
    ritaAgenda();
    uppdateraSpara();
  }

  function uppdateraSpara(text) {
    $('spara').disabled = !osparat();
    $('sparaStatus').textContent = text || (osparat() ? 'Du har ändringar som inte är sparade.' : '');
  }

  $('spara').addEventListener('click', async () => {
    $('spara').disabled = true;
    $('sparaStatus').textContent = 'Sparar …';
    try {
      const svar = await api('PUT', 'schema', schema);
      schema = svar.schema;
      data.schema = JSON.parse(JSON.stringify(schema));
      sparatSchema = JSON.stringify(schema);
      visaFel('');
      ritaAllt();
      uppdateraSpara('Sparat. Kalendern på sajten är uppdaterad.');
    } catch (fel) {
      if (fel.message !== 'utloggad') visaFel(fel.message);
      uppdateraSpara();
    }
  });

  window.addEventListener('beforeunload', e => { if (osparat()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Flikar ---------- */

  function visaFlik(namn) {
    $('flikBokningar').hidden = namn !== 'bokningar';
    $('flikTider').hidden = namn !== 'tider';
    document.querySelectorAll('.admin-flikar button').forEach(k => k.setAttribute('aria-pressed', String(k.dataset.flik === namn)));
  }
  document.querySelectorAll('.admin-flikar button').forEach(k => k.addEventListener('click', () => visaFlik(k.dataset.flik)));

  ladda();
})();
