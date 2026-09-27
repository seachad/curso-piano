/*
 * Motor de diagramas del curso (sin dependencias).
 *
 * Teclado con manos:
 *   <figure class="kbd" data-kbd='{"from":"C3","to":"B4",
 *        "rh":{"fingers":{"1":"C4","3":"E4","5":"G4"}},
 *        "lh":{"fingers":{"5":"C3"}},
 *        "marks":[{"note":"C4","color":"#e4574c","main":"C","sub":"central"}],
 *        "names":"all", "seq":[["C4"],["D4"]], "tempo":0.45}'>
 *     <figcaption>...</figcaption>
 *   </figure>
 *   - fingers: dedo (1 pulgar ... 5 meñique) -> nota. Los dedos sin tecla se dibujan "en el aire".
 *   - press:   notas que suenan (por defecto, todas las de fingers).
 *   - seq:     secuencia para el botón Escuchar (array de pasos; cada paso, una nota o array de notas).
 *   - solfeo:  true añade Do/Re/Mi bajo la letra.
 *
 * Numeración de dedos:      <figure class="kbd" data-fingers></figure>
 * Metrónomo:                <div data-metro data-bpm="60"></div>
 * Casilla que se recuerda:  <input type="checkbox" data-save="l1-c1">
 */
(function () {
  'use strict';

  const W = 40, H = 190, BW = 24, BH = 118, TOP = 48, PADX = 12, HANDH = 150;
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LAT = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  const BLACK = new Set([1, 3, 6, 8, 10]);
  const SKIN = '#f1d0b2', SKIN_LINE = '#b3845f';
  const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const HAND = {
    R: { key: '#a9b4f5', keySoft: '#e3e7fd', keyBlack: '#4f5bd5', ink: '#3b46b8', name: 'Mano derecha' },
    L: { key: '#fbc58e', keySoft: '#feebd8', keyBlack: '#e0771a', ink: '#b85a0a', name: 'Mano izquierda' }
  };

  function parse(n) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(n).trim());
    if (!m) throw new Error('Nota no válida: ' + n);
    const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return { midi: 12 * (+m[3] + 1) + PC[m[1]] + acc, letter: m[1], acc: m[2] };
  }

  function label(n) {
    const p = parse(n);
    const sym = p.acc === '#' ? '♯' : p.acc === 'b' ? '♭' : '';
    return { main: p.letter + sym, lat: LAT[p.letter] + sym };
  }

  function layout(from, to) {
    const a = parse(from).midi, b = parse(to).midi;
    const keys = [], by = {};
    let wi = 0;
    for (let m = a; m <= b; m++) {
      const black = BLACK.has(m % 12);
      const k = black
        ? { m, black, x: wi * W - BW / 2, cx: wi * W }
        : { m, black, x: wi * W, cx: wi * W + W / 2 };
      if (!black) wi++;
      keys.push(k);
      by[m] = k;
    }
    return { keys, by, width: wi * W, whites: wi };
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const pt = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;

  // Dedo: forma que se estrecha desde el nudillo (semiancho a) hasta la yema redondeada (semiancho b),
  // con un leve abultamiento en la articulación central. ext = cuánto entra en la palma.
  function fingerPath(B, T, a, b, ext) {
    const dx = T.x - B.x, dy = T.y - B.y, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const bx = B.x - ux * ext, by = B.y - uy * ext;
    const mx = bx + (T.x - bx) * 0.5, my = by + (T.y - by) * 0.5, am = (a + b) / 2 + 1.5;
    return `M${pt(bx + nx * a, by + ny * a)}` +
      ` Q${pt(mx + nx * am, my + ny * am)} ${pt(T.x + nx * b, T.y + ny * b)}` +
      ` A${b} ${b} 0 0 0 ${pt(T.x - nx * b, T.y - ny * b)}` +
      ` Q${pt(mx - nx * am, my - ny * am)} ${pt(bx - nx * a, by - ny * a)} Z`;
  }

  // Pliegue de piel atravesando el dedo a una fracción t de su longitud.
  function crease(B, T, t, w) {
    const dx = T.x - B.x, dy = T.y - B.y, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L, px = B.x + dx * t, py = B.y + dy * t;
    const bend = 2.5;
    return `M${pt(px + nx * w, py + ny * w)} Q${pt(px + dx / L * bend, py + dy / L * bend)} ${pt(px - nx * w, py - ny * w)}`;
  }

  // Semianchos (nudillo, yema) de cada dedo.
  const FINGER_W = { 1: [15, 11], 2: [11.5, 9.5], 3: [12, 10], 4: [11, 9.2], 5: [9.5, 8] };

  // Silueta de una mano vista desde arriba (palma hacia las teclas) + círculos numerados en las yemas.
  function handShape(side, tips, palm, showLabel) {
    const c = HAND[side];
    const { left, py, pw } = palm;
    const s1 = side === 'R' ? 1 : -1;          // +1: pulgar a la izquierda (mano derecha)
    const cx = left + pw / 2, h = pw / 2;
    const X = rx => cx + s1 * rx;               // coordenadas "de mano derecha" -> reales
    const knuckleY = { 2: py + 8, 3: py + 2, 4: py + 6, 5: py + 16 };
    const bases = {};
    [2, 3, 4, 5].forEach((f, i) => { bases[f] = { x: X(-h + pw * (i + 0.5) / 4), y: knuckleY[f] }; });
    bases[1] = { x: X(-h + 14), y: py + 64 };

    // Palma: arco de nudillos, borde del meñique, muñeca y eminencia del pulgar.
    const palmD =
      `M${pt(X(-h + 3), py + 14)}` +
      ` Q${pt(X(0), py - 10)} ${pt(X(h - 4), py + 18)}` +
      ` C${pt(X(h + 6), py + 52)} ${pt(X(h + 5), py + 96)} ${pt(X(h - 8), py + 138)}` +
      ` L${pt(X(h - 16), py + 270)} L${pt(X(-h + 20), py + 270)}` +
      ` L${pt(X(-h + 12), py + 150)}` +
      ` C${pt(X(-h - 16), py + 112)} ${pt(X(-h - 12), py + 64)} ${pt(X(-h - 2), py + 42)}` +
      ` Q${pt(X(-h - 1), py + 24)} ${pt(X(-h + 3), py + 14)} Z`;

    const fingers = [1, 2, 3, 4, 5].map(f =>
      fingerPath(bases[f], tips[f], FINGER_W[f][0], FINGER_W[f][1], f === 1 ? 20 : 16));

    let s = '<g opacity="0.78" stroke-linejoin="round">';
    // Contorno: se pinta todo con trazo grueso y encima el relleno, así las piezas se funden en una sola silueta.
    s += `<path d="${palmD}" fill="${SKIN_LINE}" stroke="${SKIN_LINE}" stroke-width="3.5"/>`;
    fingers.forEach(d => { s += `<path d="${d}" fill="${SKIN_LINE}" stroke="${SKIN_LINE}" stroke-width="3.5"/>`; });
    s += `<path d="${palmD}" fill="${SKIN}"/>`;
    fingers.forEach(d => { s += `<path d="${d}" fill="${SKIN}"/>`; });
    // Volumen: luz en el dorso y pliegues de los nudillos.
    s += `<ellipse cx="${X(h * 0.1).toFixed(1)}" cy="${py + 62}" rx="${(h * 0.62).toFixed(1)}" ry="34" fill="#fff" opacity="0.22"/>`;
    s += `<g fill="none" stroke="${SKIN_LINE}" stroke-width="1.3" stroke-linecap="round" opacity="0.55">`;
    [2, 3, 4, 5].forEach(f => {
      const w = FINGER_W[f][0] * 0.55;
      s += `<path d="${crease(bases[f], tips[f], 0.42, w)}"/><path d="${crease(bases[f], tips[f], 0.7, w * 0.9)}"/>`;
    });
    s += `<path d="${crease(bases[1], tips[1], 0.55, FINGER_W[1][0] * 0.5)}"/>`;
    s += '</g></g>';

    for (let f = 1; f <= 5; f++) {
      const t = tips[f];
      if (t.on) {
        s += `<circle cx="${t.x}" cy="${t.y}" r="12.5" fill="${t.pressed ? c.ink : '#fff'}" stroke="${c.ink}" stroke-width="2.5"/>`;
        s += `<text x="${t.x}" y="${t.y + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="${t.pressed ? '#fff' : c.ink}">${f}</text>`;
      } else {
        s += `<circle cx="${t.x}" cy="${t.y}" r="10" fill="#fff" fill-opacity="0.85" stroke="${c.ink}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
        s += `<text x="${t.x}" y="${t.y + 4}" text-anchor="middle" font-size="12" fill="${c.ink}" opacity="0.85">${f}</text>`;
      }
    }
    if (showLabel) {
      s += `<text x="${left + pw / 2}" y="${py + 74}" text-anchor="middle" font-size="14" font-weight="700" fill="${c.ink}">${c.name}</text>`;
    }
    return s;
  }

  function handOnKeys(side, h, press, L) {
    const dir = side === 'R' ? 1 : -1;
    const tips = {};
    for (let f = 1; f <= 5; f++) {
      const n = h.fingers[f];
      if (!n) continue;
      const k = L.by[parse(n).midi];
      if (!k) throw new Error('La nota ' + n + ' está fuera del teclado dibujado');
      let y = k.black ? TOP + BH - 22 : TOP + H - 42;
      if (f === 1 && !k.black) y += 12; // el pulgar queda algo más cerca del borde
      tips[f] = { x: k.cx, y, on: true, pressed: press.has(k.m) };
    }
    const assigned = Object.keys(tips).map(Number);
    for (let f = 1; f <= 5; f++) {
      if (tips[f]) continue;
      const lo = assigned.filter(a => a < f).pop();
      const hi = assigned.find(a => a > f);
      let x;
      if (lo != null && hi != null) x = tips[lo].x + (tips[hi].x - tips[lo].x) * (f - lo) / (hi - lo);
      else if (lo != null) x = tips[lo].x + dir * (f - lo) * W * 0.95;
      else x = tips[hi].x + dir * (f - hi) * W * 0.95;
      tips[f] = { x, y: TOP + H - 12, on: false };
    }
    const xs = [2, 3, 4, 5].map(f => tips[f].x);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const pw = Math.max(112, Math.min(165, (maxX - minX) * 0.85 + 30));
    const pcx = (minX + maxX) / 2;
    return handShape(side, tips, { left: pcx - pw / 2, py: TOP + H + 32, pw }, true);
  }

  function renderKeyboard(fig, spec) {
    const L = layout(spec.from, spec.to);
    const sides = [['L', spec.lh], ['R', spec.rh]].filter(([, h]) => h);
    const totalH = TOP + H + (sides.length ? HANDH : 10);
    const fills = {};
    const top = [];
    const sounding = [];

    (spec.marks || []).forEach(mk => {
      const k = L.by[parse(mk.note).midi];
      if (!k) return;
      fills[k.m] = mk.color || '#ef476f';
      if (mk.nolabel) return;
      const lb = label(mk.note);
      top.push({
        cx: k.cx,
        main: mk.main || lb.main,
        sub: mk.sub != null ? mk.sub : (spec.solfeo ? lb.lat : ''),
        color: mk.ink || mk.color || '#c9184a'
      });
    });

    const hands = sides.map(([side, h]) => {
      const c = HAND[side];
      const notes = Object.values(h.fingers);
      const press = new Set((h.press || notes).map(n => parse(n).midi));
      notes.forEach(n => {
        const k = L.by[parse(n).midi];
        if (!k) return;
        const on = press.has(k.m);
        fills[k.m] = on ? (k.black ? c.keyBlack : c.key) : c.keySoft;
        const lb = label(n);
        top.push({ cx: k.cx, main: lb.main, sub: spec.solfeo ? lb.lat : '', color: c.ink, faded: !on });
      });
      press.forEach(m => sounding.push(m));
      return { side, h, press };
    });

    let s = `<svg viewBox="0 0 ${L.width + PADX * 2} ${totalH}" style="min-width:${Math.round(L.whites * 21)}px" role="img" aria-label="${esc(fig.dataset.alt || 'Diagrama de teclado')}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">`;
    s += `<g transform="translate(${PADX},0)">`;
    s += `<rect x="-4" y="${TOP - 6}" width="${L.width + 8}" height="10" rx="3" fill="#3a3530"/>`;
    L.keys.filter(k => !k.black).forEach(k => {
      s += `<rect x="${k.x}" y="${TOP}" width="${W}" height="${H}" rx="5" fill="${fills[k.m] || '#fff'}" stroke="#2a2622" stroke-width="1.2"/>`;
    });
    L.keys.filter(k => k.black).forEach(k => {
      const f = fills[k.m];
      s += `<rect x="${k.x}" y="${TOP}" width="${BW}" height="${BH}" rx="3.5" fill="${f || '#1c1a18'}" stroke="#0d0c0b" stroke-width="1"/>`;
      if (!f) s += `<rect x="${k.x + 4}" y="${TOP + 2}" width="${BW - 8}" height="${BH - 14}" rx="2" fill="#fff" opacity="0.07"/>`;
    });
    if (spec.names === 'all') {
      L.keys.filter(k => !k.black).forEach(k => {
        const letter = Object.keys(PC).find(l => PC[l] === k.m % 12);
        const isC = letter === 'C';
        s += `<text x="${k.cx}" y="${TOP + H - 16}" text-anchor="middle" font-size="${isC ? 16 : 14}" font-weight="${isC ? 800 : 600}" fill="${isC ? '#c9184a' : '#3a3530'}">${letter}</text>`;
        if (spec.solfeo) s += `<text x="${k.cx}" y="${TOP + H - 36}" text-anchor="middle" font-size="10.5" fill="#8a8178">${LAT[letter]}</text>`;
      });
    }
    top.forEach(t => {
      const op = t.faded ? 0.5 : 1;
      s += `<text x="${t.cx}" y="${t.sub ? 20 : 30}" text-anchor="middle" font-size="16" font-weight="800" fill="${t.color}" opacity="${op}">${esc(t.main)}</text>`;
      if (t.sub) s += `<text x="${t.cx}" y="37" text-anchor="middle" font-size="11" fill="#8a8178" opacity="${op}">${esc(t.sub)}</text>`;
    });
    hands.forEach(({ side, h, press }) => { s += handOnKeys(side, h, press, L); });
    s += '</g></svg>';

    mount(fig, s);

    const seq = spec.seq ? spec.seq.map(step => [].concat(step).map(n => parse(n).midi)) : (sounding.length ? [sounding] : null);
    if (seq && spec.play !== false) addPlayer(fig, seq, spec.tempo || 0.45, spec.playLabel);
  }

  function renderFingers(fig) {
    const Wd = 600, Hd = 300, py = 150;
    const rel = { 1: [-102, -30], 2: [-50, -105], 3: [-12, -128], 4: [26, -114], 5: [62, -78] };
    let s = `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="Numeración de los dedos de ambas manos" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">`;
    [['L', 170], ['R', 430]].forEach(([side, pcx]) => {
      const dir = side === 'R' ? 1 : -1;
      const tips = {};
      for (let f = 1; f <= 5; f++) tips[f] = { x: pcx + dir * rel[f][0], y: py + rel[f][1], on: true, pressed: true };
      s += handShape(side, tips, { left: pcx - 65, py, pw: 130 }, true);
    });
    s += '</svg>';
    mount(fig, s);
  }

  // Coloca el SVG dentro de la figura, debajo de su título si lo tiene.
  function mount(fig, svg) {
    const wrap = document.createElement('div');
    wrap.className = 'kbd-scroll';
    wrap.innerHTML = svg;
    const title = fig.querySelector('.fig-title');
    if (title) title.after(wrap);
    else fig.prepend(wrap);
  }

  // ---------- Audio: timbre sencillo tipo piano eléctrico, sin muestras externas ----------
  let ctx = null;
  const audio = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());
  function tone(midi, t, dur, vol) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o1.type = 'triangle'; o1.frequency.value = f;
    o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.25;
    o1.connect(g); o2.connect(g2).connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function play(seq, step) {
    audio();
    const t0 = ctx.currentTime + 0.05;
    seq.forEach((notes, i) => {
      const dur = seq.length === 1 ? 2.2 : Math.max(0.9, step * 2);
      notes.forEach(m => tone(m, t0 + i * step, dur, 0.28 / Math.sqrt(notes.length)));
    });
  }
  function addPlayer(fig, seq, step, text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'play';
    b.innerHTML = '<span aria-hidden="true">▶</span> ' + esc(text || 'Escuchar');
    b.addEventListener('click', () => play(seq, step));
    fig.insertBefore(b, fig.querySelector('figcaption'));
  }

  // ---------- Metrónomo ----------
  function click(t, strong) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = strong ? 1500 : 1000;
    o.connect(g).connect(ctx.destination);
    g.gain.setValueAtTime(strong ? 0.5 : 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.start(t); o.stop(t + 0.06);
  }
  function renderMetro(el) {
    let bpm = +el.dataset.bpm || 60, beats = +el.dataset.beats || 4, timer = null, next = 0, beat = 0;
    el.classList.add('metro');
    el.innerHTML =
      '<button type="button" class="metro-go" aria-label="Iniciar metrónomo">▶</button>' +
      '<div class="metro-dots">' + '<span></span>'.repeat(beats) + '</div>' +
      '<div class="metro-bpm"><button type="button" data-d="-5" aria-label="Más lento">−</button>' +
      '<output>' + bpm + '</output><small>ppm</small>' +
      '<button type="button" data-d="5" aria-label="Más rápido">+</button></div>';
    const go = el.querySelector('.metro-go'), out = el.querySelector('output');
    const dots = [...el.querySelectorAll('.metro-dots span')];
    function tick() {
      while (next < ctx.currentTime + 0.1) {
        const b = beat, when = next;
        click(when, b === 0);
        setTimeout(() => dots.forEach((d, i) => d.classList.toggle('on', i === b)), Math.max(0, (when - ctx.currentTime) * 1000));
        beat = (beat + 1) % beats;
        next += 60 / bpm;
      }
    }
    function stop() { clearInterval(timer); timer = null; go.textContent = '▶'; dots.forEach(d => d.classList.remove('on')); }
    go.addEventListener('click', () => {
      if (timer) return stop();
      audio(); beat = 0; next = ctx.currentTime + 0.05;
      timer = setInterval(tick, 25); go.textContent = '■';
    });
    el.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => {
      bpm = Math.min(200, Math.max(30, bpm + +b.dataset.d)); out.textContent = bpm;
    }));
  }

  function init() {
    document.querySelectorAll('[data-kbd]').forEach(fig => {
      try { renderKeyboard(fig, JSON.parse(fig.dataset.kbd)); }
      catch (e) { fig.insertAdjacentHTML('afterbegin', `<p class="err">Error en el diagrama: ${esc(e.message)}</p>`); }
    });
    document.querySelectorAll('[data-fingers]').forEach(renderFingers);
    document.querySelectorAll('[data-metro]').forEach(renderMetro);

    const bar = document.querySelector('.progress');
    if (bar) {
      const upd = () => {
        const h = document.documentElement.scrollHeight - innerHeight;
        bar.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + '%';
      };
      addEventListener('scroll', upd, { passive: true });
      upd();
    }

    // Casillas de "lo tengo": se recuerdan en este navegador, si se puede.
    document.querySelectorAll('input[type=checkbox][data-save]').forEach(cb => {
      const key = 'piano:' + cb.dataset.save;
      try { cb.checked = localStorage.getItem(key) === '1'; } catch (e) { /* sin almacenamiento */ }
      cb.addEventListener('change', () => {
        try { localStorage.setItem(key, cb.checked ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
