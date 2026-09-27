/*
 * Motor de diagramas del curso (sin dependencias). Todo se declara en el HTML:
 *
 * 1) Teclado con manos
 *   <figure class="kbd" data-chord="C" data-kbd='{"from":"B2","to":"A4",
 *        "lh":{"fingers":{"5":"C3"}},
 *        "rh":{"fingers":{"1":"C4","3":"E4","5":"G4"}}}'>
 *     <p class="fig-title">…</p><figcaption>…</figcaption>
 *   </figure>
 *   - fingers: dedo (1 pulgar … 5 meñique) -> nota. Se dibuja una mano realista; los dedos sin nota quedan recogidos.
 *   - press:   notas que suenan (por defecto todas las de fingers).
 *   - marks:   teclas resaltadas sin mano [{note,color,main,sub,ink,nolabel}].
 *   - names:"all" letra en cada tecla blanca · solfeo:true añade Do/Re/Mi.
 *   - seq:     pasos para ▶ (cada paso: nota, lista de notas o [] = silencio) · tempo (s por paso) · swing.
 *   - play:false sin botón · playLabel texto del botón.
 *   - data-chord (atributo): acorde que muestran las teclas pulsadas; lo verifican los tests.
 *
 * 2) Progresión de acordes
 *   <figure class="kbd" data-prog='{"chords":["C","G","Am","F"],"nums":["I","V","vi","IV"],"bpm":80,
 *        "pattern":"X.C.C.C.","swing":false,"grid":true,"loop":2}'>
 *   - chords: nombres ("C", "Am", "G7", "C/E"…) u objetos {name, rh:[notas], bass:"C3", lh:[notas], beats, pattern, partial}.
 *     Si no das rh/bass se genera una posición cerrada cerca del C central. Los tests exigen que rh + bass
 *     sean exactamente las notas del acorde; partial:true lo desactiva (p. ej. Am/G o un C7 sin quinta).
 *   - pattern: una letra por corchea: X bajo+acorde · B bajo · O bajo una octava arriba · C acorde
 *     · 1-4 nota n del acorde (de grave a agudo) · L siguiente elemento de "lh" (nota o [notas])
 *     · M como L pero sumando el acorde de la derecha · . silencio/mantener.
 *
 * 3) Círculo de quintas
 *   <figure class="kbd" data-circle='{"highlight":["C","G","F","Am"],"arrows":[["G","C"]],"center":"C"}'>
 *   - rings: [[12 etiquetas], …] (por defecto mayores y relativos menores).
 *
 * 4) Otros: <figure class="kbd" data-fingers> · <div data-metro data-bpm="60" data-beats="4">
 *    · <input type="checkbox" data-save="id"> · <div data-temario> · <nav class="pager" data-pager="3">
 *
 * En Node (tests) se exporta la API pura: parse, parseChord, voicing, buildKeyboard, buildProg, buildCircle…
 */
