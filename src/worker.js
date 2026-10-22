// Bokning och betalning för mariehanna.se.
//
//   GET  /api/tider           Maries schema + tider som redan är tagna
//   POST /api/boka            reserverar en tid och skapar en Stripe Checkout
//   GET  /api/avbryt          paret avbröt i Checkout: släpp tiden direkt
//   POST /api/stripe-webhook  Stripe meddelar betald eller utgången session
//
// Allt annat är statiska filer och når aldrig den här koden
// (run_worker_first i wrangler.jsonc).

import schema from './tillganglighet.json';

const RESERVATION_SEK = 31 * 60;  // Stripe kräver minst 30 min för expires_at
const MARGINAL_SEK = 5 * 60;      // tiden hålls lite längre än sessionen
const MANADER = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
const VECKODAGAR = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/tider' && request.method === 'GET') return await tider(env);
      if (url.pathname === '/api/boka' && request.method === 'POST') return await boka(request, env);
      if (url.pathname === '/api/avbryt' && request.method === 'GET') return await avbryt(url, env);
      if (url.pathname === '/api/stripe-webhook' && request.method === 'POST') return await webhook(request, env);
      return json({ fel: 'Finns inte' }, 404);
    } catch (e) {
      console.error('Oväntat fel', url.pathname, e && e.stack || e);
      return json({ fel: 'Något gick fel hos oss. Försök igen om en stund, eller mejla kontakt@mariehanna.se.' }, 500);
    }
  }
};

/* ---------- GET /api/tider ---------- */

async function tider(env) {
  await slappUtgangna(env);
  const { results } = await env.DB.prepare(
    "SELECT datum, tid FROM bokningar WHERE status IN ('reserverad','bokad') AND datum >= ?"
  ).bind(idagStockholm()).all();
  const upptagna = {};
  for (const r of results) (upptagna[r.datum] ||= []).push(r.tid);
  return json({
    veckodagar: schema.veckodagar,
    stangt: schema.stangt,
    veckorFramat: schema.veckorFramat,
    idag: idagStockholm(),
    upptagna
  }, 200, { 'Cache-Control': 'no-store' });
}

/* ---------- POST /api/boka ---------- */

