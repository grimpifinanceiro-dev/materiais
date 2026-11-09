/* Deterministic stage: one paused GSAP timeline, seeked by frame number.
   URL params: fmt=h|v, offset=<global frame of local frame 0>, dur=<shot length in frames> */
(function () {
  const q = new URLSearchParams(location.search);
  const fmt = q.get('fmt') === 'v' ? 'v' : 'h';
  const offset = +(q.get('offset') || 0);
  const dur = +(q.get('dur') || 120);
  const W = fmt === 'v' ? 1080 : 1920, H = fmt === 'v' ? 1920 : 1080;
  const FPS = 60, f = n => n / FPS;
  document.documentElement.classList.add('fmt-' + fmt);

  gsap.ticker.lagSmoothing(0);
  gsap.ticker.sleep();                      // nothing advances unless we seek
  const tl = gsap.timeline({ paused: true });

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Split every .line into word spans; words listed in data-accent get the cyan class.
  function split(root) {
    root.querySelectorAll('.line').forEach(el => {
      if (el.dataset.split) return;
      const acc = (el.dataset.accent || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
      const words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      words.forEach((w, i) => {
        if (w === '|') { const br = document.createElement('br'); br.className = 'bv'; el.appendChild(br); return; }
        const s = document.createElement('span');
        s.className = 'w'; s.textContent = w;
        const key = w.toLowerCase().replace(/[.,!?:;]/g, '');
        if (acc.includes(key)) s.classList.add('accent');
        el.appendChild(s);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      });
      el.dataset.split = '1';
    });
  }

  // Word-by-word entrance: expo.out, 4-frame stagger.
  function words(el, at, o = {}) {
    const ws = (typeof el === 'string' ? document.querySelector(el) : el).querySelectorAll('.w');
    tl.fromTo(ws, { y: o.y ?? 40, opacity: 0, filter: 'blur(8px)' },
      { y: 0, opacity: 1, filter: 'blur(0px)', duration: f(o.dur ?? 24), ease: 'expo.out', stagger: f(o.stagger ?? 4) }, f(at));
    return ws;
  }
  function exit(targets, at, o = {}) {
    tl.to(targets, { opacity: 0, y: o.y ?? -30, filter: 'blur(6px)', duration: f(o.dur ?? 14), ease: 'expo.in' }, f(at));
  }

  // Background (driven by global frame so cuts don't jump)
  const stage = document.getElementById('stage');
  const bg = document.createElement('div'); bg.id = 'bg';
  bg.innerHTML = '<div class="grid"></div><div class="glow"></div><div class="vignette"></div>';
  stage.prepend(bg);
  const wipe = document.createElement('div'); wipe.id = 'wipe'; stage.appendChild(wipe);
  const grid = bg.querySelector('.grid'), glow = bg.querySelector('.glow');
  function drawBg(g) {
    const s = Math.sin, c = Math.cos, T = 2 * Math.PI;
    grid.style.transform = `translate(${10 * s(T * g / 700)}px, ${14 * s(T * g / 600)}px)`;
    glow.style.left = (W * (0.5 + 0.16 * s(T * g / 900))) + 'px';
    glow.style.top = (H * (0.46 + 0.10 * c(T * g / 1200))) + 'px';
  }
  if (offset > 0 && !document.body.hasAttribute('data-nowipe')) {   // cut accent: thin cyan line flash at every shot start
    tl.fromTo(wipe, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: f(10), ease: 'expo.out' }, 0)
      .to(wipe, { opacity: 0, duration: f(10), ease: 'power2.out' }, f(8));
  }

  // Slow push-in so long holds never freeze (power2.inOut, whole shot)
  function push(sel, from, to, at, len) {
    tl.fromTo(sel, { scale: from }, { scale: to, duration: f(len), ease: 'power2.inOut' }, f(at));
  }
  async function build(fn) {
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
    split(document);
    await fn({ tl, f, words, exit, push, fmt, W, H, dur, offset, rng: mulberry32 });
    window.renderFrame(0);
    window.__ready = true;
  }

  window.renderFrame = function (local) {
    tl.seek(f(local), false);
    drawBg(offset + local);
    return true;
  };

  // Layout check: visible text lines must sit inside the safe area and not overlap each other.
  window.layoutCheck = function () {
    const cs = getComputedStyle(document.getElementById('content'));
    const safe = { l: parseFloat(cs.left), t: parseFloat(cs.top), r: W - parseFloat(cs.right), b: H - parseFloat(cs.bottom) };
    const vis = [...document.querySelectorAll('.line')].filter(el => {
      const ws = [...el.querySelectorAll('.w')]; if (!ws.length) return false;
      return ws.every(w => +getComputedStyle(w).opacity > 0.9) && +getComputedStyle(el).opacity > 0.3;
    });
    const issues = [];
    const rects = vis.map(el => {
      const ws = [...el.querySelectorAll('.w')].map(w => w.getBoundingClientRect());
      return { el, txt: el.textContent, l: Math.min(...ws.map(r => r.left)), t: Math.min(...ws.map(r => r.top)),
        r: Math.max(...ws.map(r => r.right)), b: Math.max(...ws.map(r => r.bottom)) };
    });
    for (const a of rects) {
      if (a.l < safe.l - 1 || a.r > safe.r + 1 || a.t < safe.t - 1 || a.b > safe.b + 1)
        issues.push(`outside safe area: "${a.txt}" [${a.l|0},${a.t|0},${a.r|0},${a.b|0}]`);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.l < b.r && b.l < a.r && a.t < b.b - 2 && b.t < a.b - 2) issues.push(`overlap: "${a.txt}" x "${b.txt}"`);
    }
    return { visible: rects.map(r => r.txt), issues };
  };

  window.CDF = { build, tl, f, words, exit, fmt, W, H, dur, offset, rng: mulberry32 };
})();
