/* =====================================================================
   Luis Fernando Varas — Portfolio
   Language switch, loader, cursor, nav, reveals, counters, tilt,
   parallax, copy buttons. No dependencies.
   ===================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------- Language (Spanish by default) ---------------- */
  var DICT = window.I18N || {};
  var lang = 'es';

  function detectLang() {
    try {
      var q = new URLSearchParams(window.location.search).get('lang');
      if (q && DICT[q]) return q;
      var saved = window.localStorage.getItem('lfv-lang');
      if (saved && DICT[saved]) return saved;
    } catch (e) { /* storage unavailable */ }
    return 'es';
  }

  function t(key) {
    var d = DICT[lang] || {};
    return d[key] != null ? d[key] : (DICT.es && DICT.es[key]) || '';
  }

  function setLang(next, persist) {
    if (!DICT[next]) return;
    lang = next;
    var d = DICT[next];

    $$('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (d[k] != null) el.textContent = d[k];
    });

    document.documentElement.setAttribute('lang', next);
    if (d['meta.title']) document.title = d['meta.title'];
    var md = $('meta[name="description"]');
    if (md && d['meta.desc']) md.setAttribute('content', d['meta.desc']);
    var og = $('meta[property="og:title"]');
    if (og && d['meta.title']) og.setAttribute('content', d['meta.title']);

    $$('.lang-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === next));
    });
    var burger = $('#burger');
    if (burger && d['aria.menu']) burger.setAttribute('aria-label', d['aria.menu']);

    if (persist) {
      try { window.localStorage.setItem('lfv-lang', next); } catch (e) { /* ignore */ }
    }
  }

  setLang(detectLang(), false);
  $$('.lang-btn').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang'), true); });
  });

  /* ---------------- Loader ---------------- */
  var loader = $('#loader');
  var loaded = false;

  function finishLoad() {
    if (loaded) return;
    loaded = true;
    document.body.classList.add('is-loaded');
    if (loader) {
      loader.classList.add('done');
      window.setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 1000);
    }
  }

  if (loader && !reduceMotion) {
    var countEl = $('#loaderCount');
    var barEl = $('#loaderBar');
    var start = null;
    var duration = 1050;
    var tick = function (now) {
      if (start === null) start = now;
      var p = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      var n = Math.round(eased * 100);
      if (countEl) countEl.textContent = (n < 10 ? '00' : n < 100 ? '0' : '') + n;
      if (barEl) barEl.style.width = n + '%';
      if (p < 1) window.requestAnimationFrame(tick);
      else window.setTimeout(finishLoad, 160);
    };
    window.requestAnimationFrame(tick);
    window.setTimeout(finishLoad, 3000); /* safety net */
  } else {
    finishLoad();
  }

  /* ---------------- Custom cursor (desktop only) ---------------- */
  var cursor = $('#cursor');
  if (cursor && finePointer && !reduceMotion) {
    var dot = $('.cursor-dot', cursor);
    var ring = $('.cursor-ring', cursor);
    var mx = -100, my = -100, rx = -100, ry = -100;
    var hoverSel = 'a, button, .card, .chips span, .lang-btn, .tile, .job, .award, .cert';

    document.body.classList.add('has-cursor');
    cursor.classList.add('is-hidden');

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      cursor.classList.remove('is-hidden');
    }, { passive: true });
    document.addEventListener('mouseleave', function () { cursor.classList.add('is-hidden'); });
    window.addEventListener('mousedown', function () { cursor.classList.add('is-down'); });
    window.addEventListener('mouseup', function () { cursor.classList.remove('is-down'); });
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) cursor.classList.add('is-hover');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) cursor.classList.remove('is-hover');
    });

    var render = function () {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      window.requestAnimationFrame(render);
    };
    window.requestAnimationFrame(render);
  }

  /* ---------------- Nav state, hide-on-scroll, progress, arm parallax ---------------- */
  var nav = $('#nav');
  var progress = $('#progress');
  var arm = $('#arm');
  var lastY = 0;
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (nav) {
      nav.classList.toggle('is-scrolled', y > 24);
      var goingDown = y > lastY + 4;
      var goingUp = y < lastY - 4;
      if (y > 320 && goingDown && !document.body.classList.contains('menu-open')) nav.classList.add('is-hidden');
      else if (goingUp || y <= 320) nav.classList.remove('is-hidden');
    }
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    }
    if (arm && !reduceMotion && window.innerWidth > 900) {
      arm.style.setProperty('--py', (y * 0.18).toFixed(1) + 'px');
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* Active section link */
  var sections = $$('main section[id]');
  var navLinks = $$('.nav-links a');
  if ('IntersectionObserver' in window && sections.length && navLinks.length) {
    var activeIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = '#' + en.target.id;
        navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === id); });
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    sections.forEach(function (s) { activeIO.observe(s); });
  }

  /* ---------------- Mobile menu ---------------- */
  var burgerBtn = $('#burger');
  var menu = $('#mobileMenu');

  function setMenu(open) {
    if (!burgerBtn || !menu) return;
    burgerBtn.classList.toggle('is-open', open);
    burgerBtn.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('menu-open', open);
    if (open && nav) nav.classList.remove('is-hidden');
  }
  if (burgerBtn && menu) {
    burgerBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1100 && menu.classList.contains('is-open')) setMenu(false);
    });
  }

  /* ---------------- Reveal on scroll ---------------- */
  $$('.chips').forEach(function (group) {
    $$('span', group).forEach(function (chip, i) { chip.style.setProperty('--i', String(i)); });
  });

  var reveals = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealIO = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var parent = el.parentElement;
        var siblings = parent ? Array.prototype.filter.call(parent.children, function (c) { return c.classList.contains('reveal'); }) : [];
        var idx = siblings.indexOf(el);
        el.style.transitionDelay = (Math.max(0, Math.min(idx, 5)) * 90) + 'ms';
        el.classList.add('in');
        obs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(function (el) { revealIO.observe(el); });
  }

  /* ---------------- Counters ---------------- */
  var nums = $$('.num[data-count]');
  function formatNum(n, fmt) {
    var s = String(Math.round(n));
    if (fmt === 'comma') s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return s;
  }
  function runCounters() {
    nums.forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var fmt = el.getAttribute('data-format');
      var dur = 1400;
      var t0 = null;
      var step = function (now) {
        if (t0 === null) t0 = now;
        var p = Math.min(1, (now - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = formatNum(target * eased, fmt);
        if (p < 1) window.requestAnimationFrame(step);
        else el.textContent = formatNum(target, fmt);
      };
      window.requestAnimationFrame(step);
    });
  }
  var statsEl = $('#stats');
  if (statsEl && nums.length && !reduceMotion && 'IntersectionObserver' in window) {
    nums.forEach(function (el) { el.textContent = formatNum(0, el.getAttribute('data-format')); });
    var counted = false;
    var countIO = new IntersectionObserver(function (entries) {
      if (counted) return;
      if (entries.some(function (en) { return en.isIntersecting; })) {
        counted = true;
        runCounters();
        countIO.disconnect();
      }
    }, { threshold: 0.3 });
    countIO.observe(statsEl);
  }

  /* ---------------- Card tilt (desktop) ---------------- */
  if (finePointer && !reduceMotion) {
    $$('[data-tilt]').forEach(function (card) {
      var rect = null;
      card.addEventListener('mouseenter', function () {
        rect = card.getBoundingClientRect();
        card.classList.add('is-tilting');
      });
      card.addEventListener('mousemove', function (e) {
        if (!rect) rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        var ry = (px * 7).toFixed(2);
        var rx = (-py * 7).toFixed(2);
        card.style.transform = 'perspective(1100px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-4px)';
      });
      card.addEventListener('mouseleave', function () {
        card.classList.remove('is-tilting');
        card.style.transform = '';
        rect = null;
      });
    });
  }

  /* ---------------- Copy buttons + toast ---------------- */
  var toast = $('#toast');
  var toastTimer = null;

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-visible'); }, 1800);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  $$('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var value = btn.getAttribute('data-copy') || '';
      var done = function () {
        btn.classList.add('is-done');
        btn.textContent = t('contact.copied');
        showToast(t('contact.toast'));
        window.setTimeout(function () {
          btn.classList.remove('is-done');
          btn.textContent = t('contact.copy');
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, function () { fallbackCopy(value); done(); });
      } else {
        fallbackCopy(value);
        done();
      }
    });
  });

  /* ---------------- Footer year ---------------- */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
