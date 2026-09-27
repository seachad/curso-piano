# Piano de acompañamiento · Pop y blues

Curso visual de piano para quien tiene nociones pero no toca. El objetivo es **acompañar**: leer una hoja de acordes en cifrado americano (C, Am, F, G7…) y tocar la base de cualquier canción pop o blues.

Web estática pensada para GitHub Pages: sin compilación ni dependencias.

## Estructura

```
index.html                 Portada y temario
lecciones/NN-slug.html     Una página por lección
assets/curso.css           Sistema visual (tokens, modo claro y oscuro, componentes)
assets/piano.js            Diagramas de teclado con manos, audio, metrónomo y casillas
```

## Diagramas

Los diagramas se declaran en el HTML y `assets/piano.js` los dibuja como SVG:

```html
<figure class="kbd" data-kbd='{"from":"B2","to":"A4",
  "lh":{"fingers":{"5":"C3"}},
  "rh":{"fingers":{"1":"C4","3":"E4","5":"G4"}}}'>
  <p class="fig-title">Acorde de C</p>
  <figcaption>…</figcaption>
</figure>
```

- `fingers`: dedo (1 = pulgar … 5 = meñique) → nota. Los dedos sin nota se dibujan en el aire (borde discontinuo).
- `press`: notas que suenan (por defecto, todas las de `fingers`).
- `marks`: teclas resaltadas sin mano: `{"note":"C4","color":"#ffd6e0","main":"C","sub":"central"}`.
- `names: "all"`: escribe la letra en cada tecla blanca. `solfeo: true` añade Do/Re/Mi.
- `seq` + `tempo`: qué suena al pulsar ▶ (pasos de una nota o varias). `play: false` quita el botón.

Otros componentes: `<figure class="kbd" data-fingers>` (numeración de los dedos), `<div data-metro data-bpm="60">` (metrónomo) e `<input type="checkbox" data-save="id">` (casilla que se recuerda en el navegador).

## Convenciones

- Nomenclatura en letras (C D E F G A B). El solfeo solo aparece como equivalencia en la lección 1.
- Colores por tipo de acorde: mayor rosa, menor celeste, dominante amarillo, disminuido violeta, aumentado verde. Es el código de *Armonía Ilustrada* (Brian J. Callipari, 2025), en el que se basa el módulo 5.
- Mano derecha en azul índigo y mano izquierda en naranja.

## Ver en local

```bash
npx http-server -p 8765
```