async function boka(request, env) {
  let in_;
  try { in_ = await request.json(); } catch { return json({ fel: 'Ogiltig förfrågan.' }, 400); }

  const fel = valideraBokning(in_);
  if (fel) return json({ fel }, 400);

  const b = {
    id: crypto.randomUUID(),
    datum: in_.datum,
    tid: in_.tid,
    namn: in_.namn.trim(),
    epost: in_.epost.trim(),
    telefon: in_.telefon.trim(),
    sprak: in_.sprak === 'franska' ? 'franska' : 'svenska',
    om_oss: (in_.om_oss || '').trim(),
    inspelning: in_.inspelning === 'ja' ? 'ja' : 'nej',
    avbryt_nyckel: crypto.randomUUID()
  };
  const nu = sekunder();
  const sessionUtgar = nu + RESERVATION_SEK;

  await slappUtgangna(env);
  try {
    await env.DB.prepare(
      `INSERT INTO bokningar (id, datum, tid, status, namn, epost, telefon, sprak, om_oss, inspelning,
                              avbryt_nyckel, giltig_till, skapad)
       VALUES (?, ?, ?, 'reserverad', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(b.id, b.datum, b.tid, b.namn, b.epost, b.telefon, b.sprak, b.om_oss, b.inspelning,
           b.avbryt_nyckel, sessionUtgar + MARGINAL_SEK, nu).run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return json({ fel: 'Den tiden hann någon annan boka. Välj gärna en annan tid.', upptagen: true }, 409);
    }
    throw e;
  }

  const bas = env.SAJT_URL.replace(/\/$/, '');
  const beskrivning = `Parsamtal 90 min, ${datumText(b.datum)} kl. ${tidSpann(b.tid)}`;
  const params = {
    mode: 'payment',
    locale: 'sv',
    customer_email: b.epost,
    client_reference_id: b.id,
    expires_at: String(sessionUtgar),
    success_url: `${bas}/bokad?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${bas}/api/avbryt?b=${b.id}&n=${b.avbryt_nyckel}`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'sek',
    'line_items[0][price_data][unit_amount]': env.PRIS_ORE,
    'line_items[0][price_data][product_data][name]': beskrivning,
    'line_items[0][price_data][product_data][description]': 'EFT-parterapi med Marie Hanna, Sunnanväg 6D i Lund',
    'payment_intent_data[description]': beskrivning,
    // Bara id:t följer med till Stripe, aldrig det paret skrivit om sig själva
    'metadata[bokning]': b.id,
    'payment_intent_data[metadata][bokning]': b.id,
    'custom_text[submit][message]': 'Kostnadsfri avbokning fram till 24 timmar före samtalet. Vid senare avbokning återbetalas halva avgiften.'
  };
  // Betalsätten (kort, Swish) väljs i Stripes panel under Payment methods,
  // inte här: Stripe tillåter inte längre payment_method_types i Checkout.

  const svar = await stripe(env, 'POST', '/v1/checkout/sessions', params);
  if (!svar.ok) {
    console.error('Stripe Checkout misslyckades', svar.status, JSON.stringify(svar.data.error || svar.data));
    await env.DB.prepare("UPDATE bokningar SET status = 'slappt' WHERE id = ?").bind(b.id).run();
    return json({ fel: 'Betalningen kunde inte startas. Försök igen om en stund, eller mejla kontakt@mariehanna.se.' }, 502);
  }

  await env.DB.prepare('UPDATE bokningar SET stripe_session = ? WHERE id = ?').bind(svar.data.id, b.id).run();
  return json({ url: svar.data.url });
}

function valideraBokning(b) {
  if (!b || typeof b !== 'object') return 'Ogiltig förfrågan.';
  const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
  if (!str(b.namn, 2, 120)) return 'Fyll i era namn.';
  if (!str(b.epost, 5, 200) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.epost.trim())) return 'Fyll i en giltig e-postadress.';
  if (!str(b.telefon, 6, 30)) return 'Fyll i ett telefonnummer.';
  if (b.om_oss != null && (typeof b.om_oss !== 'string' || b.om_oss.length > 3000)) return 'Presentationen är för lång.';
  if (b.gdpr !== true) return 'Godkänn integritetspolicyn för att boka.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.datum || '') || !/^\d{2}\.\d{2}$/.test(b.tid || '')) return 'Välj datum och tid.';
  if (!tidFinnsISchemat(b.datum, b.tid)) return 'Den tiden går inte att boka. Välj en annan tid.';
  return null;
}

// Samma regler som kalendern: från i morgon och veckorFramat veckor fram.
function tidFinnsISchemat(datum, tid) {
  const idag = idagStockholm();
  const max = laggTillDagar(idag, schema.veckorFramat * 7);
  if (datum <= idag || datum > max) return false;
  if (schema.stangt.includes(datum)) return false;
  const veckodag = new Date(datum + 'T12:00:00Z').getUTCDay();
  return (schema.veckodagar[veckodag] || []).includes(tid);
}

/* ---------- GET /api/avbryt ---------- */

async function avbryt(url, env) {
  const id = url.searchParams.get('b') || '';
  const nyckel = url.searchParams.get('n') || '';
  const rad = await env.DB.prepare(
    "SELECT stripe_session FROM bokningar WHERE id = ? AND avbryt_nyckel = ? AND status = 'reserverad'"
  ).bind(id, nyckel).first();
  if (rad) {
    // Stäng sessionen först, så att en sen betalning inte kan gå igenom
    // på en tid som redan släppts.
    if (rad.stripe_session) {
      const s = await stripe(env, 'POST', `/v1/checkout/sessions/${rad.stripe_session}/expire`, {});
      if (!s.ok && s.data?.error?.code !== 'checkout_session_expired') {
        console.error('Kunde inte stänga Checkout', rad.stripe_session, JSON.stringify(s.data.error || s.data));
      }
    }
    await env.DB.prepare("UPDATE bokningar SET status = 'slappt' WHERE id = ? AND status = 'reserverad'").bind(id).run();
  }
  return Response.redirect(`${env.SAJT_URL.replace(/\/$/, '')}/boka?avbruten=1`, 303);
}

/* ---------- POST /api/stripe-webhook ---------- */

async function webhook(request, env) {
  const kropp = await request.text();
  if (!(await stripeSignaturOk(kropp, request.headers.get('Stripe-Signature'), (env.STRIPE_WEBHOOK_SECRET || '').trim()))) {
    return json({ fel: 'Ogiltig signatur' }, 400);
  }
  const handelse = JSON.parse(kropp);
  const session = handelse.data && handelse.data.object;
  const id = session && (session.client_reference_id || (session.metadata && session.metadata.bokning));
  if (!id) return json({ ok: true });

  if (handelse.type === 'checkout.session.completed' || handelse.type === 'checkout.session.async_payment_succeeded') {
    if (session.payment_status === 'paid') await markeraBetald(env, id, session);
  } else if (handelse.type === 'checkout.session.expired') {
    await env.DB.prepare("UPDATE bokningar SET status = 'slappt' WHERE id = ? AND status = 'reserverad'").bind(id).run();
  }
  return json({ ok: true });
}

async function markeraBetald(env, id, session) {
  const rad = await env.DB.prepare('SELECT * FROM bokningar WHERE id = ?').bind(id).first();
  if (!rad || rad.status === 'bokad' || rad.status === 'krock') return; // okänd eller redan hanterad (Stripe kan skicka igen)

  let status = 'bokad';
  try {
    await env.DB.prepare("UPDATE bokningar SET status = 'bokad', bokad = ? WHERE id = ?").bind(sekunder(), id).run();
  } catch (e) {
    // Reservationen hann släppas och tiden tas av någon annan innan betalningen kom in
    if (!String(e).includes('UNIQUE')) throw e;
    status = 'krock';
    await env.DB.prepare("UPDATE bokningar SET status = 'krock' WHERE id = ?").bind(id).run();
  }
  await mejlaMarie(env, { ...rad, status }, session);
  if (status === 'bokad') await mejlaParet(env, rad);
}

/* ---------- E-post ---------- */

async function mejlaMarie(env, b, session) {
  const krock = b.status === 'krock';
  const rubrik = krock
    ? `KROCK – återbetala: ${datumText(b.datum)} kl. ${b.tid}`
    : `Ny bokning: ${datumText(b.datum)} kl. ${b.tid}`;
  const rader = [
    krock ? 'Paret har betalat, men tiden hann bokas av någon annan. Återbetala i Stripe och kontakta paret.\n' : 'Ett nytt par har bokat och betalat.\n',
    `Datum: ${datumText(b.datum)}`,
    `Tid: ${tidSpann(b.tid)} (90 min)`,
    `Namn: ${b.namn}`,
    `E-post: ${b.epost}`,
    `Telefon: ${b.telefon}`,
    `Språk: ${b.sprak}`,
    `Inspelning i utbildningssyfte: ${b.inspelning === 'ja' ? 'ja' : 'nej'}`,
    `Betalt: ${(session.amount_total / 100).toFixed(0)} kr (Stripe ${session.payment_intent || session.id})`,
    '',
    'Om oss:',
    b.om_oss || '–'
  ];
  await skicka(env, {
    to: env.MARIE_EPOST,
    from: { email: env.AVSANDARE, name: 'Bokning mariehanna.se' },
    replyTo: { email: b.epost, name: b.namn },
    subject: rubrik,
    text: rader.join('\n')
  });
}

async function mejlaParet(env, b) {
  const text = [
    `Hej ${b.namn},`,
    '',
    `Tack för er bokning. Välkomna ${datumText(b.datum)} kl. ${tidSpann(b.tid)} på Sunnanväg 6D i Lund.`,
    '',
    'Samtalet är 90 minuter och betalt. Kvitto från Stripe kommer i ett separat mejl.',
    'Avbokning är kostnadsfri fram till 24 timmar före samtalet; vid senare avbokning återbetalas halva avgiften.',
    'Svara på det här mejlet om ni behöver ändra något.',
    '',
    'Varma hälsningar,',
    'Marie Hanna'
  ].join('\n');
  await skicka(env, {
    to: b.epost,
    from: { email: env.AVSANDARE, name: 'Marie Hanna' },
    replyTo: 'kontakt@mariehanna.se',
    subject: `Bokningsbekräftelse: ${datumText(b.datum)} kl. ${b.tid}`,
    text
  });
}

// Ett mejl som inte går iväg får aldrig stoppa en betald bokning:
// bokningen står i databasen och betalningen i Stripe ändå.
async function skicka(env, meddelande) {
  if (!env.EMAIL) return;
  try {
    await env.EMAIL.send(meddelande);
  } catch (e) {
    console.error('Mejl kunde inte skickas', e && e.code, e && e.message, 'till', typeof meddelande.to === 'string' ? meddelande.to : '');
  }
}

/* ---------- Stripe ---------- */

async function stripe(env, metod, sokvag, params) {
  const nyckel = (env.STRIPE_SECRET_KEY || '').trim();
  if (!nyckel) {
    console.error('STRIPE_SECRET_KEY saknas eller är tom – lägg in den med wrangler secret put');
    return { ok: false, status: 0, data: { error: { message: 'Ingen Stripe-nyckel' } } };
  }
  const r = await fetch('https://api.stripe.com' + sokvag, {
    method: metod,
    headers: {
      'Authorization': `Bearer ${nyckel}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: metod === 'GET' ? undefined : new URLSearchParams(params)
  });
  let data = {};
  try { data = await r.json(); } catch { /* tom kropp */ }
  return { ok: r.ok, status: r.status, data };
}