(function (root) {
  'use strict';

  const W = 40, H = 230, BW = 24, BH = 142, PADX = 12, LIP = 14;
  let TOP = 48;   // alto de la franja de rótulos sobre el teclado (se ajusta en cada diagrama)
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LAT = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const BLACK = new Set([1, 3, 6, 8, 10]);
  const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const HAND = {
    R: { key: '#8c99f6', keySoft: '#dfe3fd', keyBlack: '#4353d6', ink: '#3b46b8', name: 'Mano derecha' },
    L: { key: '#f8ae66', keySoft: '#feebd8', keyBlack: '#d8690c', ink: '#b85a0a', name: 'Mano izquierda' }
  };
  // Código de color por tipo de acorde (Armonía Ilustrada).
  const TYPE_COLOR = { maj: '#ff5fa2', min: '#25b7e8', dom: '#f5b700', dim: '#8b5cf6', aug: '#22c55e' };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pt = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  let uid = 0;

  // ---------------------------------------------------------------- notas
  function parse(n) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(n).trim());
    if (!m) throw new Error('Nota no válida: ' + n);
    const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return { midi: 12 * (+m[3] + 1) + PC[m[1]] + acc, letter: m[1], acc: m[2] };
  }
  const midi = n => (typeof n === 'number' ? n : parse(n).midi);
  const pretty = s => String(s).replace(/^([A-G])#/, '$1♯').replace(/^([A-G])b/, '$1♭').replace(/\/([A-G])#/, '/$1♯').replace(/\/([A-G])b/, '/$1♭');

  function label(n) {
    const p = parse(n);
    const sym = p.acc === '#' ? '♯' : p.acc === 'b' ? '♭' : '';
    return { main: p.letter + sym, lat: LAT[p.letter] + sym };
  }

  // ---------------------------------------------------------------- acordes
  const QUAL = {
    '': [0, 4, 7], 'M': [0, 4, 7], 'm': [0, 3, 7], '5': [0, 7],
    '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'M7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'mMaj7': [0, 3, 7, 11],
    '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], '9': [0, 4, 7, 10, 2], 'maj9': [0, 4, 7, 11, 2], 'm9': [0, 3, 7, 10, 2],
    'add9': [0, 4, 7, 2], 'madd9': [0, 3, 7, 2], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'sus': [0, 5, 7], '7sus4': [0, 5, 7, 10],
    'dim': [0, 3, 6], '°': [0, 3, 6], 'dim7': [0, 3, 6, 9], '°7': [0, 3, 6, 9],
    'm7b5': [0, 3, 6, 10], 'ø': [0, 3, 6, 10], 'ø7': [0, 3, 6, 10],
    '+': [0, 4, 8], 'aug': [0, 4, 8], '+7': [0, 4, 8, 10], '7#5': [0, 4, 8, 10]
  };
  function chordType(q) {
    if (/^(dim|°|ø|m7b5)/.test(q)) return 'dim';
    if (/^(\+|aug)|#5/.test(q)) return 'aug';
    if (/^m(?!aj)/.test(q)) return 'min';
    if (/^(7|9|13|11)/.test(q) || q === '7sus4') return 'dom';
    return 'maj';
  }
  function parseChord(name) {
    const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(String(name).trim());
    if (!m || !(m[3] in QUAL)) throw new Error('Acorde no reconocido: ' + name);
    const acc = a => (a === '#' ? 1 : a === 'b' ? -1 : 0);
    const root = (PC[m[1]] + acc(m[2]) + 12) % 12;
    const ints = QUAL[m[3]];
    const bass = m[4] ? (PC[m[4]] + acc(m[5]) + 12) % 12 : root;
    return { name, root, qual: m[3], type: chordType(m[3]), pcs: new Set(ints.map(i => (root + i) % 12)), intervals: ints, bass };
  }
  // Posición por defecto: bajo en la octava 3 (C3…B3) y acorde cerrado entre A3 y G#4.
  function voicing(name) {
    const c = parseChord(name);
    const rh = [...new Set(c.intervals.map(i => (c.root + i) % 12))]
      .map(pc => 57 + ((pc - 57) % 12 + 12) % 12).sort((a, b) => a - b);
    return { bass: 48 + c.bass, rh };
  }

  // ---------------------------------------------------------------- teclado
  function layout(from, to) {
    const a = parse(from).midi, b = parse(to).midi;
    if (b <= a) throw new Error('Rango de teclado vacío: ' + from + '–' + to);
    if (BLACK.has(a % 12) || BLACK.has(b % 12)) throw new Error('El teclado debe empezar y acabar en tecla blanca');
    const keys = [], by = {};
    let wi = 0;
    for (let m = a; m <= b; m++) {
      const black = BLACK.has(m % 12);
      const k = black ? { m, black, x: wi * W - BW / 2, cx: wi * W } : { m, black, x: wi * W, cx: wi * W + W / 2 };
      if (!black) wi++;
      keys.push(k);
      by[m] = k;
    }
    return { keys, by, width: wi * W, whites: wi };
  }

  // ---------------------------------------------------------------- manos realistas
  // Mano vista desde arriba, como en una foto: dorso con nudillos y tendones, dedos con falanges,
  // pliegues y uñas, y sombra sobre las teclas. Los dedos que tocan llevan su número encima.
  const HAND_SP = 36;                                   // separación entre nudillos
  const FW2 = { 1: [19, 14.5], 2: [16, 13], 3: [16.5, 13.5], 4: [15.5, 12.5], 5: [13.5, 11] };
  const SKIN_EDGE = '#c98466', SKIN_MID = '#efc0a3', SKIN_HI = '#f8dac6', SKIN_DARK = '#a8603f';

  function axis(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    return { ux: dx / L, uy: dy / L, nx: -dy / L, ny: dx / L, L };
  }
  const along = (K, T, t) => { const { ux, uy, L } = axis(K, T); return { x: K.x + ux * t * L, y: K.y + uy * t * L }; };
  const angleDeg = (K, T) => { const { ux, uy } = axis(K, T); return Math.atan2(uy, ux) * 180 / Math.PI + 90; };

  // Contorno de un dedo desde el nudillo K hasta la yema T (semiancho a en la base y b en la yema),
  // con un leve abultamiento en cada articulación. ext = cuánto se mete en el dorso.
  function fingerOutline(K, T, a, b, ext) {
    const { ux, uy, nx, ny, L } = axis(K, T);
    const P = (t, w, s) => pt(K.x + ux * t * L + s * nx * w, K.y + uy * t * L + s * ny * w);
    const e = -ext / L, wP = a * 0.97, wD = (a + b) / 2 + 0.6;
    return `M${P(e, a, 1)} L${P(0.1, a, 1)} Q${P(0.42, wP + 1, 1)} ${P(0.5, wP * 0.95, 1)} Q${P(0.74, wD + 0.9, 1)} ${P(1, b, 1)}` +
      ` A${b} ${b} 0 0 0 ${P(1, b, -1)}` +
      ` Q${P(0.74, wD + 0.9, -1)} ${P(0.5, wP * 0.95, -1)} Q${P(0.42, wP + 1, -1)} ${P(0.1, a, -1)} L${P(e, a, -1)} Z`;
  }

  // tips: {1..5: {x, y, state: 'press' | 'rest' | 'lift'}} · kY: altura de los nudillos · bottom: borde inferior
  function realisticHand(side, tips, kY, bottom, id, opts) {
    opts = opts || {};
    const c = HAND[side], dir = side === 'R' ? 1 : -1;
    const hc = [2, 3, 4, 5].reduce((a, f) => a + tips[f].x, 0) / 4;
    const X = rx => hc + dir * rx;
    const wh = 1.5 * HAND_SP + 20;
    const K = {};
    [2, 3, 4, 5].forEach(f => { K[f] = { x: X((f - 3.5) * HAND_SP), y: kY + { 2: 4, 3: 0, 4: 5, 5: 14 }[f] }; });
    K[1] = { x: X(-wh + 6), y: kY + 44 };
    const g = id + side;

    const dorsum = `M${pt(X(-wh + 8), kY + 8)} Q${pt(X(0), kY - 16)} ${pt(X(wh - 4), kY + 16)}` +
      ` C${pt(X(wh + 6), kY + 60)} ${pt(X(wh + 2), kY + 120)} ${pt(X(wh - 6), bottom + 30)}` +
      ` L${pt(X(-wh + 16), bottom + 30)}` +
      ` C${pt(X(-wh - 8), kY + 160)} ${pt(X(-wh - 20), kY + 104)} ${pt(X(-wh - 8), kY + 64)}` +
      ` Q${pt(X(-wh - 2), kY + 26)} ${pt(X(-wh + 8), kY + 8)} Z`;
    const order = [5, 4, 3, 2, 1];
    const outlines = {};
    order.forEach(f => { outlines[f] = fingerOutline(K[f], tips[f], FW2[f][0], FW2[f][1], f === 1 ? 28 : 22); });

    let defs = `<radialGradient id="${g}d" gradientUnits="userSpaceOnUse" cx="${X(-6).toFixed(1)}" cy="${kY + 50}" r="${(wh * 1.35).toFixed(1)}">` +
      `<stop offset="0" stop-color="${SKIN_HI}"/><stop offset=".55" stop-color="${SKIN_MID}"/><stop offset="1" stop-color="${SKIN_EDGE}"/></radialGradient>` +
      `<linearGradient id="${g}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d6ce"/><stop offset="1" stop-color="#e8aa9d"/></linearGradient>`;
    order.forEach(f => {
      const [a] = FW2[f];
      const m = along(K[f], tips[f], 0.55), { nx, ny } = axis(K[f], tips[f]);
      defs += `<linearGradient id="${g}f${f}" gradientUnits="userSpaceOnUse" x1="${(m.x - nx * a).toFixed(1)}" y1="${(m.y - ny * a).toFixed(1)}" x2="${(m.x + nx * a).toFixed(1)}" y2="${(m.y + ny * a).toFixed(1)}">` +
        `<stop offset="0" stop-color="${SKIN_EDGE}"/><stop offset=".25" stop-color="${SKIN_MID}"/><stop offset=".52" stop-color="${SKIN_HI}"/><stop offset=".8" stop-color="${SKIN_MID}"/><stop offset="1" stop-color="${SKIN_EDGE}"/></linearGradient>`;
    });

    let s = `<defs>${defs}</defs>`;
    // sombra proyectada sobre el teclado
    s += `<g transform="translate(${dir * 5},9)" fill="#2a1609" opacity="0.28" filter="url(#${id}blur)"><path d="${dorsum}"/>${order.map(f => `<path d="${outlines[f]}"/>`).join('')}</g>`;
    // dorso, tendones y nudillos
    s += `<path d="${dorsum}" fill="url(#${g}d)" stroke="${SKIN_EDGE}" stroke-width="1.2"/>`;
    [2, 3, 4, 5].forEach(f => {
      const ex = X((f - 3.5) * HAND_SP * 0.45);
      s += `<path d="M${pt(K[f].x, K[f].y + 16)} Q${pt((K[f].x + ex) / 2, kY + 70)} ${pt(ex, bottom + 10)}" fill="none" stroke="${SKIN_EDGE}" stroke-width="5" stroke-linecap="round" opacity="0.16"/>`;
    });
    // dedos
    order.forEach(f => {
      const t = tips[f], [a, b] = FW2[f];
      s += `<path d="${outlines[f]}" fill="url(#${g}f${f})" stroke="${SKIN_EDGE}" stroke-width="1.1"/>`;
      // pliegues de las articulaciones
      [[0.46, a * 0.62], [0.74, b * 0.75]].forEach(([tt, w]) => {
        if (f === 1 && tt > 0.5) return;
        const p = along(K[f], t, f === 1 ? 0.5 : tt);
        s += `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angleDeg(K[f], t).toFixed(1)})" fill="none" stroke="${SKIN_DARK}" stroke-linecap="round" opacity="0.4" stroke-width="1.1">` +
          `<path d="M${-w} 0 Q0 3 ${w} 0"/><path d="M${(-w * 0.75).toFixed(1)} 4 Q0 6.5 ${(w * 0.75).toFixed(1)} 4"/></g>`;
      });
      // uña con lúnula y brillo
      s += `<g transform="translate(${t.x.toFixed(1)} ${t.y.toFixed(1)}) rotate(${angleDeg(K[f], t).toFixed(1)})">` +
        `<rect x="${(-b * 0.64).toFixed(1)}" y="${(-b * 0.72).toFixed(1)}" width="${(b * 1.28).toFixed(1)}" height="${(b * 1.75).toFixed(1)}" rx="${(b * 0.58).toFixed(1)}" fill="url(#${g}n)" stroke="#cf9488" stroke-width="0.8"/>` +
        `<ellipse cx="0" cy="${(b * 0.82).toFixed(1)}" rx="${(b * 0.42).toFixed(1)}" ry="${(b * 0.2).toFixed(1)}" fill="#fbe6df" opacity="0.85"/>` +
        `<ellipse cx="${(-b * 0.24).toFixed(1)}" cy="${(-b * 0.15).toFixed(1)}" rx="${(b * 0.14).toFixed(1)}" ry="${(b * 0.42).toFixed(1)}" fill="#fff" opacity="0.6"/></g>`;
    });
    // brillo de los nudillos (encima de la base de los dedos)
    [2, 3, 4, 5].forEach(f => {
      s += `<ellipse cx="${K[f].x.toFixed(1)}" cy="${(K[f].y + 4).toFixed(1)}" rx="${(FW2[f][0] * 0.75).toFixed(1)}" ry="${(FW2[f][0] * 0.5).toFixed(1)}" fill="#fff" opacity="0.3"/>`;
    });
    // números de los dedos
    order.forEach(f => {
      const t = tips[f];
      if (t.state === 'lift') return;
      const p = along(K[f], t, f === 1 ? 0.52 : 0.5);
      const on = t.state === 'press';
      s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11.5" fill="${on ? c.ink : '#fff'}" stroke="${on ? '#fff' : c.ink}" stroke-width="2"/>`;
      s += `<text x="${p.x.toFixed(1)}" y="${(p.y + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="800" fill="${on ? '#fff' : c.ink}">${f}</text>`;
    });
    // nombre de la mano sobre el dorso
    const txt = c.name, tw = txt.length * 7.2 + 20;
    const [lo, hi] = opts.clamp || [-Infinity, Infinity];
    const lx = Math.min(hi - tw / 2, Math.max(lo + tw / 2, X(4)));
    const ly = Math.min(bottom - 20, kY + 88);
    s += `<rect x="${(lx - tw / 2).toFixed(1)}" y="${ly - 16}" width="${tw.toFixed(1)}" height="23" rx="11.5" fill="#fff" fill-opacity="0.92" stroke="${c.ink}" stroke-width="1.5"/>`;
    s += `<text x="${lx.toFixed(1)}" y="${ly}" text-anchor="middle" font-size="12.5" font-weight="800" fill="${c.ink}">${txt}</text>`;
    return s;
  }

  // Coloca una mano sobre el teclado a partir de "fingers" (dedo -> nota).
  function handOnKeys(side, h, press, L) {
    const dir = side === 'R' ? 1 : -1;
    const tips = {};
    for (let f = 1; f <= 5; f++) {
      const n = h.fingers[f];
      if (!n) continue;
      const k = L.by[parse(n).midi];
      if (!k) throw new Error('La nota ' + n + ' está fuera del teclado dibujado');
      let y = k.black ? TOP + BH - 40 : TOP + BH + 56;
      if (f === 1) y += k.black ? 16 : 32;
      if (f === 5 && !k.black) y += 8;
      tips[f] = { x: k.cx, y, state: press.has(k.m) ? 'press' : 'rest' };
    }
    const assigned = Object.keys(tips).map(Number);
    if (!assigned.length) throw new Error('Mano sin dedos asignados');
    const long = assigned.filter(f => f > 1);
    const kY = long.length ? Math.max(...long.map(f => tips[f].y)) + 86 : tips[1].y + 34;
    for (let f = 1; f <= 5; f++) {
      if (tips[f]) continue;
      const lo = assigned.filter(a => a < f).pop();
      const hi = assigned.find(a => a > f);
      let x;
      if (lo != null && hi != null) x = tips[lo].x + (tips[hi].x - tips[lo].x) * (f - lo) / (hi - lo);
      else if (lo != null) x = tips[lo].x + dir * (f - lo) * HAND_SP * 1.12;
      else x = tips[hi].x + dir * (f - hi) * HAND_SP * 1.12;
      // dedo recogido: no toca, queda más corto
      tips[f] = { x, y: f === 1 ? kY + 8 : kY - 54, state: 'lift' };
    }
    return { tips, kY };
  }

  // Devuelve { svg, events, sounding } sin tocar el DOM.
  function buildKeyboard(spec) {
    const L = layout(spec.from, spec.to);
    const sides = [['L', spec.lh], ['R', spec.rh]].filter(([, h]) => h);
    const fills = {};
    const top = [];
    const onKey = [];      // etiquetas sobre las teclas que tocan las manos
    const sounding = [];

    (spec.marks || []).forEach(mk => {
      const k = L.by[parse(mk.note).midi];
      if (!k) throw new Error('La marca ' + mk.note + ' está fuera del teclado dibujado');
      fills[k.m] = mk.color || '#ef476f';
      if (mk.nolabel) return;
      const lb = label(mk.note);
      top.push({ cx: k.cx, main: mk.main || lb.main, sub: mk.sub != null ? mk.sub : (spec.solfeo ? lb.lat : ''), color: mk.ink || mk.color || '#c9184a' });
    });
    TOP = top.length ? 48 : 14;

    const hands = sides.map(([side, h]) => {
      if (!h.fingers) throw new Error('Falta "fingers" en la mano ' + side);
      const c = HAND[side];
      const notes = Object.values(h.fingers);
      const press = new Set((h.press || notes).map(n => parse(n).midi));
      notes.forEach(n => {
        const k = L.by[parse(n).midi];
        if (!k) throw new Error('La nota ' + n + ' está fuera del teclado dibujado');
        const on = press.has(k.m);
        fills[k.m] = on ? (k.black ? c.keyBlack : c.key) : c.keySoft;
        onKey.push({ k, text: label(n).main, color: c.ink, on });
      });
      press.forEach(m => sounding.push(m));
      return Object.assign({ side }, handOnKeys(side, h, press, L));
    });
    const totalH = Math.max(TOP + H + LIP + 6, ...hands.map(hd => hd.kY + 132));

    const id = 'k' + (++uid);
    let s = `<svg viewBox="0 0 ${L.width + PADX * 2} ${totalH}" style="min-width:${Math.round(L.whites * 24)}px" role="img" aria-label="${esc(spec.alt || 'Diagrama de teclado')}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">`;
    s += `<defs>
      <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".82" stop-color="#fbfaf7"/><stop offset="1" stop-color="#e9e5de"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2926"/><stop offset=".5" stop-color="#15130f"/><stop offset="1" stop-color="#050505"/></linearGradient>
      <filter id="${id}blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
      <clipPath id="${id}c"><rect x="-${PADX}" y="0" width="${L.width + PADX * 2}" height="${totalH}"/></clipPath>
    </defs>`;
    s += `<g transform="translate(${PADX},0)" clip-path="url(#${id}c)">`;
    s += `<rect x="-${PADX}" y="${TOP + H + LIP - 4}" width="${L.width + PADX * 2}" height="${totalH}" fill="#e4ddd2"/>`;
    s += `<rect x="-6" y="${TOP - 8}" width="${L.width + 12}" height="12" rx="3" fill="#2f2b27"/>`;
    // teclas blancas con volumen: cara superior + canto frontal
    L.keys.filter(k => !k.black).forEach(k => {
      const f = fills[k.m];
      s += `<rect x="${k.x + 0.6}" y="${TOP}" width="${W - 1.2}" height="${H + LIP - 2}" rx="4" fill="#cfc9bf"/>`;
      s += `<rect x="${k.x + 0.6}" y="${TOP}" width="${W - 1.2}" height="${H}" rx="4" fill="${f || `url(#${id}w)`}" stroke="#8d867b" stroke-width="1"/>`;
    });
    L.keys.filter(k => k.black).forEach(k => {
      const f = fills[k.m];
      s += `<rect x="${k.x - 1}" y="${TOP}" width="${BW + 2}" height="${BH + 6}" rx="3" fill="#000" opacity="0.25"/>`;
      s += `<rect x="${k.x}" y="${TOP}" width="${BW}" height="${BH}" rx="3" fill="${f || `url(#${id}b)`}" stroke="#000" stroke-width="1"/>`;
      s += `<rect x="${k.x + 3}" y="${TOP + BH - 16}" width="${BW - 6}" height="12" rx="2" fill="#fff" opacity="${f ? 0.25 : 0.12}"/>`;
      if (!f) s += `<rect x="${k.x + 5}" y="${TOP + 2}" width="${BW - 10}" height="${BH - 24}" rx="2" fill="#fff" opacity="0.06"/>`;
    });
    if (spec.names === 'all') {
      L.keys.filter(k => !k.black).forEach(k => {
        const letter = Object.keys(PC).find(l => PC[l] === k.m % 12);
        const isC = letter === 'C';
        s += `<text x="${k.cx}" y="${TOP + H - 22}" text-anchor="middle" font-size="${isC ? 17 : 15}" font-weight="${isC ? 800 : 600}" fill="${isC ? '#c9184a' : '#3a3530'}">${letter}</text>`;
        if (spec.solfeo) s += `<text x="${k.cx}" y="${TOP + H - 44}" text-anchor="middle" font-size="11" fill="#8a8178">${LAT[letter]}</text>`;
      });
    }
    top.forEach(t => {
      s += `<text x="${t.cx}" y="${t.sub ? 20 : 30}" text-anchor="middle" font-size="16" font-weight="800" fill="${t.color}">${esc(t.main)}</text>`;
      if (t.sub) s += `<text x="${t.cx}" y="37" text-anchor="middle" font-size="11" fill="#8a8178">${esc(t.sub)}</text>`;
    });
    // nombre de cada nota que se toca, escrito sobre su tecla (con ♯ o ♭ según la nota)
    onKey.forEach(({ k, text, color, on }) => {
      const w = k.black ? BW - 3 : 32, hgt = k.black ? 22 : 25, fs = k.black ? (text.length > 1 ? 11.5 : 13) : 16;
      const y = k.black ? TOP + 12 : TOP + BH + 8;
      s += `<g opacity="${on ? 1 : 0.6}"><rect x="${(k.cx - w / 2).toFixed(1)}" y="${y}" width="${w}" height="${hgt}" rx="${k.black ? 5 : 8}" fill="#fff" stroke="${color}" stroke-width="1.6"/>`;
      s += `<text x="${k.cx}" y="${y + hgt / 2 + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="${color}">${esc(text)}</text></g>`;
    });
    hands.forEach(hd => { s += realisticHand(hd.side, hd.tips, hd.kY, totalH, id, { clamp: [0, L.width] }); });
    s += '</g></svg>';

    const step = spec.tempo || 0.45;
    let events = null;
    if (spec.seq) {
      events = spec.seq.map((st, i) => {
        const notes = [].concat(st).map(midi);
        const t = spec.swing ? Math.floor(i / 2) * 2 * step + (i % 2 ? step * 4 / 3 : 0) : i * step;
        return { t, notes, dur: Math.max(0.9, step * 2) };
      });
    } else if (sounding.length) {
      events = [{ t: 0, notes: sounding, dur: 2.2 }];
    }
    return { svg: s, events, sounding };
  }

  // Numeración de los dedos: las dos manos abiertas, vistas desde arriba.
  function buildFingers() {
    const Wd = 600, Hd = 330, kY = 176;
    const id = 'f' + (++uid);
    let s = `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="Numeración de los dedos de ambas manos" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">`;
    s += `<defs><filter id="${id}blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter></defs>`;
    const rise = { 2: 96, 3: 110, 4: 100, 5: 78 };
    [['L', 165], ['R', 435]].forEach(([side, hc]) => {
      const dir = side === 'R' ? 1 : -1;
      const tips = {};
      [2, 3, 4, 5].forEach(f => { tips[f] = { x: hc + dir * (f - 3.5) * HAND_SP * 1.3, y: kY - rise[f], state: 'press' }; });
      tips[1] = { x: hc - dir * 118, y: kY + 14, state: 'press' };
      s += realisticHand(side, tips, kY, Hd, id, { clamp: [0, Wd] });
    });
    return s + '</svg>';
  }

  // ---------------------------------------------------------------- progresiones
  function buildProg(spec) {
    if (!Array.isArray(spec.chords) || !spec.chords.length) throw new Error('La progresión necesita "chords"');
    const bpm = spec.bpm || 80, beat = 60 / bpm;
    const slotTime = k => (spec.swing ? Math.floor(k / 2) * beat + (k % 2 ? beat * 2 / 3 : 0) : k * beat / 2);
    const chords = spec.chords.map(c => {
      const o = typeof c === 'string' ? { name: c } : Object.assign({}, c);
      const info = parseChord(o.name);
      const v = voicing(o.name);
      o.info = info;
      o.rhM = (o.rh ? o.rh.map(midi) : v.rh).slice().sort((a, b) => a - b);
      o.bassM = o.bass ? midi(o.bass) : v.bass;
      o.lhM = o.lh ? o.lh.map(n => (Array.isArray(n) ? n.map(midi) : midi(n))) : null;
      o.beats = o.beats || spec.beats || 4;
      const slots = o.beats * 2;
      const pat = o.pattern || spec.pattern || ('X' + '.'.repeat(slots - 1));
      o.pat = pat.replace(/\s/g, '').padEnd(slots, '.').slice(0, slots);
      return o;
    });

    const events = [];
    const loops = spec.loop || 1;
    let slot0 = 0;
    for (let r = 0; r < loops; r++) {
      chords.forEach((o, ci) => {
        let li = 0;
        const hits = [];
        [...o.pat].forEach((ch, k) => {
          let lh = [], rh = [];
          if (ch === 'X') { lh = [o.bassM]; rh = o.rhM; }
          else if (ch === 'B') lh = [o.bassM];
          else if (ch === 'O') lh = [o.bassM + 12];
          else if (ch === 'C') rh = o.rhM;
          else if (/[1-4]/.test(ch)) rh = [o.rhM[Math.min(+ch - 1, o.rhM.length - 1)]];
          else if (ch === 'L' || ch === 'M') {
            if (!o.lhM) throw new Error('Patrón con ' + ch + ' pero sin "lh" en ' + o.name);
            lh = [].concat(o.lhM[li++ % o.lhM.length]);
            if (ch === 'M') rh = o.rhM;
          }
          else if (ch !== '.' && ch !== '-') throw new Error('Letra de patrón desconocida: ' + ch);
          if (lh.length || rh.length) hits.push({ k, lh, rh });
        });
        const end = slot0 + o.pat.length;
        // Cada mano mantiene su nota hasta que esa misma mano vuelve a tocar (o acaba el acorde).
        const until = (i, part) => {
          for (let j = i + 1; j < hits.length; j++) if (hits[j][part].length) return hits[j].k;
          return o.pat.length;
        };
        hits.forEach((hit, i) => {
          const t = slotTime(slot0 + hit.k);
          const d = part => Math.max(0.22, slotTime(slot0 + until(i, part)) - t + 0.08);
          const dl = d('lh'), dr = d('rh');
          const notes = [...hit.lh, ...hit.rh];
          const durs = [...hit.lh.map(() => dl), ...hit.rh.map(() => dr)];
          events.push({ t, notes, dur: Math.max(...durs), durs, chord: ci });
        });
        if (!hits.length) events.push({ t: slotTime(slot0), notes: [], dur: 0, chord: ci });
        slot0 = end;
      });
    }

    let html = '<div class="prog-row">';
    chords.forEach((o, i) => {
      if (i && spec.arrows !== false) html += '<span class="prog-arrow" aria-hidden="true">→</span>';
      const num = spec.nums ? spec.nums[i] : o.num;
      html += `<div class="pchip ${o.info.type}" data-i="${i}"><b>${esc(pretty(o.name))}</b>${num ? `<small>${esc(num)}</small>` : ''}</div>`;
    });
    html += '</div>';
    if (spec.grid) html += patternGrid(chords[0].pat, spec.swing);
    return { html, events, chords };
  }

  // Rejilla de corcheas: qué hace cada mano en cada tiempo del compás.
  function patternGrid(pat, swing) {
    const counts = [];
    for (let i = 0; i < pat.length; i++) counts.push(i % 2 ? 'y' : String(i / 2 + 1));
    const rh = ch => (/[XC1-4]/.test(ch) ? (/[1-4]/.test(ch) ? ch : '●') : '');
    const rhM = ch => (ch === 'M' ? '●' : rh(ch));
    const lh = ch => (/[XBOLM]/.test(ch) ? (ch === 'O' ? '↑' : '●') : '');
    const row = (name, cls, f) => `<div class="pg-name ${cls}">${name}</div>` + [...pat].map(ch => { const v = f(ch); return `<div class="pg-cell ${v ? 'on ' + cls : ''}">${v}</div>`; }).join('');
    return `<div class="pgrid" style="--n:${pat.length}">` +
      '<div class="pg-name"></div>' + counts.map(c => `<div class="pg-count${c === 'y' ? ' off' : ''}">${c}</div>`).join('') +
      row('MD', 'rh', rhM) + row('MI', 'lh', lh) + '</div>' +
      (swing ? '<p class="pg-note">Swing: la “y” se retrasa, largo-corto, como un galope.</p>' : '');
  }

  // ---------------------------------------------------------------- círculo de quintas
  const MAJ = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  const MIN = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];
  function buildCircle(spec) {
    const rings = spec.rings || [MAJ, MIN];
    const S = 540, C0 = S / 2, radii = [212, 146, 88], nodeR = [27, 23, 19];
    const hl = spec.highlight ? new Set(spec.highlight) : null;
    const pos = {};
    const id = 'ar' + (++uid);
    let s = `<svg viewBox="0 0 ${S} ${S}" style="min-width:300px" role="img" aria-label="${esc(spec.alt || 'Círculo de quintas')}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">`;
    s += `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#1d1a2e"/></marker></defs>`;
    rings.forEach((ring, ri) => {
      if (ring.length !== 12) throw new Error('Cada anillo necesita 12 etiquetas');
      s += `<circle cx="${C0}" cy="${C0}" r="${radii[ri]}" fill="none" stroke="#e7dfd1" stroke-width="1.5"/>`;
    });
    rings.forEach((ring, ri) => {
      ring.forEach((lab, i) => {
        const a = (i * 30 - 90) * Math.PI / 180;
        const x = C0 + radii[ri] * Math.cos(a), y = C0 + radii[ri] * Math.sin(a);
        if (!(lab in pos)) pos[lab] = { x, y, r: nodeR[ri] };
        if (!lab) return;
        const type = parseChord(lab).type;
        const on = !hl || hl.has(lab);
        const col = TYPE_COLOR[type];
        s += `<circle cx="${pt(x, y).split(' ')[0]}" cy="${y.toFixed(1)}" r="${nodeR[ri]}" fill="${on ? col : '#f3ece0'}" stroke="${on ? '#1d1a2e' : '#d9cfbf'}" stroke-width="${on ? 2 : 1}"/>`;
        s += `<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-size="${ri ? 13 : 15}" font-weight="800" fill="${on ? '#1d1a2e' : '#a39a8c'}">${esc(pretty(lab))}</text>`;
      });
    });
    (spec.arrows || []).forEach(ar => {
      const [from, to, style] = ar;
      const A = pos[from], B = pos[to];
      if (!A || !B) throw new Error('Flecha con acorde que no está en el círculo: ' + from + ' → ' + to);
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
      const ax = A.x + dx / L * (A.r + 3), ay = A.y + dy / L * (A.r + 3);
      const bx = B.x - dx / L * (B.r + 5), by = B.y - dy / L * (B.r + 5);
      // entre vecinos del mismo anillo la curva va hacia fuera; entre anillos, hacia el centro
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const sameRing = Math.abs(Math.hypot(A.x - C0, A.y - C0) - Math.hypot(B.x - C0, B.y - C0)) < 1;
      const k = sameRing ? -0.16 : 0.18;
      const qx = mx + (C0 - mx) * k, qy = my + (C0 - my) * k;
      const dash = style === 'dashed' ? ' stroke-dasharray="6 5"' : '';
      const both = style === 'both' ? ` marker-start="url(#${id})"` : '';
      s += `<path d="M${pt(ax, ay)} Q${pt(qx, qy)} ${pt(bx, by)}" fill="none" stroke="#1d1a2e" stroke-width="2.4"${dash} marker-end="url(#${id})"${both}/>`;
    });
    if (spec.center) s += `<text x="${C0}" y="${C0 + 8}" text-anchor="middle" font-size="22" font-weight="800" font-family="'Fraunces', Georgia, serif" fill="#1d1a2e">${esc(spec.center)}</text>`;
    return s + '</svg>';
  }

  const API = { parse, midi, label, parseChord, chordType, voicing, layout, buildKeyboard, buildFingers, buildProg, buildCircle, patternGrid, pretty, SHARPS, MAJ, MIN, TYPE_COLOR };

  // ================================================================= navegador
  if (typeof document === 'undefined') {
    if (typeof module === 'object' && module.exports) module.exports = API;
    return;
  }

  // Audio: timbre sencillo tipo piano eléctrico, sin muestras externas.
  let ctx = null;
  const audio = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());
  function tone(out, m, t, dur, vol) {
    const f = 440 * Math.pow(2, (m - 69) / 12);
    const g = ctx.createGain();
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o1.type = 'triangle'; o1.frequency.value = f;
    o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.25;
    o1.connect(g); o2.connect(g2).connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  // Reproduce eventos {t, notes, dur}; devuelve un objeto para pararlos.
  function play(events, onEvent) {
    audio();
    const out = ctx.createGain();
    out.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.06;
    const timers = [];
    events.forEach(ev => {
      ev.notes.forEach((m, i) => tone(out, m, t0 + ev.t, ev.durs ? ev.durs[i] : ev.dur, 0.28 / Math.sqrt(ev.notes.length)));
      if (onEvent) timers.push(setTimeout(() => onEvent(ev), (ev.t + 0.06) * 1000));
    });
    const total = Math.max(...events.map(e => e.t + e.dur)) || 0;
    return {
      total,
      stop() { timers.forEach(clearTimeout); try { out.disconnect(); } catch (e) { /* ya parado */ } }
    };
  }

  function addPlayer(fig, events, text, onEvent, onEnd) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'play';
    const idle = '<span aria-hidden="true">▶</span> ' + esc(text || 'Escuchar');
    b.innerHTML = idle;
    let cur = null, endTimer = null;
    const reset = () => { cur = null; b.innerHTML = idle; clearTimeout(endTimer); if (onEnd) onEnd(); };
    b.addEventListener('click', () => {
      if (cur) { cur.stop(); return reset(); }
      cur = play(events, onEvent);
      b.innerHTML = '<span aria-hidden="true">■</span> Parar';
      endTimer = setTimeout(reset, (cur.total + 0.1) * 1000);
    });
    fig.insertBefore(b, fig.querySelector('figcaption'));
  }

  // Coloca el contenido dentro de la figura, debajo de su título si lo tiene.
  function mount(fig, html, cls) {
    const wrap = document.createElement('div');
    wrap.className = cls || 'kbd-scroll';
    wrap.innerHTML = html;
    const title = fig.querySelector('.fig-title');
    if (title) title.after(wrap);
    else fig.prepend(wrap);
    return wrap;
  }

  function renderKeyboard(fig, spec) {
    spec.alt = spec.alt || fig.dataset.alt;
    const r = buildKeyboard(spec);
    mount(fig, r.svg);
    if (r.events && spec.play !== false) addPlayer(fig, r.events, spec.playLabel);
  }

  function renderProg(fig, spec) {
    const r = buildProg(spec);
    const wrap = mount(fig, r.html, 'prog');
    const chips = [...wrap.querySelectorAll('.pchip')];
    const light = i => chips.forEach((c, j) => c.classList.toggle('on', j === i));
    addPlayer(fig, r.events, spec.playLabel || 'Escuchar la progresión', ev => light(ev.chord), () => light(-1));
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
    let bpm = +el.dataset.bpm || 60, timer = null, next = 0, beat = 0;
    const beats = +el.dataset.beats || 4;
    el.classList.add('metro');
    el.innerHTML =
      '<button type="button" class="metro-go" aria-label="Iniciar o parar el metrónomo">▶</button>' +
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

  // ---------- Temario y navegación (desde assets/curso-data.js) ----------
  function renderTemario(el) {
    const C = window.CURSO;
    if (!C) return;
    el.classList.add('modules');
    el.innerHTML = C.modules.map(m => `
      <article class="module">
        <div class="module-head" style="--m1:${m.c1};--m2:${m.c2}">
          <span class="num">${m.n}</span>
          <div><h3>${esc(m.title)}</h3><p>${esc(m.sub)}</p></div>
        </div>
        <ol class="lessons">${m.lessons.map(l => {
          const inner = `<span class="ln">${String(l.n).padStart(2, '0')}</span><span class="lt">${esc(l.title)}<span class="ld">${esc(l.desc)}</span></span>` +
            (l.ready ? '<span class="badge go">Disponible</span>' : '<span class="badge soon">Próximamente</span>');
          return `<li>${l.ready ? `<a href="lecciones/${l.file}.html">${inner}</a>` : `<span>${inner}</span>`}</li>`;
        }).join('')}</ol>
      </article>`).join('');
  }
  function renderPager(el) {
    const C = window.CURSO;
    if (!C) return;
    const n = +el.dataset.pager;
    const prev = C.lessons.find(l => l.n === n - 1), next = C.lessons.find(l => l.n === n + 1);
    const prevHtml = prev
      ? `<a href="${prev.file}.html"><small>← Lección ${prev.n}</small>${esc(prev.title)}</a>`
      : '<a href="../index.html"><small>← Volver</small>Temario del curso</a>';
    let nextHtml;
    if (next && next.ready) nextHtml = `<a class="next" href="${next.file}.html"><small>Lección ${next.n} →</small>${esc(next.title)}</a>`;
    else if (next) nextHtml = `<span class="next"><small>Próxima lección</small>${next.n} · ${esc(next.title)}</span>`;
    else nextHtml = '<a class="next" href="../index.html"><small>Fin del curso 🎉</small>Volver al temario</a>';
    el.innerHTML = prevHtml + nextHtml;
  }

  function init() {
    document.querySelectorAll('[data-kbd]').forEach(fig => run(fig, () => renderKeyboard(fig, JSON.parse(fig.dataset.kbd))));
    document.querySelectorAll('[data-prog]').forEach(fig => run(fig, () => renderProg(fig, JSON.parse(fig.dataset.prog))));
    document.querySelectorAll('[data-circle]').forEach(fig => run(fig, () => {
      const spec = JSON.parse(fig.dataset.circle);
      spec.alt = spec.alt || fig.dataset.alt;
      mount(fig, buildCircle(spec));
    }));
    document.querySelectorAll('[data-fingers]').forEach(fig => mount(fig, buildFingers()));
    document.querySelectorAll('[data-metro]').forEach(renderMetro);
    document.querySelectorAll('[data-temario]').forEach(renderTemario);
    document.querySelectorAll('[data-pager]').forEach(renderPager);

    // Casillas de "lo tengo": se recuerdan en este navegador, si se puede.
    document.querySelectorAll('input[type=checkbox][data-save]').forEach(cb => {
      const key = 'piano:' + cb.dataset.save;
      try { cb.checked = localStorage.getItem(key) === '1'; } catch (e) { /* sin almacenamiento */ }
      cb.addEventListener('change', () => {
        try { localStorage.setItem(key, cb.checked ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
      });
    });

    const bar = document.querySelector('.progress');
    if (bar) {
      const upd = () => {
        const h = document.documentElement.scrollHeight - innerHeight;
        bar.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + '%';
      };
      addEventListener('scroll', upd, { passive: true });
      upd();
    }
  }
  function run(fig, fn) {
    try { fn(); } catch (e) { fig.insertAdjacentHTML('afterbegin', `<p class="err">Error en el diagrama: ${esc(e.message)}</p>`); }
  }

  root.Piano = API;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
