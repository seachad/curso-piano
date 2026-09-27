// Tests del curso. Sin dependencias: `node tests/run.mjs` (o `npm test`).
// Comprueba la teoría musical del motor, que cada diagrama se dibuja sin errores, que los acordes
// dibujados son los que dicen ser, digitaciones plausibles, HTML bien cerrado, enlaces y el índice del curso.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const P = require(path.join(ROOT, 'assets/piano.js'));
const CURSO = require(path.join(ROOT, 'assets/curso-data.js'));

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(`✗ ${name}\n    ${e.message}`); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg); }
const pcsOf = notes => [...new Set(notes.map(n => P.midi(n) % 12))].sort((a, b) => a - b);
const sorted = set => [...set].sort((a, b) => a - b);
const pcName = pc => P.SHARPS[pc];

// ------------------------------------------------------------ 1. Teoría del motor
check('parse de notas', () => {
  eq(P.parse('C4').midi, 60); eq(P.parse('A4').midi, 69); eq(P.parse('Bb3').midi, 58); eq(P.parse('F#2').midi, 42);
});
check('acordes básicos', () => {
  eq(sorted(P.parseChord('C').pcs), [0, 4, 7]);
  eq(sorted(P.parseChord('Am').pcs), [0, 4, 9]);
  eq(sorted(P.parseChord('G7').pcs), [2, 5, 7, 11]);
  eq(sorted(P.parseChord('Cmaj7').pcs), [0, 4, 7, 11]);
  eq(sorted(P.parseChord('Dm7').pcs), [0, 2, 5, 9]);
  eq(sorted(P.parseChord('B°').pcs), [2, 5, 11]);
  eq(sorted(P.parseChord('B°7').pcs), [2, 5, 8, 11]);
  eq(sorted(P.parseChord('G+').pcs), [3, 7, 11]);
  eq(sorted(P.parseChord('Csus4').pcs), [0, 5, 7]);
  eq(sorted(P.parseChord('Cadd9').pcs), [0, 2, 4, 7]);
  eq(P.parseChord('C/E').bass, 4);
  eq(P.parseChord('Bb').root, 10);
});
check('tipo (color) de acorde', () => {
  eq(['C', 'Am', 'G7', 'B°', 'C+', 'Cmaj7', 'Dm7', 'Bm7b5', 'Csus4'].map(c => P.parseChord(c).type),
    ['maj', 'min', 'dom', 'dim', 'aug', 'maj', 'min', 'dim', 'maj']);
});
check('posición por defecto', () => {
  eq(P.voicing('C'), { bass: 48, rh: [60, 64, 67] });
  eq(P.voicing('F').rh, [57, 60, 65]);
  eq(P.voicing('G7').bass, 55);
});
check('patrones de progresión', () => {
  const r = P.buildProg({ chords: ['C', 'G'], pattern: 'X.C.C.C.', bpm: 60 });
  eq(r.events.length, 8);
  eq(r.events[0].notes, [48, 60, 64, 67]);
  eq(r.events[1].t, 1);
  eq(r.events[4].chord, 1);
  const sw = P.buildProg({ chords: ['C'], pattern: 'BCBCBCBC', bpm: 60, swing: true });
  ok(Math.abs(sw.events[1].t - 2 / 3) < 1e-9, 'el swing retrasa la corchea a 2/3 del pulso');
  const bg = P.buildProg({ chords: [{ name: 'C7', lh: [['C3', 'G3'], ['C3', 'A3']] }], pattern: 'LLM.....', bpm: 60 });
  eq(bg.events.map(e => e.notes.length), [2, 2, 6]);
});
check('índice del curso', () => {
  const ns = CURSO.lessons.map(l => l.n);
  eq(ns, ns.map((_, i) => i + 1), 'lecciones numeradas de 1 en 1:');
  eq(new Set(CURSO.lessons.map(l => l.file)).size, CURSO.lessons.length, 'ficheros únicos:');
});

// ------------------------------------------------------------ 2. Páginas
const lessonDir = path.join(ROOT, 'lecciones');
const lessonFiles = fs.existsSync(lessonDir) ? fs.readdirSync(lessonDir).filter(f => f.endsWith('.html')) : [];
const pages = ['index.html', ...lessonFiles.map(f => 'lecciones/' + f)];

