// Förfrågan om ett kostnadsfritt telefonsamtal (formuläret på /boka).
// Skickas till /api/forfragan, som mejlar den till Marie.

(function () {
  const form = document.getElementById('forfraganForm');
  if (!form) return;
  const fel = document.getElementById('forfraganFel');
  const knapp = form.querySelector('button[type="submit"]');
  const v = id => document.getElementById(id).value.trim();

  function visaFel(text) {
    fel.querySelector('p').textContent = text || '';
    fel.hidden = !text;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    visaFel('');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    knapp.disabled = true;
    knapp.textContent = 'Skickar …';
    try {
      const svar = await fetch('/api/forfragan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          namn: v('qNamn'),
          telefon: v('qTelefon'),
          epost: v('qEpost'),
          nar: v('qNar'),
          meddelande: v('qMeddelande'),
          webbplats: v('qWebbplats'),
          gdpr: document.getElementById('qGdpr').checked
        })
      });
      const data = await svar.json().catch(() => ({}));
      if (!svar.ok) throw new Error(data.fel || 'Förfrågan kunde inte skickas. Försök igen om en stund.');

      const tack = document.createElement('div');
      tack.className = 'callout olive';
      tack.setAttribute('role', 'status');
      tack.tabIndex = -1;
      const p = document.createElement('p');
      const stark = document.createElement('strong');
      stark.textContent = 'Tack, förfrågan är skickad. ';
      p.append(stark, 'Jag svarar via mejl inom en arbetsdag, så bestämmer vi en tid för telefonsamtalet.');
      tack.append(p);
      form.replaceWith(tack);
      tack.focus();
    } catch (err) {
      visaFel(err instanceof TypeError
        ? 'Ingen kontakt med servern. Kontrollera uppkopplingen och försök igen, eller mejla kontakt@mariehanna.se.'
        : err.message);
      knapp.disabled = false;
      knapp.textContent = 'Skicka förfrågan';
    }
  });
})();
