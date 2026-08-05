// NVC-quiz: 8 vardagsscenarier. Varje svar ger 0–2 poäng
// (2 = giraffspråk, 1 = på god väg, 0 = vargspråk).

(function () {
  const root = document.getElementById('quizNvc');
  if (!root) return;

  const QUESTIONS = [
    {
      q: 'Din partner kommer hem en timme senare än utlovat — utan att höra av sig. Vad ligger närmast till hands?',
      opts: [
        { p: 0, text: '"Typiskt dig. Du tänker aldrig på någon annan än dig själv."' },
        { p: 2, text: '"När jag inte hörde något blev jag orolig. Jag behöver veta att du är okej — kan du skicka ett sms nästa gång det drar ut på tiden?"' },
        { p: 1, text: 'Säger inget just då, men är märkbart kort i tonen resten av kvällen.' }
      ]
    },
    {
      q: 'Ni är på middag hos vänner och din partner avbryter dig mitt i en historia. Efteråt i bilen…',
      opts: [
        { p: 1, text: '"Märkte du att du avbröt mig där? Det var lite jobbigt faktiskt." — och så byter du snabbt ämne.' },
        { p: 0, text: '"Du ska jämt höras mest. Det är pinsamt att gå på middag med dig."' },
        { p: 2, text: '"När jag blev avbruten i historien kände jag mig osynlig. Det är viktigt för mig att vi lyfter varandra när vi är ute — kan vi hjälpas åt med det?"' }
      ]
    },
    {
      q: 'Disken står kvar — igen — trots att ni delat upp sysslorna. Du säger…',
      opts: [
        { p: 2, text: '"Jag ser att disken från igår står kvar. Jag blir frustrerad, för jag behöver känna att vi delar på hemmet. Kan vi ta den ikväll tillsammans?"' },
        { p: 1, text: '"Ska jag ta disken då, eller?" — med en suck.' },
        { p: 0, text: '"Du gör aldrig något här hemma. Jag är tydligen den enda vuxna i det här huset."' }
      ]
    },
    {
      q: 'Din partner verkar nedstämd och svarar enstavigt. Du…',
      opts: [
        { p: 0, text: '"Ska du vara sur nu igen? Det går ju inte att prata med dig."' },
        { p: 1, text: 'Lämnar hen ifred och hoppas att det går över av sig självt.' },
        { p: 2, text: '"Du verkar tyngd ikväll. Vill du berätta, eller behöver du vara ifred en stund? Jag finns här."' }
      ]
    },
    {
      q: 'Ni bråkar om ekonomin. Din partner säger "du slösar jämt". Ditt svar?',
      opts: [
        { p: 1, text: '"Det där var orättvist. Jag köper faktiskt nästan aldrig något till mig själv."' },
        { p: 2, text: '"Jag hör att du är orolig för pengarna. Det är jag också ibland. Kan vi sätta oss i helgen och göra en plan vi båda känner oss trygga med?"' },
        { p: 0, text: '"Jaha, och du då? Ska vi prata om vad dina prylar kostat i år?"' }
      ]
    },
    {
      q: 'Du har haft en tung vecka och känner dig osedd. Hur tar du upp det?',
      opts: [
        { p: 2, text: '"Den här veckan har varit tung för mig, och jag har saknat oss. Jag behöver lite närhet — kan vi ta en kväll bara vi två?"' },
        { p: 0, text: 'Säger inget men svarar kyligt tills partnern frågar vad det är — "inget", svarar du.' },
        { p: 1, text: '"Du har inte direkt varit närvarande den här veckan, va?"' }
      ]
    },
    {
      q: 'Din partner glömde er gemensamma middagsplan och bokade in annat. Du säger…',
      opts: [
        { p: 0, text: '"Klart att dina vänner går först. Det gör de ju alltid."' },
        { p: 2, text: '"Jag hade sett fram emot vår kväll och blev besviken. Våra stunder betyder mycket för mig — kan vi hitta en ny kväll nu direkt, så den blir av?"' },
        { p: 1, text: '"Okej. Kul för dig." — och så bokar du in något eget samma kväll.' }
      ]
    },
    {
      q: 'Mitt i ett gräl märker du att tonläget stigit och att ni sårar varandra. Vad gör du?',
      opts: [
        { p: 1, text: 'Fortsätter tills det är "färdigpratat" — man ska inte gå till sängs osams.' },
        { p: 0, text: 'Avslutar med en sista svidande kommentar och lämnar rummet.' },
        { p: 2, text: '"Jag märker att vi båda är för upprörda för att höra varandra nu. Kan vi ta en paus och försöka igen om en timme? Jag vill förstå dig, inte vinna."' }
      ]
    }
  ];

  const MAXP = QUESTIONS.length * 2;

  const BANDS = [
    {
      min: 0.75, emoji: '🦒', title: 'Giraff med god överblick',
      desc: 'Du uttrycker dig till stor del i observationer, känslor, behov och önskningar — även när det hettar till. Det är en ovanlig och värdefull färdighet som skapar trygghet i relationen.',
      tips: [
        'Vässa lyssnandet: gissa högt vad din partner känner och behöver ("är du orolig för att…?").',
        'Hjälp samtalet när partnern talar vargspråk — hör behovet bakom orden i stället för att rätta.',
        'Håll i vanan under stress och trötthet — det är där även girafferna tappar halsen.'
      ]
    },
    {
      min: 0.45, emoji: '🦒🐺', title: 'Giraff i vardagen — varg i stormen',
      desc: 'Du kan språket och använder det ofta — men i stundens hetta smyger sig anklagelser, gliringar eller tystnad in. Helt normalt: det är precis där de flesta av oss halkar.',
      tips: [
        'Träna på pausen: när pulsen stiger, andas och fråga dig "vad känner jag — och vad behöver jag egentligen?"',
        'Byt "du gör alltid…" mot "när X hände kände jag Y" — bara det förändrar tonen i ett helt gräl.',
        'Reparera efteråt: att säga "förlåt, jag menade inte att såra — det jag ville säga var…" är också giraffspråk.'
      ]
    },
    {
      min: 0, emoji: '🐺', title: 'Vargen får ofta ordet',
      desc: 'När du är sårad eller frustrerad tar anklagelser, sarkasm eller tystnad ofta över. Det betyder inte att du bryr dig mindre — tvärtom, vargen ylar högst när något viktigt står på spel. Men budskapet når sällan fram i den formen.',
      tips: [
        'Börja smått: en gång om dagen, säg en mening som börjar med "jag känner…" i stället för "du…".',
        'Skriv ner det du vill säga innan svåra samtal — sortera i observation, känsla, behov, önskan.',
        'Var nyfiken på vargen: vilket behov skyddar den? Ofta är svaret "jag vill känna mig viktig för dig".',
        'Ge det tid — kommunikationsmönster har byggts under år och ändras i små steg. Stöd finns om ni vill träna ihop.'
      ]
    }
  ];

  let idx = 0, score = 0;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function start() {
    idx = 0;
    score = 0;
    renderQuestion();
  }

  function renderQuestion() {
    const q = QUESTIONS[idx];
    root.innerHTML = `
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${(idx / QUESTIONS.length) * 100}%"></div></div>
      <div class="quiz-count">Situation ${idx + 1} av ${QUESTIONS.length}</div>
      <div class="quiz-q">${q.q}</div>
      <div class="quiz-options">
        ${shuffle(q.opts).map(o => `<button class="quiz-option" data-p="${o.p}">${o.text}</button>`).join('')}
      </div>`;
    root.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        score += Number(btn.dataset.p);
        idx++;
        idx < QUESTIONS.length ? renderQuestion() : renderResult();
      });
    });
  }

  function renderResult() {
    const ratio = score / MAXP;
    const band = BANDS.find(b => ratio >= b.min);
    const pct = Math.round(ratio * 100);

    root.innerHTML = `
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:100%"></div></div>
      <div class="quiz-count">Ditt resultat · ${score} av ${MAXP} poäng</div>
      <h3 style="font-size:1.5rem; font-family:var(--font-display);">${band.emoji} ${band.title}</h3>
      <div class="result-bars" style="margin-top:18px;">
        <div class="result-bar-row top">
          <span>Giraffnivå</span>
          <div class="result-bar-track"><div class="result-bar-fill" data-w="${pct}"></div></div>
          <span class="pct">${pct}%</span>
        </div>
      </div>
      <p style="font-size:0.97rem;">${band.desc}</p>
      <div class="quiz-tips">
        <h4>Dina nästa steg</h4>
        <ul>${band.tips.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top: 28px;">
        <button class="btn btn-primary" id="againBtn">Gör om quizet</button>
        <a href="boka.html" class="btn btn-secondary">Träna tillsammans — boka samtal</a>
      </div>
      <p style="font-size:0.82rem; color:var(--ink-faint); margin-top:16px;">Tips: låt din partner göra quizet också — och jämför vilka situationer ni svarade olika på.</p>`;

    requestAnimationFrame(() => {
      setTimeout(() => {
        root.querySelectorAll('.result-bar-fill').forEach(el => { el.style.width = el.dataset.w + '%'; });
      }, 60);
    });

    document.getElementById('againBtn').addEventListener('click', start);
  }

  start();
})();