check('cada lección publicada existe y cada fichero está en el índice', () => {
  CURSO.lessons.forEach(l => {
    const exists = lessonFiles.includes(l.file + '.html');
    if (l.ready && !exists) throw new Error(`Lección ${l.n} marcada como lista pero falta lecciones/${l.file}.html`);
    // DRAFT=1 permite probar lecciones en preparación que aún no están marcadas como listas.
    if (!l.ready && exists && !process.env.DRAFT) throw new Error(`lecciones/${l.file}.html existe pero la lección ${l.n} no está marcada ready`);
  });
  lessonFiles.forEach(f => ok(CURSO.lessons.some(l => l.file + '.html' === f), `${f} no está en assets/curso-data.js`));
});

// Etiquetas de apertura con sus atributos (respeta comillas, así el JSON puede contener '>').
function tags(html, name) {
  const out = [];
  const re = new RegExp('<' + name + '\\b', 'g');
  let m;
  while ((m = re.exec(html))) {
    let i = m.index + name.length + 1, q = null;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '>') break;
    }
    const raw = html.slice(m.index, i + 1);
    const attrs = {};
    const ar = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g;
    let a;
    const body = raw.slice(name.length + 1, -1);
    while ((a = ar.exec(body))) attrs[a[1]] = a[2] != null ? a[2] : a[3] != null ? a[3] : '';
    out.push({ raw, attrs, line: html.slice(0, m.index).split('\n').length });
  }
  return out;
}
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Comprueba que las etiquetas estructurales abren y cierran en orden.
const PAIRED = ['html', 'head', 'body', 'main', 'header', 'footer', 'nav', 'section', 'article', 'div', 'figure', 'figcaption',
  'ul', 'ol', 'li', 'p', 'h1', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'span', 'a', 'strong', 'em', 'b', 'label', 'small', 'button', 'svg', 'g', 'text'];
function balance(html) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = re.exec(clean))) {
    const [, close, tag0, rest] = m;
    const tag = tag0.toLowerCase();
    if (!PAIRED.includes(tag) || /\/\s*$/.test(rest)) continue;
    const line = clean.slice(0, m.index).split('\n').length;
    if (!close) stack.push({ tag, line });
    else {
      const top = stack.pop();
      if (!top || top.tag !== tag) throw new Error(`</${tag}> en línea ${line} no cierra ${top ? `<${top.tag}> de la línea ${top.line}` : 'nada'}`);
    }
  }
  if (stack.length) throw new Error(`<${stack[stack.length - 1].tag}> de la línea ${stack[stack.length - 1].line} sin cerrar`);
}

function checkHands(spec, where) {
  [['rh', 1], ['lh', -1]].forEach(([k, dir]) => {
    const h = spec[k];
    if (!h) return;
    const fs_ = Object.keys(h.fingers).map(Number).sort((a, b) => a - b);
    fs_.forEach(f => ok(f >= 1 && f <= 5, `${where}: dedo ${f} no existe`));
    const ms = fs_.map(f => P.midi(h.fingers[f]));
    if (!h.cross) {
      for (let i = 1; i < ms.length; i++) {
        ok((ms[i] - ms[i - 1]) * dir > 0,
          `${where}: en la mano ${k === 'rh' ? 'derecha' : 'izquierda'} el dedo ${fs_[i]} debería estar ${dir > 0 ? 'a la derecha' : 'a la izquierda'} del ${fs_[i - 1]} (añade "cross":true si es un paso de pulgar)`);
      }
    }
    const span = Math.max(...ms) - Math.min(...ms);
    ok(span <= (h.wide ? 14 : 12), `${where}: la mano abarca ${span} semitonos (máximo 12; "wide":true hasta 14)`);
    if (h.press) h.press.forEach(n => ok(Object.values(h.fingers).includes(n), `${where}: "press" incluye ${n}, que ningún dedo toca`));
  });
}

