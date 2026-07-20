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

// ===== booking calendar -> /api/slots + /api/book -> Telegram =====
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const statusEl = document.getElementById('formStatus');
  const submitBtn = contactForm.querySelector('.form__submit');
  const datesEl = document.getElementById('bookingDates');
  const timesEl = document.getElementById('bookingTimes');
  const chosenEl = document.getElementById('bookingChosen');
  const dateInput = document.getElementById('bookDate');
  const timeInput = document.getElementById('bookTime');

  let slots = {};

  const WEEKDAYS = ['\u041d\u0434', '\u041f\u043d', '\u0412\u0442', '\u0421\u0440', '\u0427\u0442', '\u041f\u0442', '\u0421\u0431'];
  const MONTHS = ['\u0441\u0456\u0447', '\u043b\u044e\u0442', '\u0431\u0435\u0440', '\u043a\u0432\u0456', '\u0442\u0440\u0430', '\u0447\u0435\u0440', '\u043b\u0438\u043f', '\u0441\u0435\u0440', '\u0432\u0435\u0440', '\u0436\u043e\u0432', '\u043b\u0438\u0441', '\u0433\u0440\u0443'];

  function fmtDateLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return { wd: WEEKDAYS[wd], day: d, mon: MONTHS[m - 1] };
  }

  async function loadSlots() {
    try {
      const res = await fetch('/api/slots');
      const data = await res.json();
      slots = data && data.ok && data.slots ? data.slots : {};
    } catch (_) {
      slots = {};
    }
    renderDates();
  }

  function renderDates() {
    const dates = Object.keys(slots).sort();
    if (!dates.length) {
      datesEl.innerHTML =
        '<p class="booking__hint">\u041d\u0430\u0440\u0430\u0437\u0456 \u0432\u0456\u043b\u044c\u043d\u0438\u0445 \u0434\u0430\u0442 \u043d\u0435\u043c\u0430\u0454 \u2014 \u043d\u0430\u043f\u0438\u0448\u0438 \u043d\u0430 \u043f\u043e\u0448\u0442\u0443 \u043d\u0438\u0436\u0447\u0435, \u0456 \u043c\u0438 \u0443\u0437\u0433\u043e\u0434\u0438\u043c\u043e \u0447\u0430\u0441.</p>';
      timesEl.hidden = true;
      return;
    }
    datesEl.innerHTML = dates
      .map((iso) => {
        const l = fmtDateLabel(iso);
        return (
          '<button type="button" class="booking__date" data-date="' + iso + '">' +
          '<span class="booking__date-wd">' + l.wd + '</span>' +
          '<span class="booking__date-day">' + l.day + '</span>' +
          '<span class="booking__date-mon">' + l.mon + '</span>' +
          '</button>'
        );
      })
      .join('');
  }

  function renderTimes(iso) {
    const times = (slots[iso] || []).slice().sort();
    timesEl.innerHTML = times
      .map((t) => '<button type="button" class="booking__time" data-time="' + t + '">' + t + '</button>')
      .join('');
    timesEl.hidden = false;
  }

  datesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.booking__date');
    if (!btn) return;
    datesEl.querySelectorAll('.booking__date').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    dateInput.value = btn.dataset.date;
    timeInput.value = '';
    chosenEl.hidden = true;
    renderTimes(btn.dataset.date);
  });

  timesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.booking__time');
    if (!btn) return;
    timesEl.querySelectorAll('.booking__time').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    timeInput.value = btn.dataset.time;
    const [y, m, d] = dateInput.value.split('-');
    chosenEl.textContent = '\u041e\u0431\u0440\u0430\u043d\u043e: ' + d + '.' + m + '.' + y + ' \u043e ' + btn.dataset.time;
    chosenEl.hidden = false;
  });

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';
    statusEl.classList.remove('is-error', 'is-success');

    const data = Object.fromEntries(new FormData(contactForm).entries());

    if (!data.name || !data.contact) {
      statusEl.textContent = "\u0417\u0430\u043f\u043e\u0432\u043d\u0438 \u0456\u043c'\u044f \u0442\u0430 \u043a\u043e\u043d\u0442\u0430\u043a\u0442 \u0434\u043b\u044f \u0437\u0432'\u044f\u0437\u043a\u0443.";
      statusEl.classList.add('is-error');
      return;
    }
    if (!data.date || !data.time) {
      statusEl.textContent = '\u041e\u0431\u0435\u0440\u0438 \u0432\u0456\u043b\u044c\u043d\u0443 \u0434\u0430\u0442\u0443 \u0439 \u0447\u0430\u0441 \u0437\u0439\u043e\u043c\u043a\u0438.';
      statusEl.classList.add('is-error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      let result = {};
      try { result = await res.json(); } catch (_) {}

      if (res.status === 409) {
        statusEl.textContent = result.error || '\u0426\u0435\u0439 \u0441\u043b\u043e\u0442 \u0449\u043e\u0439\u043d\u043e \u0437\u0430\u0439\u043d\u044f\u043b\u0438 \u2014 \u043e\u0431\u0435\u0440\u0438 \u0456\u043d\u0448\u0438\u0439.';
        statusEl.classList.add('is-error');
        timeInput.value = '';
        chosenEl.hidden = true;
        await loadSlots();
        return;
      }
      if (!res.ok || !result.ok) {
        throw new Error(result.error || '\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0431\u0440\u043e\u043d\u044e\u0432\u0430\u043d\u043d\u044f');
      }

      contactForm.reset();
      dateInput.value = '';
      timeInput.value = '';
      chosenEl.hidden = true;
      timesEl.hidden = true;
      statusEl.textContent = '\u0413\u043e\u0442\u043e\u0432\u043e! \u0421\u043b\u043e\u0442 \u0437\u0430\u0431\u0440\u043e\u043d\u044c\u043e\u0432\u0430\u043d\u043e \u2014 \u0437\u0432\u02bc\u044f\u0436\u0443\u0441\u044c \u0434\u043b\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f.';
      statusEl.classList.add('is-success');
      await loadSlots();
    } catch (err) {
      statusEl.textContent = '\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0431\u0440\u043e\u043d\u044e\u0432\u0430\u0442\u0438. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0449\u0435 \u0440\u0430\u0437 \u0430\u0431\u043e \u043d\u0430\u043f\u0438\u0448\u0438 \u043d\u0430 \u043f\u043e\u0448\u0442\u0443 \u043d\u0438\u0436\u0447\u0435.';
      statusEl.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
    }
  });

  loadSlots();
}
