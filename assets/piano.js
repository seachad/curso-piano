/*
 * Motor de diagramas del curso (sin dependencias). Todo se declara en el HTML:
 *
 * 1) Teclado con manos
 *   <figure class="kbd" data-chord="C" data-kbd='{"from":"B2","to":"A4",
 *        "lh":{"fingers":{"5":"C3"}},
 *        "rh":{"fingers":{"1":"C4","3":"E4","5":"G4"}}}'>
 *     <p class="fig-title">…</p><figcaption>…</figcaption>
 *   </figure>
 *   - fingers: dedo (1 pulgar … 5 meñique) -> nota. Dedos sin nota = en el aire.
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
 *   - chords: nombres ("C", "Am", "G7", "C/E"…) u objetos {name, rh:[notas], bass:"C3", lh:[notas], beats, pattern}.
 *     Si no das rh/bass se genera una posición cerrada cerca del C central.
 *   - pattern: una letra por corchea: X bajo+acorde · B bajo · O bajo una octava arriba · C acorde
 *     · 1-4 nota n del acorde (de grave a agudo) · L siguiente nota de "lh" · . silencio/mantener.
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

  const W = 40, H = 190, BW = 24, BH = 118, TOP = 48, PADX = 12, HANDH = 150;
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LAT = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const BLACK = new Set([1, 3, 6, 8, 10]);
  const SKIN = '#f1d0b2', SKIN_LINE = '#b3845f';
  const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const HAND = {
    R: { key: '#a9b4f5', keySoft: '#e3e7fd', keyBlack: '#4f5bd5', ink: '#3b46b8', name: 'Mano derecha' },
    L: { key: '#fbc58e', keySoft: '#feebd8', keyBlack: '#e0771a', ink: '#b85a0a', name: 'Mano izquierda' }
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

  // Dedo: se estrecha desde el nudillo (semiancho a) hasta la yema redondeada (semiancho b),
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
    return `M${pt(px + nx * w, py + ny * w)} Q${pt(px + dx / L * 2.5, py + dy / L * 2.5)} ${pt(px - nx * w, py - ny * w)}`;
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
    // Contorno: todo con trazo grueso y encima el relleno, así las piezas se funden en una sola silueta.
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
      s += `<text x="${cx}" y="${py + 74}" text-anchor="middle" font-size="14" font-weight="700" fill="${c.ink}">${c.name}</text>`;
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
    if (!assigned.length) throw new Error('Mano sin dedos asignados');
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

  // Devuelve { svg, events, sounding } sin tocar el DOM.
  function buildKeyboard(spec) {
    const L = layout(spec.from, spec.to);
    const sides = [['L', spec.lh], ['R', spec.rh]].filter(([, h]) => h);
    const totalH = TOP + H + (sides.length ? HANDH : 10);
    const fills = {};
    const top = [];
    const sounding = [];

    (spec.marks || []).forEach(mk => {
      const k = L.by[parse(mk.note).midi];
      if (!k) throw new Error('La marca ' + mk.note + ' está fuera del teclado dibujado');
      fills[k.m] = mk.color || '#ef476f';
      if (mk.nolabel) return;
      const lb = label(mk.note);
      top.push({ cx: k.cx, main: mk.main || lb.main, sub: mk.sub != null ? mk.sub : (spec.solfeo ? lb.lat : ''), color: mk.ink || mk.color || '#c9184a' });
    });

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
        const lb = label(n);
        top.push({ cx: k.cx, main: lb.main, sub: spec.solfeo ? lb.lat : '', color: c.ink, faded: !on });
      });
      press.forEach(m => sounding.push(m));
      return { side, h, press };
    });

    let s = `<svg viewBox="0 0 ${L.width + PADX * 2} ${totalH}" style="min-width:${Math.round(L.whites * 21)}px" role="img" aria-label="${esc(spec.alt || 'Diagrama de teclado')}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">`;
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

  function buildFingers() {
    const Wd = 600, Hd = 300, py = 150;
    const rel = { 1: [-102, -30], 2: [-50, -105], 3: [-12, -128], 4: [26, -114], 5: [62, -78] };
    let s = `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="Numeración de los dedos de ambas manos" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">`;
    [['L', 170], ['R', 430]].forEach(([side, pcx]) => {
      const dir = side === 'R' ? 1 : -1;
      const tips = {};
      for (let f = 1; f <= 5; f++) tips[f] = { x: pcx + dir * rel[f][0], y: py + rel[f][1], on: true, pressed: true };
      s += handShape(side, tips, { left: pcx - 65, py, pw: 130 }, true);
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
      o.lhM = o.lh ? o.lh.map(midi) : null;
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
          let notes = null;
          if (ch === 'X') notes = [o.bassM, ...o.rhM];
          else if (ch === 'B') notes = [o.bassM];
          else if (ch === 'O') notes = [o.bassM + 12];
          else if (ch === 'C') notes = o.rhM;
          else if (/[1-4]/.test(ch)) notes = [o.rhM[Math.min(+ch - 1, o.rhM.length - 1)]];
          else if (ch === 'L') { if (!o.lhM) throw new Error('Patrón con L pero sin "lh" en ' + o.name); notes = [o.lhM[li++ % o.lhM.length]]; }
          else if (ch !== '.' && ch !== '-') throw new Error('Letra de patrón desconocida: ' + ch);
          if (notes) hits.push({ k, notes });
        });
        const end = slot0 + o.pat.length;
        hits.forEach((hit, i) => {
          const nextK = i + 1 < hits.length ? hits[i + 1].k : o.pat.length;
          const t = slotTime(slot0 + hit.k);
          const dur = Math.max(0.22, slotTime(slot0 + nextK) - t + 0.08);
          events.push({ t, notes: hit.notes, dur, chord: ci });
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
    const lh = ch => (/[XBOL]/.test(ch) ? (ch === 'O' ? '↑' : '●') : '');
    const row = (name, cls, f) => `<div class="pg-name ${cls}">${name}</div>` + [...pat].map(ch => { const v = f(ch); return `<div class="pg-cell ${v ? 'on ' + cls : ''}">${v}</div>`; }).join('');
    return `<div class="pgrid" style="--n:${pat.length}">` +
      '<div class="pg-name"></div>' + counts.map(c => `<div class="pg-count${c === 'y' ? ' off' : ''}">${c}</div>`).join('') +
      row('MD', 'rh', rh) + row('MI', 'lh', lh) + '</div>' +
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
      // curva ligeramente hacia el centro
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const qx = mx + (C0 - mx) * 0.18, qy = my + (C0 - my) * 0.18;
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
      ev.notes.forEach(m => tone(out, m, t0 + ev.t, ev.dur, 0.28 / Math.sqrt(ev.notes.length)));
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
