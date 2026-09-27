/*
 * Motor de diagramas del curso (sin dependencias). Todo se declara en el HTML:
 *
 * 1) Teclado con manos
 *   <figure class="kbd" data-chord="C" data-kbd='{"from":"B2","to":"A4",
 *        "lh":{"fingers":{"5":"C3"}},
 *        "rh":{"fingers":{"1":"C4","3":"E4","5":"G4"}}}'>
 *     <p class="fig-title">…</p><figcaption>…</figcaption>
 *   </figure>
 *   - fingers: dedo (1 pulgar … 5 meñique) -> nota. Sobre cada tecla: nombre de la nota y número del dedo; debajo, leyenda con la mano.
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

  const W = 40, H = 210, BW = 24, BH = 128, PADX = 12, LIP = 12;
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

  // ---------------------------------------------------------------- icono de mano (leyenda)
  // Mano plana, estilo icono, vista desde arriba con la palma hacia las teclas. Solo sirve de referencia
  // para la numeración de los dedos; la digitación exacta va escrita sobre cada tecla.
  const ICON_W = 108, ICON_H = 118;
  const ICON = {
    palm: { x: 22, y: 60, w: 64, h: 80 },
    fingers: { 2: [31, 70, 20], 3: [47, 70, 9], 4: [63, 70, 15], 5: [78, 74, 32] },  // x, base y, punta y
    thumb: [[30, 100], [8, 70]]                                                        // base, punta
  };
  const ICON_COL = {
    R: { fill: '#cfd4fc', line: '#3b46b8' },
    L: { fill: '#fdd9b5', line: '#b85a0a' }
  };
  function handIcon(side, scale, big) {
    const k = scale || 1, c = ICON_COL[side], ink = HAND[side].ink;
    const X = x => (side === 'R' ? x : ICON_W - x) * k, Y = y => y * k;
    const { palm, fingers, thumb } = ICON;
    const seg = (x1, y1, x2, y2, w) => `M${pt(X(x1), Y(y1))} L${pt(X(x2), Y(y2))}`;
    const parts = [];
    Object.keys(fingers).forEach(f => { const [x, b, t] = fingers[f]; parts.push([seg(x, b, x, t + 7), f === '5' ? 13 : 15]); });
    parts.push([seg(thumb[0][0], thumb[0][1], thumb[1][0], thumb[1][1]), 16]);
    const px = side === 'R' ? palm.x : ICON_W - palm.x - palm.w;
    let s = `<svg viewBox="0 0 ${(ICON_W * k).toFixed(0)} ${(ICON_H * k).toFixed(0)}" width="${(ICON_W * k).toFixed(0)}" height="${(ICON_H * k).toFixed(0)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" font-family="${FONT}">`;
    // contorno y relleno fundidos en una sola silueta
    s += `<g stroke-linecap="round" fill="none">`;
    s += `<rect x="${(px * k - 1.5 * k).toFixed(1)}" y="${Y(palm.y - 1.5)}" width="${((palm.w + 3) * k).toFixed(1)}" height="${Y(palm.h)}" rx="${Y(20)}" fill="${c.line}"/>`;
    parts.forEach(([d, w]) => { s += `<path d="${d}" stroke="${c.line}" stroke-width="${((w + 3) * k).toFixed(1)}"/>`; });
    s += `<rect x="${(px * k).toFixed(1)}" y="${Y(palm.y)}" width="${(palm.w * k).toFixed(1)}" height="${Y(palm.h)}" rx="${Y(19)}" fill="${c.fill}"/>`;
    parts.forEach(([d, w]) => { s += `<path d="${d}" stroke="${c.fill}" stroke-width="${(w * k).toFixed(1)}"/>`; });
    s += '</g>';
    const tip = f => (f === 1 ? { x: thumb[1][0], y: thumb[1][1] } : { x: fingers[f][0], y: fingers[f][2] + 7 });
    for (let f = 1; f <= 5; f++) {
      const p = tip(f), r = (big ? 8.5 : 7.5) * k;
      s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${r.toFixed(1)}" fill="${ink}"/>`;
      s += `<text x="${X(p.x).toFixed(1)}" y="${(Y(p.y) + r * 0.42).toFixed(1)}" text-anchor="middle" font-size="${(r * 1.25).toFixed(1)}" font-weight="800" fill="#fff">${f}</text>`;
    }
    return s + '</svg>';
  }
  function handLegend(sides) {
    return '<div class="hand-legend">' + sides.map(side =>
      `<span class="hl-item ${side === 'R' ? 'rh' : 'lh'}">${handIcon(side, 0.52)}<span><b>${HAND[side].name}</b><small>1 pulgar · 5 meñique</small></span></span>`
    ).join('') + '</div>';
  }

  // Devuelve { svg, legend, events, sounding } sin tocar el DOM.
  function buildKeyboard(spec) {
    const L = layout(spec.from, spec.to);
    const sides = [['L', spec.lh], ['R', spec.rh]].filter(([, h]) => h);
    const fills = {};
    const top = [];
    const marksOnKeys = [];   // { k, name, finger, side, on }
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

    sides.forEach(([side, h]) => {
      if (!h.fingers) throw new Error('Falta "fingers" en la mano ' + side);
      const c = HAND[side];
      const notes = Object.values(h.fingers);
      const press = new Set((h.press || notes).map(n => parse(n).midi));
      Object.keys(h.fingers).forEach(f => {
        const n = h.fingers[f];
        const k = L.by[parse(n).midi];
        if (!k) throw new Error('La nota ' + n + ' está fuera del teclado dibujado');
        const on = press.has(k.m);
        fills[k.m] = on ? (k.black ? c.keyBlack : c.key) : c.keySoft;
        marksOnKeys.push({ k, name: label(n).main, finger: f, side, on });
      });
      press.forEach(m => sounding.push(m));
    });
    const totalH = TOP + H + LIP + 6;

    const id = 'k' + (++uid);
    let s = `<svg viewBox="0 0 ${L.width + PADX * 2} ${totalH}" role="img" aria-label="${esc(spec.alt || 'Diagrama de teclado')}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">`;
    s += `<defs>
      <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".82" stop-color="#fbfaf7"/><stop offset="1" stop-color="#e9e5de"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2926"/><stop offset=".5" stop-color="#15130f"/><stop offset="1" stop-color="#050505"/></linearGradient>
    </defs>`;
    s += `<g transform="translate(${PADX},0)">`;
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
      s += `<rect x="${k.x + 3}" y="${TOP + BH - 12}" width="${BW - 6}" height="9" rx="2" fill="#fff" opacity="${f ? 0.25 : 0.12}"/>`;
      if (!f) s += `<rect x="${k.x + 5}" y="${TOP + 2}" width="${BW - 10}" height="${BH - 20}" rx="2" fill="#fff" opacity="0.06"/>`;
    });
    if (spec.names === 'all') {
      L.keys.filter(k => !k.black).forEach(k => {
        if (marksOnKeys.some(mk => mk.k === k)) return;
        const letter = Object.keys(PC).find(l => PC[l] === k.m % 12);
        const isC = letter === 'C';
        s += `<text x="${k.cx}" y="${TOP + H - 20}" text-anchor="middle" font-size="${isC ? 17 : 15}" font-weight="${isC ? 800 : 600}" fill="${isC ? '#c9184a' : '#3a3530'}">${letter}</text>`;
        if (spec.solfeo) s += `<text x="${k.cx}" y="${TOP + H - 42}" text-anchor="middle" font-size="11" fill="#8a8178">${LAT[letter]}</text>`;
      });
    }
    top.forEach(t => {
      s += `<text x="${t.cx}" y="${t.sub ? 20 : 30}" text-anchor="middle" font-size="16" font-weight="800" fill="${t.color}">${esc(t.main)}</text>`;
      if (t.sub) s += `<text x="${t.cx}" y="37" text-anchor="middle" font-size="11" fill="#8a8178">${esc(t.sub)}</text>`;
    });
    // Sobre cada tecla tocada: nombre de la nota (con ♯/♭) y número del dedo en un círculo del color de la mano.
    marksOnKeys.forEach(({ k, name, finger, side, on }) => {
      const ink = HAND[side].ink;
      const op = on ? 1 : 0.55;
      if (k.black) {
        const fs = name.length > 1 ? 11.5 : 13;
        s += `<g opacity="${op}"><rect x="${k.x + 1.5}" y="${TOP + 8}" width="${BW - 3}" height="22" rx="5" fill="#fff" stroke="${ink}" stroke-width="1.5"/>`;
        s += `<text x="${k.cx}" y="${TOP + 19 + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="${ink}">${esc(name)}</text>`;
        s += `<circle cx="${k.cx}" cy="${TOP + BH - 28}" r="10.5" fill="${on ? ink : '#fff'}" stroke="#fff" stroke-width="2"/>`;
        s += `<text x="${k.cx}" y="${TOP + BH - 23.5}" text-anchor="middle" font-size="13" font-weight="800" fill="${on ? '#fff' : ink}">${finger}</text></g>`;
      } else {
        s += `<g opacity="${op}"><rect x="${k.cx - 16}" y="${TOP + BH + 10}" width="32" height="25" rx="8" fill="#fff" stroke="${ink}" stroke-width="1.6"/>`;
        s += `<text x="${k.cx}" y="${TOP + BH + 28}" text-anchor="middle" font-size="16" font-weight="800" fill="${ink}">${esc(name)}</text>`;
        s += `<circle cx="${k.cx}" cy="${TOP + H - 30}" r="14.5" fill="${on ? ink : '#fff'}" stroke="${on ? '#fff' : ink}" stroke-width="2.5"/>`;
        s += `<text x="${k.cx}" y="${TOP + H - 24}" text-anchor="middle" font-size="17" font-weight="800" fill="${on ? '#fff' : ink}">${finger}</text></g>`;
      }
    });
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
    return { svg: s, legend: sides.length ? handLegend(sides.map(([side]) => side)) : '', events, sounding };
  }

  // ---------------------------------------------------------------- pantallas estrechas
  // Si el teclado no cabe con al menos ~30 px por tecla blanca, se parte en trozos que sí caben:
  // un teclado por mano (con un mini-mapa del conjunto) o, en los mapas sin manos, una fila por octava.
  const whiteName = m => { const l = Object.keys(PC).find(k => PC[k] === ((m % 12) + 12) % 12); return l + (Math.floor(m / 12) - 1); };
  const whitesIn = (lo, hi) => { let n = 0; for (let m = lo; m <= hi; m++) if (!BLACK.has(((m % 12) + 12) % 12)) n++; return n; };
  const whiteBelow = m => { m--; while (BLACK.has(((m % 12) + 12) % 12)) m--; return m; };
  const whiteAbove = m => { m++; while (BLACK.has(((m % 12) + 12) % 12)) m++; return m; };

  // Rango con una tecla blanca de margen a cada lado y, si es muy corto, ampliado hasta minW teclas.
  function padRange(lo, hi, minW) {
    let a = whiteBelow(lo), b = whiteAbove(hi), side = 0;
    while (whitesIn(a, b) < minW) { if (side++ % 2) a = whiteBelow(a); else b = whiteAbove(b); }
    return { a, b };
  }

  function segmentSpecs(spec, maxW) {
    const L = layout(spec.from, spec.to);
    if (L.whites <= maxW) return null;
    const M = n => parse(n).midi;
    const marks = spec.marks || [];
    const hands = [['lh', spec.lh], ['rh', spec.rh]].filter(([, h]) => h);
    let groups = [];
    if (hands.length) {
      groups = hands.map(([k, h]) => { const ms = Object.values(h.fingers).map(M); return { hands: [k], lo: Math.min(...ms), hi: Math.max(...ms) }; })
        .sort((x, y) => x.lo - y.lo);
      // las teclas marcadas se unen al trozo de la mano más cercana, para que no se pierdan
      marks.forEach(mk => {
        const m = M(mk.note);
        const g = groups.reduce((best, x) => (Math.max(x.lo - m, m - x.hi, 0) < Math.max(best.lo - m, m - best.hi, 0) ? x : best));
        g.lo = Math.min(g.lo, m); g.hi = Math.max(g.hi, m);
      });
      const merged = [groups[0]];
      groups.slice(1).forEach(g => {
        const last = merged[merged.length - 1];
        if (whitesIn(last.lo, Math.max(last.hi, g.hi)) + 2 <= maxW) { last.hands.push(...g.hands); last.hi = Math.max(last.hi, g.hi); }
        else merged.push(g);
      });
      groups = merged;
    } else if (marks.length) {
      const ms = marks.map(mk => M(mk.note));
      const lo = Math.min(...ms), hi = Math.max(...ms);
      if (whitesIn(lo, hi) + 2 <= maxW) groups = [{ hands: [], lo, hi }];
    }
    let ranges;
    if (groups.length) {
      ranges = groups.map(g => Object.assign({ hands: g.hands }, padRange(g.lo, g.hi, Math.min(7, maxW))));
    } else {
      // mapa sin manos: una fila por octava (de C a B), uniendo trozos sueltos muy cortos
      const a0 = parse(spec.from).midi, b0 = parse(spec.to).midi;
      ranges = [];
      let start = a0;
      for (let m = a0 + 1; m <= b0; m++) {
        if (m % 12 === 0) { ranges.push({ hands: [], a: start, b: m - 1 }); start = m; }
      }
      ranges.push({ hands: [], a: start, b: b0 });
      const out = [];
      ranges.forEach(r => {
        const prev = out[out.length - 1];
        if (prev && (whitesIn(r.a, r.b) < 3 || whitesIn(prev.a, prev.b) < 3) && whitesIn(prev.a, r.b) <= maxW + 1) prev.b = r.b;
        else out.push(r);
      });
      ranges = out;
    }
    return ranges.map(r => {
      const inR = n => { const m = M(n); return m >= r.a && m <= r.b; };
      const seg = Object.assign({}, spec, { from: whiteName(r.a), to: whiteName(r.b), play: false, seq: undefined });
      seg.marks = marks.filter(mk => inR(mk.note));
      if (hands.length) { seg.lh = r.hands.includes('lh') ? spec.lh : undefined; seg.rh = r.hands.includes('rh') ? spec.rh : undefined; }
      const title = hands.length ? r.hands.map(k => HAND[k === 'rh' ? 'R' : 'L'].name).join(' y ') : '';
      return { spec: seg, hands: r.hands, a: r.a, b: r.b, title };
    });
  }

  // Mini-mapa: el teclado completo en pequeño, con las teclas tocadas y un marco sobre cada trozo.
  function buildMiniMap(spec, segs) {
    const L = layout(spec.from, spec.to);
    const h = 64, top = 6, fill = {};
    [['L', spec.lh], ['R', spec.rh]].forEach(([side, hd]) => {
      if (!hd) return;
      const press = new Set((hd.press || Object.values(hd.fingers)).map(n => parse(n).midi));
      Object.values(hd.fingers).forEach(n => { const m = parse(n).midi; fill[m] = press.has(m) ? HAND[side].keyBlack : HAND[side].keySoft; });
    });
    let s = `<svg class="minimap" viewBox="-4 0 ${L.width + 8} ${h + top + 8}" role="img" aria-label="Posición de cada mano en el teclado" xmlns="http://www.w3.org/2000/svg">`;
    L.keys.filter(k => !k.black).forEach(k => { s += `<rect x="${k.x + 0.5}" y="${top}" width="${W - 1}" height="${h}" rx="3" fill="${fill[k.m] || '#fff'}" stroke="#8d867b"/>`; });
    L.keys.filter(k => k.black).forEach(k => { s += `<rect x="${k.x}" y="${top}" width="${BW}" height="${h * 0.6}" rx="2" fill="${fill[k.m] || '#1c1a18'}"/>`; });
    segs.forEach(sg => {
      const x1 = L.by[sg.a] ? L.by[sg.a].x : 0, kb = L.by[sg.b];
      const x2 = kb ? kb.x + W : L.width;
      const ink = sg.hands.length === 1 ? HAND[sg.hands[0] === 'rh' ? 'R' : 'L'].ink : '#1d1a2e';
      s += `<rect x="${Math.max(-2, x1 - 2)}" y="2" width="${Math.min(L.width + 4, x2 - x1 + 4)}" height="${h + 8}" rx="6" fill="none" stroke="${ink}" stroke-width="4"/>`;
    });
    return s + '</svg>';
  }

  // Numeración de los dedos: las dos manos (icono grande), palmas hacia las teclas.
  function buildFingers() {
    return '<div class="hand-legend big">' + ['L', 'R'].map(side =>
      `<span class="hl-item ${side === 'R' ? 'rh' : 'lh'}">${handIcon(side, 2.1, true)}<b>${HAND[side].name}</b></span>`
    ).join('') + '</div>';
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
    let s = `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(spec.alt || 'Círculo de quintas')}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">`;
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

  const API = { parse, midi, label, parseChord, chordType, voicing, layout, buildKeyboard, buildFingers, buildProg, buildCircle, patternGrid, pretty, segmentSpecs, buildMiniMap, whitesIn, SHARPS, MAJ, MIN, TYPE_COLOR };

  // ================================================================= navegador
  if (typeof document === 'undefined') {
    if (typeof module === 'object' && module.exports) module.exports = API;
    return;
  }

  // Audio: timbre sencillo tipo piano eléctrico, sin muestras externas.
  let ctx = null, silent = null, active = 0;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);

  // WAV de silencio (0,25 s). En iPhone, reproducirlo en bucle con <audio> pone la página en modo
  // «reproducción»: así el interruptor de silencio del teléfono no apaga el sonido web.
  function silentWav() {
    const n = 2000, buf = new Uint8Array(44 + n), dv = new DataView(buf.buffer);
    const w = (o, s) => [...s].forEach((ch, i) => { buf[o + i] = ch.charCodeAt(0); });
    w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    w(36, 'data'); dv.setUint32(40, n, true); buf.fill(128, 44);
    let bin = '';
    buf.forEach(b => { bin += String.fromCharCode(b); });
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  // Debe llamarse dentro del gesto del usuario (clic o toque): Safari solo desbloquea el audio ahí.
  function audio() {
    if (!ctx) {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* no disponible */ }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (isIOS) {
      if (!silent) { silent = new Audio(silentWav()); silent.loop = true; silent.setAttribute('playsinline', ''); }
      if (silent.paused) silent.play().catch(() => { /* sin permiso: sigue con Web Audio */ });
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => { /* se reintenta en el próximo toque */ });
    active++;
    return ctx;
  }
  // Cuando no suena nada, se para el silencio en bucle (evita el reproductor en la pantalla de bloqueo).
  function release() {
    active = Math.max(0, active - 1);
    if (!active && silent) silent.pause();
  }
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
    const reset = () => { cur = null; b.innerHTML = idle; clearTimeout(endTimer); release(); if (onEnd) onEnd(); };
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

  // Máximo de teclas blancas que caben a ~30 px cada una en el ancho disponible de la figura.
  const fitWhites = fig => Math.max(7, Math.floor(Math.max(240, fig.clientWidth - 34) / 30));

  function renderKeyboard(fig, spec) {
    spec.alt = spec.alt || fig.dataset.alt;
    const full = buildKeyboard(spec);
    let shown = null, nodes = [];
    const draw = () => {
      const segs = segmentSpecs(spec, fitWhites(fig));
      const key = segs ? segs.map(s => s.a + '-' + s.b).join(',') : 'full';
      if (key === shown) return;
      shown = key;
      nodes.forEach(n => n.remove());
      let html = full.svg;
      if (segs) {
        html = (spec.lh && spec.rh && segs.length > 1 ? buildMiniMap(spec, segs) : '') +
          segs.map(sg => (sg.title ? `<div class="seg-title ${sg.hands.length === 1 ? sg.hands[0] : ''}">${esc(sg.title)}</div>` : '') + buildKeyboard(sg.spec).svg).join('');
      }
      const wrap = mount(fig, html);
      wrap.classList.toggle('split', !!segs);
      nodes = [wrap];
      if (full.legend) { wrap.insertAdjacentHTML('afterend', full.legend); nodes.push(wrap.nextElementSibling); }
    };
    draw();
    let t = null;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 120); });
    if (full.events && spec.play !== false) addPlayer(fig, full.events, spec.playLabel);
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
    function stop() { clearInterval(timer); timer = null; go.textContent = '▶'; dots.forEach(d => d.classList.remove('on')); release(); }
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

    // Tablas: cada celda recibe el nombre de su columna, para mostrarlas como tarjetas en el móvil.
    document.querySelectorAll('table.tbl').forEach(t => {
      const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
      if (!heads.length) return;
      t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (heads[i] && !td.dataset.label) td.dataset.label = heads[i]; }));
    });

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
