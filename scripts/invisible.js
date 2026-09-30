(() => {
  const SEQUENCE = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'b', 'a', 'Enter',
  ];
  const STORE_KEY = 'tmh-pride';
  const FROM = 'The Military Hub';
  const TO = 'Transgender Military Hub';
  const FLAG = ['#5BCEFA', '#F5A9B8', '#FFFFFF', '#F5A9B8', '#5BCEFA'];

  const OUT_MS = 900;
  const IN_MS = 900;
  const PAD = 46;
  const STEP = 2;
  const SOUND = './media/invisible.mp3';

  let busy = false;
  let audio = null;

  const play = () => {
    try {
      if (!audio) {
        audio = new Audio(SOUND);
        audio.preload = 'none';
      }
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
  };

  const targets = () => [...document.querySelectorAll('.wordmark, footer.site h4')]
    .filter((el) => el.dataset.prideOriginal || el.textContent.trim() === FROM);

  const swap = (els, on) => {
    for (const el of els) {
      if (on) {
        if (!el.dataset.prideOriginal) el.dataset.prideOriginal = el.textContent;
        el.textContent = TO;
        el.classList.add('pride-name');
      } else {
        if (el.dataset.prideOriginal) el.textContent = el.dataset.prideOriginal;
        el.classList.remove('pride-name');
      }
    }
  };

  const read = () => {
    try { return sessionStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
  };
  const write = (on) => {
    try { sessionStorage.setItem(STORE_KEY, on ? '1' : '0'); } catch (e) {}
  };
  const reduced = () => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };

  const fontOf = (el) => {
    const cs = getComputedStyle(el);
    return {
      font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`,
      size: parseFloat(cs.fontSize),
      tracking: parseFloat(cs.letterSpacing) || 0,
      plain: cs.getPropertyValue('--ink') || '#E0D6C2',
    };
  };

  const paintText = (ctx, text, meta, w, h, pride) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = meta.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if (pride) {
      const top = h / 2 - meta.size * 0.62;
      const bottom = h / 2 + meta.size * 0.62;
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      FLAG.forEach((c, i) => {
        g.addColorStop(i / FLAG.length, c);
        g.addColorStop((i + 1) / FLAG.length - 0.0001, c);
      });
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = meta.plain.trim() || '#E0D6C2';
    }
    let x = PAD;
    for (const ch of text) {
      ctx.fillText(ch, x, h / 2);
      x += ctx.measureText(ch).width + meta.tracking;
    }
  };

  const sample = (ctx, w, h) => {
    const data = ctx.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let y = 0; y < h; y += STEP) {
      for (let x = 0; x < w; x += STEP) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 110) continue;
        pts.push({
          x, y,
          r: data[i], g: data[i + 1], b: data[i + 2],
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 1.4 - 0.15,
          drift: (Math.random() - 0.5) * 0.05,
          life: 0.55 + Math.random() * 0.45,
        });
      }
    }
    return pts;
  };

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const disperse = (el, nextText, nextPride, done) => {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) { done(); return; }

    const meta = fontOf(el);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.ceil(rect.width) + PAD * 2;
    const h = Math.ceil(rect.height) + PAD * 2;

    const canvas = document.createElement('canvas');
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.cssText = `position:absolute;left:${rect.left + window.scrollX - PAD}px;` +
      `top:${rect.top + window.scrollY - PAD}px;width:${w}px;height:${h}px;` +
      'pointer-events:none;z-index:60;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.scale(dpr, dpr);

    const wasPride = el.classList.contains('pride-name');
    paintText(ctx, el.textContent, meta, w, h, wasPride);
    const outPts = sample(ctx, w * dpr, h * dpr).map((p) => ({ ...p, x: p.x / dpr, y: p.y / dpr }));

    el.style.visibility = 'hidden';

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      el.style.visibility = '';
    };

    let inPts = null;
    const startedAt = performance.now();

    const frame = (now) => {
      const elapsed = now - startedAt;

      if (elapsed < OUT_MS) {
        const t = elapsed / OUT_MS;
        ctx.clearRect(0, 0, w, h);
        for (const p of outPts) {
          const a = Math.max(0, 1 - t / p.life);
          if (a <= 0) continue;
          p.x += p.vx * 0.9;
          p.y += p.vy * 0.9;
          p.vx += p.drift;
          p.vy -= 0.012;
          ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
          ctx.fillRect(p.x, p.y, STEP, STEP);
        }
        requestAnimationFrame(frame);
        return;
      }

      if (!inPts) {
        swap([el], nextPride);
        paintText(ctx, nextText, meta, w, h, nextPride);
        inPts = sample(ctx, w * dpr, h * dpr).map((p) => ({
          tx: p.x / dpr, ty: p.y / dpr,
          r: p.r, g: p.g, b: p.b,
          ox: (Math.random() - 0.5) * 90,
          oy: -Math.random() * 60 - 10,
          life: 0.35 + Math.random() * 0.5,
        }));
        el.style.visibility = 'hidden';
      }

      const t = Math.min(1, (elapsed - OUT_MS) / IN_MS);
      const e = easeOut(t);
      ctx.clearRect(0, 0, w, h);
      for (const p of inPts) {
        const a = Math.min(1, Math.max(0, (t - (1 - p.life)) / p.life));
        if (a <= 0) continue;
        const x = p.tx + p.ox * (1 - e);
        const y = p.ty + p.oy * (1 - e);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
        ctx.fillRect(x, y, STEP, STEP);
      }

      if (t < 1) { requestAnimationFrame(frame); return; }
      finish();
      done();
    };

    requestAnimationFrame(frame);

    setTimeout(() => {
      if (finished) return;
      if (!inPts) swap([el], nextPride);
      finish();
      done();
    }, OUT_MS + IN_MS + 600);
  };

  const fadeSimple = (el, on) => {
    if (typeof el.animate !== 'function') { swap([el], on); return; }
    const opts = { duration: OUT_MS, easing: 'ease' };
    const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, fill: 'forwards' });
    setTimeout(() => {
      out.cancel();
      swap([el], on);
      const back = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: IN_MS, easing: 'ease' });
      setTimeout(() => back.cancel(), IN_MS);
    }, OUT_MS);
  };

  const apply = (on, animate) => {
    const els = targets();
    if (!animate || reduced()) { swap(els, on); return; }

    busy = true;
    const word = els.find((el) => el.classList.contains('wordmark'));
    const rest = els.filter((el) => el !== word);

    for (const el of rest) fadeSimple(el, on);

    const release = () => { setTimeout(() => { busy = false; }, 80); };

    let canvasOk = false;
    try { canvasOk = !!document.createElement('canvas').getContext('2d'); } catch (e) {}

    if (!word || !canvasOk) {
      if (word) swap([word], on);
      release();
      return;
    }

    try {
      disperse(word, on ? TO : (word.dataset.prideOriginal || FROM), on, release);
    } catch (e) {
      word.style.visibility = '';
      swap([word], on);
      release();
    }
  };

  let on = read();
  if (on) apply(true, false);

  let pos = 0;
  window.addEventListener('keydown', (event) => {
    const el = event.target;
    const tag = el && el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (key === SEQUENCE[pos]) {
      pos += 1;
      if (pos === SEQUENCE.length) {
        pos = 0;
        if (busy) return;
        on = !on;
        play();
        apply(on, true);
        write(on);
      }
      return;
    }
    pos = key === SEQUENCE[0] ? 1 : 0;
  });
})();
