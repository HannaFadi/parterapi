// Kärleksspråk-quiz: 10 parvisa val, alla 10 kombinationer av de 5 språken.
// Fritt inspirerat av Gary Chapmans "The 5 Love Languages".

(function () {
  const root = document.getElementById('quizLove');
  if (!root) return;

  const LANGS = {
    ord:      { name: 'Bekräftande ord', emoji: '💬' },
    tid:      { name: 'Kvalitetstid', emoji: '⏳' },
    gavor:    { name: 'Gåvor', emoji: '🎁' },
    tjanster: { name: 'Tjänster', emoji: '🤝' },
    beroring: { name: 'Fysisk beröring', emoji: '🫂' }
  };

  const RESULTS = {
    ord: {
      desc: 'Du känner dig som mest älskad när kärleken sätts i ord: uppskattning, uppmuntran och ärliga komplimanger. Ett "vad fint du gjorde det där" kan bära dig genom en hel vecka — medan hårda eller slarviga ord sårar dig djupare än de flesta anar.',
      tips: [
        'Säg uppskattningen högt — även för små saker, och gärna ofta.',
        'Skriv en lapp, ett sms eller några rader i ett kort — skrivna ord går att spara.',
        'Var konkret: "Jag älskar hur du fick alla att skratta ikväll" slår "du är bra".',
        'Var extra varsam i konflikter — sarkasm och hårda ord dröjer sig kvar länge.'
      ]
    },
    tid: {
      desc: 'Du känner dig som mest älskad när du får din partners odelade uppmärksamhet: riktiga samtal, gemensamma upplevelser, stunder utan skärmar. Närvaro är ditt kärleksbevis — och en frånvarande blick kan kännas som avvisande även när ni sitter i samma rum.',
      tips: [
        'Boka in regelbunden tid på tu man hand — och skydda den som ett viktigt möte.',
        'Lägg undan mobilen vid samtal och måltider. Odelad uppmärksamhet är själva poängen.',
        'Ställ följdfrågor och lyssna färdigt — det säger "du är viktig för mig".',
        'Små ritualer räknas: morgonkaffet ihop, kvällspromenaden, söndagsfrukosten.'
      ]
    },
    gavor: {
      desc: 'Du känner dig som mest älskad genom omtänksamma gåvor — inte för värdet, utan för vad de betyder: "jag tänkte på dig när vi inte var tillsammans." En blomma på vägen hem eller din favoritchoklad i väskan säger mer än tusen ord.',
      tips: [
        'Det är tanken som räknas: små, personliga gåvor slår dyra opersonliga.',
        'Notera saker partnern nämner i förbifarten — och överraska senare.',
        'Fira märkesdagar; glömda födelsedagar och årsdagar sårar extra mycket.',
        'En "gåva" kan också vara att spara något: en biljett, ett snäckskal, ett minne.'
      ]
    },
    tjanster: {
      desc: 'Du känner dig som mest älskad när kärlek omsätts i handling: när partnern lagar middagen, tar hand om det du gruvat dig för eller bara ser vad som behöver göras — utan att du behöver be. För dig är "låt mig hjälpa dig" den finaste kärleksförklaringen.',
      tips: [
        'Se vad som tynger — och gör det, utan att vänta på en önskelista.',
        'Följ upp det du lovat; brutna löften talar det här språket baklänges.',
        'Fråga: "Vad kan jag ta över den här veckan?" och mena det.',
        'Små handlingar i vardagen väger tyngre än stora engångsinsatser.'
      ]
    },
    beroring: {
      desc: 'Du känner dig som mest älskad genom fysisk närhet: en kram när du kommer hem, en hand att hålla, att sitta tätt intill i soffan. Beröring är ditt sätt att känna trygghet i relationen — och fysisk distans kan kännas som känslomässig distans.',
      tips: [
        'Vardagsberöring räknas mest: en kram, en klapp, en hand på axeln i förbifarten.',
        'Sitt nära — välj soffan ihop framför var sin fåtölj.',
        'Vid konflikt kan en varsam beröring (när den är välkommen) öppna det som ord låser.',
        'Fråga vad som känns bra — beröring har olika dialekter för olika personer.'
      ]
    }
  };

  // Varje fråga ställer två språk mot varandra — alla 10 kombinationer, var sin gång.
  const QUESTIONS = [
    { q: 'Efter en tuff dag önskar jag helst att min partner…', a: { key: 'ord', text: 'säger något uppmuntrande och påminner mig om vad jag är bra på' }, b: { key: 'tid', text: 'sätter sig ner med mig och verkligen lyssnar, utan mobil' } },
    { q: 'Det värmer mest när min partner…', a: { key: 'gavor', text: 'kommer hem med en liten överraskning, bara för att' }, b: { key: 'tjanster', text: 'har lagat middag och plockat undan innan jag hunnit be om det' } },
    { q: 'Jag känner mig närmast min partner när…', a: { key: 'beroring', text: 'vi ligger tätt intill varandra i soffan' }, b: { key: 'tid', text: 'vi pratar länge om allt möjligt, bara vi två' } },
    { q: 'Det som skulle såra mig mest är om min partner…', a: { key: 'ord', text: 'aldrig sa något uppskattande eller berömmande' }, b: { key: 'beroring', text: 'slutade kramas, hålla handen och söka närhet' } },
    { q: 'På min födelsedag betyder det mest att min partner…', a: { key: 'gavor', text: 'har valt en present som visar att hen verkligen känner mig' }, b: { key: 'ord', text: 'skriver ett kort med ord som kommer från hjärtat' } },
    { q: 'Kärlek i vardagen är för mig framför allt att…', a: { key: 'tjanster', text: 'vi avlastar varandra — att hen tankar bilen eller tar disken oombedd' }, b: { key: 'beroring', text: 'vi kramas, pussas och rör vid varandra i förbifarten' } },
    { q: 'Om min partner varit bortrest vill jag helst att hen…', a: { key: 'gavor', text: 'har med sig något litet som visar att hen tänkte på mig' }, b: { key: 'beroring', text: 'ger mig en riktigt lång kram i dörren' } },
    { q: 'Jag känner mig mest uppskattad när min partner…', a: { key: 'tjanster', text: 'ser vad som behöver göras och bara gör det' }, b: { key: 'ord', text: 'berättar för andra hur stolt hen är över mig' } },
    { q: 'En perfekt helgdag med min partner innehåller framför allt…', a: { key: 'tid', text: 'en lång gemensam aktivitet — utflykt, promenad eller bara prat' }, b: { key: 'gavor', text: 'att vi går runt i butiker och hittar små saker till varandra' } },
    { q: 'Det bästa sättet att stötta mig inför något svårt är att…', a: { key: 'tid', text: 'ta sig tid att sitta ner och gå igenom det med mig' }, b: { key: 'tjanster', text: 'praktiskt ta över annat så att jag kan fokusera' } }
  ];

  let idx = 0;
  let scores = {};

  function start() {
    idx = 0;
    scores = { ord: 0, tid: 0, gavor: 0, tjanster: 0, beroring: 0 };
    renderQuestion();
  }

  function renderQuestion() {
    const q = QUESTIONS[idx];
    const opts = Math.random() < 0.5 ? [q.a, q.b] : [q.b, q.a];
    root.innerHTML = `
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${(idx / QUESTIONS.length) * 100}%"></div></div>
      <div class="quiz-count">Fråga ${idx + 1} av ${QUESTIONS.length}</div>
      <div class="quiz-q">${q.q}</div>
      <div class="quiz-options">
        ${opts.map((o, i) => `<button class="quiz-option" data-key="${o.key}">${o.text}</button>`).join('')}
      </div>`;
    root.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        scores[btn.dataset.key]++;
        idx++;
        idx < QUESTIONS.length ? renderQuestion() : renderResult();
      });
    });
  }

  function renderResult() {
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const max = entries[0][1];
    const winners = entries.filter(([, v]) => v === max).map(([k]) => k);
    const total = QUESTIONS.length; // varje fråga ger 1 poäng

    const winnerNames = winners.map(k => `${LANGS[k].emoji} ${LANGS[k].name}`).join(' & ');

    root.innerHTML = `
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:100%"></div></div>
      <div class="quiz-count">Ditt resultat</div>
      <h3 style="font-size:1.5rem; font-family:var(--font-display);">Ditt kärleksspråk är:</h3>
      <div class="quiz-result-badge">${winnerNames}</div>
      ${winners.map(k => `<p style="font-size:0.97rem; margin-bottom:14px;">${RESULTS[k].desc}</p>`).join('')}

      <div class="result-bars">
        ${entries.map(([k, v]) => `
          <div class="result-bar-row${v === max ? ' top' : ''}">
            <span>${LANGS[k].emoji} ${LANGS[k].name}</span>
            <div class="result-bar-track"><div class="result-bar-fill" data-w="${Math.round((v / total) * 100)}"></div></div>
            <span class="pct">${Math.round((v / total) * 100)}%</span>
          </div>`).join('')}
      </div>

      ${winners.map(k => `
        <div class="quiz-tips">
          <h4>Så bemöter din partner ${LANGS[k].name.toLowerCase()} ${LANGS[k].emoji}</h4>
          <ul>${RESULTS[k].tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>`).join('')}

      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top: 28px;">
        <button class="btn btn-primary" id="againBtn">Låt din partner göra quizet 💛</button>
        <a href="boka.html" class="btn btn-secondary">Boka ett parsamtal</a>
      </div>
      <p style="font-size:0.82rem; color:var(--ink-faint); margin-top:16px;">Tips: jämför era resultat och berätta för varandra om en gång ni kände er riktigt älskade — vad hände då?</p>`;

    // Animera staplarna
    requestAnimationFrame(() => {
      setTimeout(() => {
        root.querySelectorAll('.result-bar-fill').forEach(el => { el.style.width = el.dataset.w + '%'; });
      }, 60);
    });

    document.getElementById('againBtn').addEventListener('click', start);
  }

  start();
})();
