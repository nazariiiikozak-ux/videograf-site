// ===== рік у футері =====
document.getElementById('year').textContent = new Date().getFullYear();

// ===== живий годинник у куті героя (Варшава) =====
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

// ===== бургер-меню =====
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
  '.section__head, .reel__card, .about__media, .about__content, .services__row, .services__packages, .contact__title, .contact__email'
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

// ===== drag-to-scroll для реела =====
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

// ===== кнопки Play (заглушка — заміни на реальний плеєр/embed) =====
document.querySelectorAll('.reel__play').forEach(btn => {
  btn.addEventListener('click', () => {
    alert('Тут буде відтворення відео. Заміни цю дію на свій embed (YouTube/Vimeo iframe) або <video> у reel__frame.');
  });
});

document.querySelectorAll('.reel__expand').forEach(btn => {
  btn.addEventListener('click', () => {
    alert('Тут можна відкрити повний кейс проєкту (окрему сторінку або модальне вікно).');
  });
});
