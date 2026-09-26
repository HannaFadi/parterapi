// Shared behaviour: mobile nav + scroll reveal + active link marking

document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    if (!links.id) links.id = 'huvudmeny';
    toggle.setAttribute('aria-controls', links.id);

    const setOpen = open => {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Stäng menyn' : 'Meny');
    };
    setOpen(false);

    toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));

    // Escape stänger och lämnar tillbaka fokus till knappen
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Klick utanför menyn stänger den
    document.addEventListener('click', e => {
      if (!links.classList.contains('open')) return;
      if (!links.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });

    // Följ en länk = stäng menyn
    links.addEventListener('click', e => {
      if (e.target.closest('a')) setOpen(false);
    });
  }

  // Markera aktuell sida i menyn.
  // Sidorna serveras utan .html, men fungerar med ändelsen också, så
  // normalisera båda formerna innan de jämförs.
  const norm = p => p.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1') || '/';
  const here = norm(location.pathname);
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || /^(https?:|mailto:|tel:|#)/i.test(href)) return;
    if (norm(new URL(href, location.href).pathname) === here) {
      a.setAttribute('aria-current', 'page');
    }
  });

  // Scroll reveal
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }
});
