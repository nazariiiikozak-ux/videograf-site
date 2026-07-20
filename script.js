// ===== year in footer =====
document.getElementById('year').textContent = new Date().getFullYear();

// ===== live clock in hero corner (Warsaw) =====
const heroClock = document.getElementById('heroClock');
if (heroClock) {
  const tick = () => {
    const now = new Date();
    const time = new Intl.DateTimeFormat('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Warsaw'
    }).format(now);
    heroClock.textContent = time;
  };
  tick();
  setInterval(tick, 1000 * 30);
}

// ===== burger menu =====
const burger = document.getElementById('burger');
const navMobile = document.getElementById('navMobile');
if (burger && navMobile) {
  burger.addEventListener('click', () => {
    const isOpen = navMobile.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(isOpen));
  });
  navMobile.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navMobile.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });
}

// ===== scroll reveal =====
const revealTargets = document.querySelectorAll(
  '.section__head, .reel__card, .about__media, .about__content, .services__row, .services__packages, .contact__title, .contact__email, .contact__form'
);
revealTargets.forEach(el => el.classList.add('reveal'));

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealTargets.forEach(el => io.observe(el));

// ===== drag-to-scroll for the reel =====
const track = document.getElementById('reelTrack');
if (track) {
  let isDown = false;
  let startX;
  let scrollLeft;

  track.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.pageX - track.offsetLeft;
    scrollLeft = track.scrollLeft;
  });
  track.addEventListener('mouseleave', () => { isDown = false; });
  track.addEventListener('mouseup', () => { isDown = false; });
  track.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - track.offsetLeft;
    const walk = (x - startX) * 1.2;
    track.scrollLeft = scrollLeft - walk;
  });
}

// ===== Play buttons (stub -- replace with a real player/embed) =====
document.querySelectorAll('.reel__play').forEach(btn => {
  btn.addEventListener('click', () => {
    alert('\u0422\u0443\u0442 \u0431\u0443\u0434\u0435 \u0432\u0456\u0434\u0442\u0432\u043e\u0440\u0435\u043d\u043d\u044f \u0432\u0456\u0434\u0435\u043e. \u0417\u0430\u043c\u0456\u043d\u0438 \u0446\u044e \u0434\u0456\u044e \u043d\u0430 \u0441\u0432\u0456\u0439 embed (YouTube/Vimeo iframe) \u0430\u0431\u043e <video> \u0443 reel__frame.');
  });
});

document.querySelectorAll('.reel__expand').forEach(btn => {
  btn.addEventListener('click', () => {
    alert('\u0422\u0443\u0442 \u043c\u043e\u0436\u043d\u0430 \u0432\u0456\u0434\u043a\u0440\u0438\u0442\u0438 \u043f\u043e\u0432\u043d\u0438\u0439 \u043a\u0435\u0439\u0441 \u043f\u0440\u043e\u0454\u043a\u0442\u0443 (\u043e\u043a\u0440\u0435\u043c\u0443 \u0441\u0442\u043e\u0440\u0456\u043d\u043a\u0443 \u0430\u0431\u043e \u043c\u043e\u0434\u0430\u043b\u044c\u043d\u0435 \u0432\u0456\u043a\u043d\u043e).');
  });
});

// ===== contact form -> /api/submit -> Telegram =====
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const statusEl = document.getElementById('formStatus');
  const submitBtn = contactForm.querySelector('.form__submit');

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(contactForm).entries());

    if (!data.name || !data.contact) {
      statusEl.textContent = "\u0417\u0430\u043f\u043e\u0432\u043d\u0438 \u0456\u043c'\u044f \u0442\u0430 \u043a\u043e\u043d\u0442\u0430\u043a\u0442 \u0434\u043b\u044f \u0437\u0432'\u044f\u0437\u043a\u0443.";
      statusEl.classList.remove('is-success');
      statusEl.classList.add('is-error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    statusEl.textContent = '';
    statusEl.classList.remove('is-error', 'is-success');

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      let result = {};
      try { result = await res.json(); } catch (_) {}

      if (!res.ok || !result.ok) {
        throw new Error(result.error || '\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0432\u0456\u0434\u043f\u0440\u0430\u0432\u043a\u0438');
      }

      contactForm.reset();
      statusEl.textContent = '\u0414\u044f\u043a\u0443\u044e! \u0417\u0430\u044f\u0432\u043a\u0443 \u043d\u0430\u0434\u0456\u0441\u043b\u0430\u043d\u043e \u2014 \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u043c \u043d\u0430\u0439\u0431\u043b\u0438\u0436\u0447\u0438\u043c \u0447\u0430\u0441\u043e\u043c.';
      statusEl.classList.add('is-success');
    } catch (err) {
      statusEl.textContent = '\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0434\u0456\u0441\u043b\u0430\u0442\u0438 \u0437\u0430\u044f\u0432\u043a\u0443. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0449\u0435 \u0440\u0430\u0437 \u0430\u0431\u043e \u043d\u0430\u043f\u0438\u0448\u0438 \u043d\u0430 \u043f\u043e\u0448\u0442\u0443 \u043d\u0438\u0436\u0447\u0435.';
      statusEl.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
    }
  });
}