for (const rel of pages) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, 'utf8');
  const isLesson = rel.startsWith('lecciones/');

  check(`${rel}: estructura`, () => {
    ok(/<html lang="es">/.test(html), 'falta <html lang="es">');
    ok(/<meta name="viewport"/.test(html), 'falta meta viewport');
    ok(/<title>[^<]{5,}<\/title>/.test(html), 'falta <title>');
    eq((html.match(/<h1\b/g) || []).length, 1, 'número de <h1>:');
    ok(!/<p class="err">/.test(html), 'contiene un error de diagrama escrito a mano');
    balance(html);
  });

  if (isLesson) {
    check(`${rel}: navegación y scripts`, () => {
      const l = CURSO.lessons.find(x => x.file + '.html' === path.basename(rel));
      ok(l, 'no está en el índice');
      const pg = tags(html, 'nav').find(t => 'data-pager' in t.attrs);
      ok(pg, 'falta <nav class="pager" data-pager="N">');
      eq(+pg.attrs['data-pager'], l.n, 'data-pager:');
      const iData = html.indexOf('../assets/curso-data.js'), iPiano = html.indexOf('../assets/piano.js');
      ok(iData > 0 && iPiano > iData, 'hay que cargar ../assets/curso-data.js antes que ../assets/piano.js');
      ok(/<section class="block"[^>]*id="practica"/.test(html), 'falta la sección de práctica (id="practica")');
      ok(/class="check"/.test(html), 'falta la lista de comprobación');
      const saves = tags(html, 'input').map(t => t.attrs['data-save']).filter(Boolean);
      saves.forEach(s => ok(s.startsWith('l' + l.n + '-'), `data-save="${s}" debería empezar por "l${l.n}-"`));
      eq(new Set(saves).size, saves.length, 'data-save repetidos:');
    });
  }

  check(`${rel}: enlaces locales`, () => {
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1])
      .filter(u => !/^(https?:|data:|mailto:|#)/.test(u));
    refs.forEach(u => {
      const target = path.resolve(path.dirname(file), u.split(/[?#]/)[0]);
      ok(fs.existsSync(target), `enlace roto: ${u}`);
    });
  });

  for (const t of [...tags(html, 'figure'), ...tags(html, 'div')]) {
    const where = `${rel}:${t.line}`;
    if ('data-kbd' in t.attrs) {
      check(`${where} teclado`, () => {
        const spec = JSON.parse(decode(t.attrs['data-kbd']));
        const r = P.buildKeyboard(spec);
        ok(!/NaN|undefined/.test(r.svg), 'el SVG contiene NaN/undefined');
        checkHands(spec, where);
        if (t.attrs['data-chord']) {
          const c = P.parseChord(t.attrs['data-chord']);
          const got = pcsOf(r.sounding);
          const want = sorted(c.pcs);
          const names = a => a.map(pcName).join(' ');
          if ('data-chord-partial' in t.attrs) {
            got.forEach(pc => ok(c.pcs.has(pc), `${pcName(pc)} no pertenece a ${c.name}`));
            ok(got.includes(c.root), `falta la fundamental de ${c.name}`);
          } else {
            eq(names(got), names(want), `las teclas pulsadas no forman ${c.name}:`);
          }
          if (spec.lh) {
            const low = Math.min(...r.sounding);
            eq(pcName(low % 12), pcName(c.bass), `el bajo de ${c.name} debería ser`);
          }
        }
      });
    }
    if ('data-prog' in t.attrs) {
      check(`${where} progresión`, () => {
        const spec = JSON.parse(decode(t.attrs['data-prog']));
        const r = P.buildProg(spec);
        ok(r.events.length > 0, 'la progresión no suena');
        if (spec.nums) eq(spec.nums.length, spec.chords.length, 'nums y chords deben tener la misma longitud:');
        r.chords.forEach(o => {
          if (o.partial) return;
          const got = pcsOf([...o.rhM, o.bassM]).map(pcName).join(' ');
          const want = sorted(o.info.pcs).map(pcName).join(' ');
          eq(got, want, `${o.name}: notas`);
          eq(pcName(o.bassM % 12), pcName(o.info.bass), `${o.name}: bajo`);
        });
      });
    }
    if ('data-circle' in t.attrs) {
      check(`${where} círculo`, () => {
        const svg = P.buildCircle(JSON.parse(decode(t.attrs['data-circle'])));
        ok(!/NaN|undefined/.test(svg), 'el SVG contiene NaN/undefined');
      });
    }
    if ('data-chord' in t.attrs && !('data-kbd' in t.attrs)) {
      check(`${where} data-chord`, () => { throw new Error('data-chord solo tiene sentido en figuras data-kbd'); });
    }
  }
}

// ------------------------------------------------------------ resultado
if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`\n${failures.length} fallos, ${passed} correctos`);
  process.exit(1);
}
console.log(`✓ ${passed} comprobaciones correctas (${pages.length} páginas)`);
