/*
 * Índice único del curso. La portada (temario) y la navegación entre lecciones se generan desde aquí.
 * Para publicar una lección: crear lecciones/<file>.html y poner ready: true.
 */
(function (root) {
  'use strict';
  const CURSO = {
    modules: [
      { n: 1, title: 'Fundamentos', sub: 'El teclado, las manos y los primeros acordes', c1: '#ef476f', c2: '#f78c6b',
        lessons: [
          { n: 1, file: '01-teclado-y-primer-acorde', title: 'El teclado y tu primer acorde', desc: 'Letras, grupos de teclas negras, postura, dedos, posición de C y el acorde de C', ready: true },
          { n: 2, file: '02-triadas-mayores', title: 'Tríadas mayores: C, F y G', desc: 'La fórmula 4 + 3 semitonos para construir cualquier acorde mayor y la progresión I–IV–V', ready: true },
          { n: 3, file: '03-triadas-menores', title: 'Tríadas menores y los 4 acordes del pop', desc: 'La fórmula 3 + 4, Am, Dm y Em, y la progresión C–G–Am–F', ready: true },
          { n: 4, file: '04-pulso-y-mano-izquierda', title: 'Pulso y mano izquierda', desc: 'Compás de 4/4, negras y corcheas, bajo y acorde coordinados', ready: true }
        ] },
      { n: 2, title: 'Acompañamiento pop', sub: 'Sonar como en el disco, con poco esfuerzo', c1: '#4f5bd5', c2: '#25b7e8',
        lessons: [
          { n: 5, file: '05-inversiones', title: 'Inversiones: moverse sin saltar', desc: 'C–F–G y C–G–Am–F con conducción de voces: la mano apenas se mueve', ready: true },
          { n: 6, file: '06-patrones-de-acompanamiento', title: 'Patrones de acompañamiento', desc: 'Bloques, corcheas, balada, arpegio y síncopa pop', ready: true },
          { n: 7, file: '07-hojas-de-acordes', title: 'Leer una hoja de acordes', desc: 'Compases, repeticiones, C/E (bajo distinto), sus2, sus4 y add9', ready: true },
          { n: 8, file: '08-tonalidades-y-numeros', title: 'Tonalidades y números', desc: 'I–V–vi–IV en cualquier tono: transportar una canción en segundos', ready: true }
        ] },
      { n: 3, title: 'Blues', sub: 'Los 12 compases que dieron origen al rock y al pop', c1: '#b8860b', c2: '#f5b700',
        lessons: [
          { n: 9, file: '09-acordes-de-septima', title: 'Acordes de séptima', desc: 'C7, Cmaj7 y Cm7: tres colores con una sola nota nueva', ready: true },
          { n: 10, file: '10-blues-de-12-compases', title: 'El blues de 12 compases', desc: 'I7–IV7–V7 en C, G y F, y el ritmo shuffle', ready: true },
          { n: 11, file: '11-mano-izquierda-blues', title: 'Mano izquierda blues', desc: 'Boogie-woogie y walking bass sencillo', ready: true },
          { n: 12, file: '12-escala-de-blues', title: 'Escala de blues y turnarounds', desc: 'Frases de mano derecha y finales con sabor', ready: true }
        ] },
      { n: 4, title: 'Tocar cualquier canción', sub: 'De la hoja de acordes al oído', c1: '#1a9e5a', c2: '#22c55e',
        lessons: [
          { n: 13, file: '13-acordes-de-oido', title: 'Sacar acordes de oído', desc: 'Encontrar la nota base de la canción y adivinar los acordes probables', ready: true },
          { n: 14, file: '14-kit-de-supervivencia', title: 'Kit de supervivencia', desc: 'Simplificar acordes raros, elegir tonalidad para cantar y repertorio guiado', ready: true }
        ] },
      { n: 5, title: 'Componer', sub: 'Conectar acordes con intención · basado en «Armonía Ilustrada»', c1: '#6d3fd6', c2: '#ff5fa2',
        lessons: [
          { n: 15, file: '15-funciones-cerca-lejos', title: 'Cerca y lejos: las funciones', desc: 'Tónica (C, Em, Am), subdominante (Dm, F) y dominante (G7, B°): tensión y reposo', ready: true },
          { n: 16, file: '16-notas-comunes', title: 'El pegamento: notas comunes', desc: 'Melodías con las notas del acorde y la pirámide C → Cm → A♭', ready: true },
          { n: 17, file: '17-dominantes-secundarios', title: 'Dominantes secundarios', desc: 'E7 → Am, A7 → Dm y el precioso F → Fm → C', ready: true },
          { n: 18, file: '18-circulo-de-quintas', title: 'El círculo de quintas', desc: 'Tu mapa para cambiar de tonalidad: acordes pivote, relativos y paralelos', ready: true },
          { n: 19, file: '19-colores-especiales', title: 'Colores especiales', desc: 'G7 → G+ → C, disminuidos simétricos y sustituto tritonal', ready: true },
          { n: 20, file: '20-tu-primera-cancion', title: 'Tu primera canción', desc: 'Forma A/B, progresión, melodía y grabación', ready: false }
        ] }
    ]
  };
  CURSO.lessons = CURSO.modules.flatMap(m => m.lessons.map(l => Object.assign({ module: m.n }, l)));

  if (typeof module === 'object' && module.exports) module.exports = CURSO;
  else root.CURSO = CURSO;
})(typeof window !== 'undefined' ? window : this);