// Stripe-Signature: t=<unixtid>,v1=<hex HMAC-SHA256 av "t.kropp">
async function stripeSignaturOk(kropp, rubrik, hemlighet) {
  if (!rubrik || !hemlighet) return false;
  let t = null;
  const v1 = [];
  for (const del of rubrik.split(',')) {
    const [k, v] = del.split('=');
    if (k === 't') t = v;
    if (k === 'v1') v1.push(v);
  }
  if (!t || !v1.length) return false;
  if (Math.abs(sekunder() - Number(t)) > 300) return false;

  const nyckel = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(hemlighet), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', nyckel, new TextEncoder().encode(`${t}.${kropp}`)));
  const vantad = [...sig].map(x => x.toString(16).padStart(2, '0')).join('');
  return v1.some(s => tidskonstantLika(s, vantad));
}

function tidskonstantLika(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------- Hjälpare ---------- */

async function slappUtgangna(env) {
  await env.DB.prepare("UPDATE bokningar SET status = 'slappt' WHERE status = 'reserverad' AND giltig_till < ?")
    .bind(sekunder()).run();
}

function sekunder() { return Math.floor(Date.now() / 1000); }

function idagStockholm() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date());
}

function laggTillDagar(datum, dagar) {
  const d = new Date(datum + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dagar);
  return d.toISOString().slice(0, 10);
}

function datumText(datum) {
  const d = new Date(datum + 'T12:00:00Z');
  return `${VECKODAGAR[d.getUTCDay()]} ${d.getUTCDate()} ${MANADER[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function tidSpann(start) {
  const [h, m] = start.split('.').map(Number);
  const slut = h * 60 + m + (schema.samtalMinuter || 90);
  return `${start}–${Math.floor(slut / 60)}.${String(slut % 60).padStart(2, '0')}`;
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra }
  });
}
