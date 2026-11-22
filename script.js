/* DAANA — scroll storytelling site.
   Chapters: Origin -> Reveal -> In Motion (rotation scrub) -> The Burst
   -> The Pour (pour scrub) -> Collection -> Our Table -> DAANA.
   Both video sections scrub pre-rendered frame-sheets on a <canvas>
   (drawing a frame is instant, so scrubbing stays smooth on every
   connection — the same approach as the SPLASH site, which proved it).
   Works without JS/GSAP too: posters and stills stay visible. */

(function () {
  'use strict';

  /* ---------- Small helpers ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  /* Deterministic RNG so every render of the same progress is identical. */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) document.documentElement.classList.add('touch-scrub');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================================================================
     Global floating-lentil particles (fixed canvas, behind content).
     Slow drift everywhere; speeds up in the Release chapter; hidden
     on the Table photo so no CG sits on the real photograph.
     ================================================================ */
  var particleCanvas = document.getElementById('particleCanvas');
  var pctx = particleCanvas ? particleCanvas.getContext('2d') : null;
  var pW = 0, pH = 0, pDpr = 1;
  var particles = [];
  var particleBoost = 0, particleBoostTarget = 0;
  var LENTIL_COLORS = ['#e8702a', '#f08a3c', '#e9b949', '#c94f16', '#8fae4e'];

  function sizeParticles() {
    if (!particleCanvas) return;
    pDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    pW = window.innerWidth; pH = window.innerHeight;
    particleCanvas.width = Math.floor(pW * pDpr);
    particleCanvas.height = Math.floor(pH * pDpr);
  }
  sizeParticles();
  window.addEventListener('resize', sizeParticles);

  (function seedParticles() {
    var rand = mulberry32(11);
    for (var i = 0; i < 36; i++) {
      particles.push({
        x: rand(), y: rand(),
        r: 3 + rand() * 6,
        speed: 0.00012 + rand() * 0.00028,
        swayAmp: 8 + rand() * 22,
        swayFreq: 0.4 + rand() * 0.9,
        phase: rand() * Math.PI * 2,
        rot: rand() * Math.PI,
        spin: (rand() - 0.5) * 0.002,
        color: LENTIL_COLORS[Math.floor(rand() * LENTIL_COLORS.length)]
      });
    }
  })();

  var pTime = 0;
  function renderParticles() {
    if (!pctx) return;
    pTime += 1;
    particleBoost = lerp(particleBoost, particleBoostTarget, 0.04);
    pctx.setTransform(pDpr, 0, 0, pDpr, 0, 0);
    pctx.clearRect(0, 0, pW, pH);
    var boost = 1 + particleBoost * 3.2;
    for (var i = 0; i < particles.length; i++) {
      var q = particles[i];
      q.y -= q.speed * boost;
      q.rot += q.spin * boost;
      if (q.y < -0.03) { q.y = 1.03; q.x = Math.random(); }
      var x = q.x * pW + Math.sin(pTime * 0.008 * q.swayFreq + q.phase) * q.swayAmp;
      var y = q.y * pH;
      pctx.save();
      pctx.translate(x, y);
      pctx.rotate(q.rot);
      pctx.globalAlpha = 0.55;
      var g = pctx.createRadialGradient(-q.r * 0.3, -q.r * 0.3, q.r * 0.2, 0, 0, q.r);
      g.addColorStop(0, '#ffd9a0');
      g.addColorStop(0.45, q.color);
      g.addColorStop(1, '#7a2d08');
      pctx.fillStyle = g;
      pctx.beginPath();
      pctx.ellipse(0, 0, q.r, q.r * 0.58, 0, 0, Math.PI * 2);
      pctx.fill();
      pctx.restore();
    }
  }

  /* One rAF loop drives the particle canvas, in step with the display. */
  (function frameLoop() {
    renderParticles();
    requestAnimationFrame(frameLoop);
  })();


  /* ================================================================
     Scrub scenes (Turn + Pour) — canvas frame-sheets, the same engine
     as the SPLASH site. Each scene's ScrollTrigger only records the
     target progress; one rAF loop draws the matching frame.
     ================================================================ */
  var FRAMES_PER_SHEET = 60;
  var SHEET_COLS = 10;
  var FRAME_W = isTouch ? 480 : 960;
  var FRAME_H = isTouch ? 270 : 540;
  var SHEET_DIR = isTouch ? 'frames/' : 'frames-hd/';
  var SHEET_VERSION = 'v=1';
  var FRAME_COUNTS = { 'rotation': 100, 'pour': 100 };

  var scrubStates = [];
  document.querySelectorAll('.scene').forEach(function (scene) {
    var video = scene.querySelector('video');
    var canvas = scene.querySelector('canvas');
    if (!video || !canvas) return;
    var clipName = video.dataset.src.split('/').pop().replace('.mp4', '');
    if (!FRAME_COUNTS[clipName]) return;
    var ctx = canvas.getContext('2d');
    canvas.width = FRAME_W; canvas.height = FRAME_H;
    var sheets = [];
    var totalSheets = Math.ceil(FRAME_COUNTS[clipName] / FRAMES_PER_SHEET);
    var sheetLoader = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        sheetLoader.disconnect();
        for (var s = 0; s < totalSheets; s++) {
          (function (idx) {
            var img = new Image();
            img.onload = function () { sheets[idx] = img; };
            img.src = SHEET_DIR + clipName + '-' + (idx + 1) + '.jpg?' + SHEET_VERSION;
          })(s);
        }
      });
    }, { rootMargin: '200% 0px 200% 0px' });
    sheetLoader.observe(scene);

    var lastFrame = -1;
    var state = {
      progress: 0,
      update: function (progress) {
        var total = FRAME_COUNTS[clipName];
        var frame = Math.min(total - 1, Math.floor(progress * total));
        if (frame === lastFrame) return;
        var sheet = sheets[Math.floor(frame / FRAMES_PER_SHEET)];
        if (!sheet) return;
        var inSheet = frame % FRAMES_PER_SHEET;
        ctx.drawImage(sheet,
          (inSheet % SHEET_COLS) * FRAME_W,
          Math.floor(inSheet / SHEET_COLS) * FRAME_H,
          FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
        lastFrame = frame;
      }
    };
    scene._scrubState = state;
    scrubStates.push(state);
  });
  (function scrubLoop() {
    scrubStates.forEach(function (st) { st.update(st.progress); });
    requestAnimationFrame(scrubLoop);
  })();

  /* ================================================================
     Collection selector (plain JS, works with or without GSAP).
     ================================================================ */
  var PACKS = {
    masoor: {
      desc: 'A quick-cooking red lentil with a velvety finish, selected for everyday daal and slow Sunday lunches.',
      selection: 'Single-origin harvest', cook: '15 min'
    },
    moong: {
      desc: 'Light, golden and gentle — the everyday moong that cooks soft and clean, made for khichdi and light daals.',
      selection: 'Sun-dried, hand-sorted', cook: '20 min'
    },
    chana: {
      desc: 'Nutty and substantial, with a bite that holds. The chana dal for hearty lunches and slow-cooked favourites.',
      selection: 'Stone-ground, whole split', cook: '30 min'
    }
  };
  var packDesc = document.getElementById('packDesc');
  var packSelection = document.getElementById('packSelection');
  var packCook = document.getElementById('packCook');

  function selectPack(key) {
    if (!PACKS[key]) return;
    document.querySelectorAll('.pack-card').forEach(function (card) {
      var on = card.dataset.pack === key;
      card.classList.toggle('is-selected', on);
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('.pack-tab').forEach(function (tab) {
      tab.classList.toggle('is-active', tab.dataset.pack === key);
    });
    var card = document.querySelector('.pack-card[data-pack="' + key + '"]');
    if (card) card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    if (packDesc) {
      packDesc.classList.add('is-swapping');
      setTimeout(function () {
        packDesc.textContent = PACKS[key].desc;
        if (packSelection) packSelection.textContent = PACKS[key].selection;
        if (packCook) packCook.textContent = PACKS[key].cook;
        packDesc.classList.remove('is-swapping');
      }, 180);
    }
  }
  document.querySelectorAll('.pack-card, .pack-tab').forEach(function (el) {
    el.addEventListener('click', function () { selectPack(el.dataset.pack); });
  });
  document.querySelectorAll('[data-pack-link]').forEach(function (el) {
    el.addEventListener('click', function () { selectPack(el.dataset.packLink); });
  });

  /* If GSAP failed to load (or the user prefers reduced motion),
     leave the page as readable static content: posters show, copy
     stays visible. */
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || reducedMotion) {
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth scroll (Lenis), desktop only ---------- */
  var lenis = null;
  if (typeof Lenis !== 'undefined' && !isTouch) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* Anchor links scroll through Lenis when available. */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0 });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---------- Header state + top progress bar ---------- */
  var header = document.getElementById('siteHeader');
  var progressBar = document.getElementById('progressBar');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: function (self) {
      if (progressBar) progressBar.style.transform = 'scaleX(' + self.progress + ')';
      if (header) header.classList.toggle('scrolled', self.scroll() > 60);
    }
  });

  /* ---------- Hero entrance ---------- */
  gsap.from('.hero-copy > *', {
    y: 44, opacity: 0, duration: 1.1, stagger: 0.12,
    ease: 'power3.out', delay: 0.25, clearProps: 'all'
  });
  gsap.from('.scroll-cue', { opacity: 0, duration: 1, delay: 1.2 });

  /* ---------- Chapter indicator (clean fade swap — no mid-scroll
     glitch: the label only changes when a new chapter is active, and
     the text swaps while it is fully faded out.) ---------- */
  var chapterName = document.getElementById('chapterName');
  var chapterCount = document.getElementById('chapterCount');
  var currentChapter = '';
  function setChapter(name, index) {
    if (name === currentChapter) return;
    currentChapter = name;
    if (!chapterName) return;
    chapterName.classList.add('is-swapping');
    setTimeout(function () {
      chapterName.textContent = name;
      if (chapterCount) chapterCount.textContent = index + ' / 08';
      chapterName.classList.remove('is-swapping');
    }, 150);
    /* Particles stay off the real photograph. */
    if (particleCanvas) {
      particleCanvas.classList.toggle('is-hidden', name === 'Our Table');
    }
  }
  document.querySelectorAll('main section[data-chapter]').forEach(function (section) {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: function (self) {
        if (self.isActive) setChapter(section.dataset.chapter, section.dataset.index);
      }
    });
  });

  /* ---------- Reveal: pack rises in, copy rises in ---------- */
  (function () {
    var section = document.getElementById('reveal');
    if (!section) return;
    var pack = section.querySelector('.reveal-pack');
    var copy = section.querySelector('.reveal-copy');
    var tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true }
    });
    if (pack) {
      tl.fromTo(pack, { y: 140, opacity: 0, scale: 0.94 },
        { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }, 0);
      tl.to(pack, { y: -50, duration: 0.6, ease: 'none' }, 0.4);
    }
    if (copy) {
      tl.fromTo(copy, { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.05);
    }
  })();

  /* ---------- Scrub scenes: progress + settle + shade + copy ----------
     End is 'bottom bottom': each 300vh scene stays pinned fullscreen
     for exactly 200vh, so the clip plays its FULL duration while it
     is fullscreen, and only then does the next section arrive. */
  document.querySelectorAll('.scene').forEach(function (scene) {
    var state = scene._scrubState;
    ScrollTrigger.create({
      trigger: scene,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5,
      onUpdate: function (self) { if (state) state.progress = self.progress; }
    });
    var canvas = scene.querySelector('.scene-canvas');
    if (canvas) {
      gsap.fromTo(canvas, { scale: 1.12 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: scene, start: 'top top', end: 'bottom bottom', scrub: true }
      });
    }
    var shade = scene.querySelector('.scene-shade');
    if (shade) {
      gsap.fromTo(shade, { opacity: 0.5 }, {
        opacity: 0.1, ease: 'none',
        scrollTrigger: { trigger: scene, start: 'top top', end: 'bottom bottom', scrub: true }
      });
    }
    var copy = scene.querySelector('.scene-copy');
    if (copy) {
      var tl = gsap.timeline({
        scrollTrigger: { trigger: scene, start: 'top top', end: 'bottom bottom', scrub: true }
      });
      tl.fromTo(copy, { y: 70, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.10, ease: 'power2.out' }, 0.02);
      tl.to(copy, { y: -60, opacity: 0, duration: 0.10, ease: 'power2.in' }, 0.23);
      tl.to({}, { duration: 0.67 }, 0.33);
    }
  });

  /* ---------- Release: bowls parallax + particle burst ---------- */
  (function () {
    var section = document.getElementById('release');
    if (!section) return;
    var bowls = section.querySelector('.release-bowls');
    var copy = section.querySelector('.release-copy');
    if (bowls) {
      gsap.fromTo(bowls, { y: 60, opacity: 0 }, {
        y: -30, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }
    if (copy) {
      gsap.fromTo(copy, { y: 50, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: section, start: 'top 65%' }
      });
    }
    ScrollTrigger.create({
      trigger: section,
      start: 'top 70%',
      end: 'bottom 30%',
      onToggle: function (self) { particleBoostTarget = self.isActive ? 1 : 0; }
    });
  })();

  /* ---------- Pour note: appears late in the pour ---------- */
  (function () {
    var section = document.getElementById('pour');
    if (!section) return;
    var note = document.getElementById('pourNote');
    if (note) {
      gsap.to(note, {
        opacity: 1, ease: 'none',
        scrollTrigger: { trigger: section, start: '55% top', end: '75% top', scrub: true }
      });
    }
  })();

  /* ---------- Collection entrance ---------- */
  gsap.from('.collection-head > *', {
    y: 40, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power2.out',
    scrollTrigger: { trigger: '.collection', start: 'top 70%' }
  });
  gsap.from('.pack-card', {
    y: 50, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power2.out', clearProps: 'transform,opacity',
    scrollTrigger: { trigger: '.pack-row', start: 'top 80%' }
  });
  gsap.from('.pack-detail', {
    y: 30, opacity: 0, duration: 0.8, ease: 'power2.out',
    scrollTrigger: { trigger: '.pack-detail', start: 'top 88%' }
  });

  /* ---------- Table: photo parallax + copy entrance ---------- */
  gsap.fromTo('.table-bg', { yPercent: -8 }, {
    yPercent: 8, ease: 'none',
    scrollTrigger: { trigger: '.table-section', start: 'top bottom', end: 'bottom top', scrub: true }
  });
  gsap.from('.table-copy > *', {
    y: 40, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power2.out',
    scrollTrigger: { trigger: '.table-section', start: 'top 60%' }
  });

  /* ---------- CTA + footer entrance ---------- */
  gsap.from('.cta-copy > *', {
    y: 40, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power2.out',
    scrollTrigger: { trigger: '.cta', start: 'top 65%' }
  });
  gsap.from('.cta-pack', {
    y: 60, opacity: 0, duration: 1, ease: 'power2.out',
    scrollTrigger: { trigger: '.cta', start: 'top 65%' }
  });
  gsap.from('.footer-inner > *', {
    y: 30, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power2.out',
    scrollTrigger: { trigger: '.site-footer', start: 'top 85%' }
  });
})();
