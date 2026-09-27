# Piano de acompañamiento · Pop y blues

Curso visual de piano para quien tiene nociones pero no toca. El objetivo es **acompañar**: leer una hoja de acordes en cifrado americano (C, Am, F, G7…) y tocar la base de cualquier canción pop o blues. El módulo 5 enseña a componer a partir de las ideas de *Armonía Ilustrada* (Brian J. Callipari, 2025).

Web estática pensada para GitHub Pages: sin compilación ni dependencias.

## Estructura

```
index.html                 Portada; el temario se genera desde assets/curso-data.js
lecciones/NN-slug.html     Una página por lección
assets/curso-data.js       Índice único del curso (módulos, lecciones, ready)
assets/curso.css           Sistema visual (tokens, modo claro y oscuro, componentes)
assets/piano.js            Motor: teclados con manos, progresiones, círculo de quintas, audio, metrónomo
tests/run.mjs              Tests (node, sin dependencias)
```

## Tests

```bash
npm test
```

Los tests deben pasar siempre antes de cada commit (y se ejecutan en GitHub Actions). Comprueban:

- la teoría del motor (notas, acordes, posiciones, patrones y swing);
- que cada diagrama se dibuja sin errores;
- que las teclas pulsadas forman el acorde declarado en `data-chord` y que cada progresión suena con las notas de sus acordes;
- digitaciones plausibles: orden de los dedos y apertura máxima de una octava;
- HTML bien cerrado, enlaces locales, navegación entre lecciones y coherencia con el índice.

## Publicar una lección

1. Crea `lecciones/NN-slug.html` a partir de una lección existente (misma estructura: hero, objetivos, pasos numerados, figuras, `#practica` y lista de comprobación).
2. En `assets/curso-data.js`, pon `ready: true` en esa lección.
3. Ejecuta `npm test`, haz commit y push.

## Componentes

```html
<!-- Teclado con manos; data-chord lo verifican los tests -->
<figure class="kbd" data-chord="C" data-kbd='{"from":"B2","to":"A4",
  "lh":{"fingers":{"5":"C3"}},
  "rh":{"fingers":{"1":"C4","3":"E4","5":"G4"}}}'>
  <p class="fig-title">Acorde de C</p>
  <figcaption>…</figcaption>
</figure>

<!-- Progresión con patrón rítmico (una letra por corchea) -->
<figure class="kbd" data-prog='{"chords":["C","G","Am","F"],"nums":["I","V","vi","IV"],
  "bpm":80,"pattern":"X.C.C.C.","grid":true}'></figure>

<!-- Círculo de quintas -->
<figure class="kbd" data-circle='{"highlight":["C","G","F"],"arrows":[["G","C"]]}'></figure>
```

La referencia completa de opciones está en la cabecera de `assets/piano.js`. Otros componentes: `data-fingers`, `data-metro`, `data-save`, `.beats`, `.sheet`, `.callout`, `.ex`, `.check`, `.tbl`.

## Convenciones

- Nomenclatura en letras (C D E F G A B). El solfeo solo aparece como equivalencia en la lección 1.
- Colores por tipo de acorde: mayor rosa, menor celeste, dominante amarillo, disminuido violeta y aumentado verde.
- Mano derecha en azul índigo y mano izquierda en naranja.

## Ver en local

```bash
npm start
```
