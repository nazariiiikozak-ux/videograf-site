// ===== preloader (intro) =====
(function () {
  const pre = document.getElementById('preloader');
  const clearLoading = () => document.body.classList.remove('is-loading');
  if (!pre) { clearLoading(); return; }
  const bar = document.getElementById('preloaderBar');
  const countEl = document.getElementById('preloaderCount');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let done = false;
  function finish() {
    if (done) return;
    done = true;
    pre.classList.add('is-done');
    clearLoading();
    setTimeout(() => { pre.style.display = 'none'; }, 1100);
  }

  if (reduce) { finish(); return; }

  let progress = 0;
  let loaded = false;
  const start = performance.now();
  const MIN_MS = 1400;
  window.addEventListener('load', () => { loaded = true; });

  function tick(now) {
    if (done) return;
    const elapsed = now - start;
    const target = loaded ? 100 : Math.min(90, (elapsed / MIN_MS) * 100);
    progress += (target - progress) * 0.08;
    const shown = Math.min(100, Math.round(progress));
    if (bar) bar.style.width = shown + '%';
    if (countEl) countEl.textContent = shown;
    if (shown >= 100 && loaded && elapsed >= MIN_MS) {
      if (bar) bar.style.width = '100%';
      if (countEl) countEl.textContent = 100;
      setTimeout(finish, 250);
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  setTimeout(finish, 6000); // safety: never hang
})();

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
  const timesHintEl = document.getElementById('bookingTimesHint');
  const chosenEl = document.getElementById('bookingChosen');
  const warnEl = document.getElementById('bookingWarn');
  const dateInput = document.getElementById('bookDate');
  const timesInput = document.getElementById('bookTimes');

  let slots = {};      // { iso: [ {t, b}, ... ] }
  let selected = [];   // chosen times (contiguous, free)
  let anchor = null;   // first tap of a range

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
      timesHintEl.hidden = true;
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

  function dayList() {
    return slots[dateInput.value] || [];
  }

  function renderTimes(iso) {
    const list = slots[iso] || [];
    timesEl.innerHTML = list
      .map((s) =>
        s.b
          ? '<span class="booking__time booking__time--taken" aria-disabled="true">' + s.t + '<i>\u0437\u0430\u0439\u043d\u044f\u0442\u043e</i></span>'
          : '<button type="button" class="booking__time" data-time="' + s.t + '">' + s.t + '</button>'
      )
      .join('');
    timesEl.hidden = false;
    timesHintEl.hidden = false;
  }

  function paintSelection() {
    timesEl.querySelectorAll('.booking__time').forEach((el) => {
      const t = el.dataset ? el.dataset.time : null;
      el.classList.toggle('is-active', !!t && selected.includes(t));
    });
    timesInput.value = selected.join(',');
    if (!selected.length) { chosenEl.hidden = true; return; }
    const [y, m, d] = dateInput.value.split('-');
    const label = selected.length === 1
      ? selected[0]
      : selected[0] + '\u2013' + selected[selected.length - 1] + ' \u00b7 ' + selected.length + ' \u0433\u043e\u0434';
    chosenEl.textContent = '\u041e\u0431\u0440\u0430\u043d\u043e: ' + d + '.' + m + '.' + y + ', ' + label;
    chosenEl.hidden = false;
  }

  function warn(msg) {
    if (!msg) { warnEl.hidden = true; return; }
    warnEl.textContent = msg;
    warnEl.hidden = false;
  }

  datesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.booking__date');
    if (!btn) return;
    datesEl.querySelectorAll('.booking__date').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    dateInput.value = btn.dataset.date;
    selected = [];
    anchor = null;
    warn('');
    renderTimes(btn.dataset.date);
    paintSelection();
  });

  timesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.booking__time');
    if (!btn || !btn.dataset || !btn.dataset.time) return; // ignore taken slots
    const t = btn.dataset.time;
    const list = dayList();
    const idx = (x) => list.findIndex((s) => s.t === x);
    warn('');

    // second tap: form a contiguous range from the anchor
    if (anchor !== null && selected.length === 1) {
      const i = idx(anchor), j = idx(t);
      if (i === -1 || j === -1) { anchor = t; selected = [t]; paintSelection(); return; }
      if (i === j) { selected = []; anchor = null; paintSelection(); return; } // re-tap = clear
      const lo = Math.min(i, j), hi = Math.max(i, j);
      const range = list.slice(lo, hi + 1);
      if (range.some((s) => s.b)) {
        anchor = t; selected = [t]; paintSelection();
        warn('\u041c\u0456\u0436 \u043d\u0438\u043c\u0438 \u0454 \u0437\u0430\u0439\u043d\u044f\u0442\u0430 \u0433\u043e\u0434\u0438\u043d\u0430 \u2014 \u043e\u0431\u0435\u0440\u0456\u0442\u044c \u0441\u0443\u0446\u0456\u043b\u044c\u043d\u0438\u0439 \u043f\u0440\u043e\u043c\u0456\u0436\u043e\u043a.');
        return;
      }
      selected = range.map((s) => s.t);
      anchor = null; // range done; next tap starts fresh
      paintSelection();
      return;
    }

    // first tap (or restart); re-tapping the single choice clears it
    if (selected.length === 1 && selected[0] === t) { selected = []; anchor = null; paintSelection(); return; }
    anchor = t;
    selected = [t];
    paintSelection();
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
    if (!data.date || !data.times) {
      statusEl.textContent = '\u041e\u0431\u0435\u0440\u0438 \u0432\u0456\u043b\u044c\u043d\u0443 \u0434\u0430\u0442\u0443 \u0439 \u0445\u043e\u0447\u0430 \u0431 \u043e\u0434\u043d\u0443 \u0433\u043e\u0434\u0438\u043d\u0443.';
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
        statusEl.textContent = result.error || '\u041e\u0434\u043d\u0443 \u0437 \u0433\u043e\u0434\u0438\u043d \u0449\u043e\u0439\u043d\u043e \u0437\u0430\u0439\u043d\u044f\u043b\u0438 \u2014 \u043e\u0431\u0435\u0440\u0438 \u0437\u043d\u043e\u0432\u0443.';
        statusEl.classList.add('is-error');
        selected = [];
        anchor = null;
        const keepDate = dateInput.value;
        await loadSlots();
        if (keepDate && slots[keepDate]) {
          const db = datesEl.querySelector('.booking__date[data-date="' + keepDate + '"]');
          if (db) db.classList.add('is-active');
          dateInput.value = keepDate;
          renderTimes(keepDate);
        }
        paintSelection();
        return;
      }
      if (!res.ok || !result.ok) {
        throw new Error(result.error || '\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0431\u0440\u043e\u043d\u044e\u0432\u0430\u043d\u043d\u044f');
      }

      contactForm.reset();
      dateInput.value = '';
      timesInput.value = '';
      selected = [];
      anchor = null;
      chosenEl.hidden = true;
      warn('');
      timesEl.hidden = true;
      timesHintEl.hidden = true;
      datesEl.querySelectorAll('.booking__date').forEach((b) => b.classList.remove('is-active'));
      statusEl.textContent = '\u0413\u043e\u0442\u043e\u0432\u043e! \u0427\u0430\u0441 \u0437\u0430\u0431\u0440\u043e\u043d\u044c\u043e\u0432\u0430\u043d\u043e \u2014 \u0437\u0432\u02bc\u044f\u0436\u0443\u0441\u044c \u0434\u043b\u044f \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f.';
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
