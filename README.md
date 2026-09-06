# Slimey Web Component

Interactive, translucent slime rendered with Three.js. Coat DOM text and containers, or turn the text itself into draggable slime.

[Live demo](https://loktar00.github.io/slimey-web-component/)

## Use

Build with `npm ci && npm run build`, then copy `dist/component/slimey-goo.js` into your site. The demo also provides a **Get component** download.

```html
<script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"
    }
  }
</script>
<script type="module" src="./slimey-goo.js"></script>

<style>
  body {
    margin: 0;
    background: #f7f4e9;
    color: #1b201a;
    font-family: Arial, sans-serif;
  }
  slimey-goo {
    height: 800px;
    padding: 160px 10%;
    box-sizing: border-box;
  }
  h1 {
    margin: 0;
    font-size: clamp(70px, 15vw, 180px);
    line-height: 1;
  }
</style>

<slimey-goo mode="drip" color="#00ffaa">
  <h1 data-goo data-goo-solid="text">Slime Time</h1>
</slimey-goo>
```

Serve the files over HTTP. With Vite, install `three@0.180.0` and import `src/slimey-goo.js` instead. The source uses Vite's raw imports for its embedded worker.

## Modes and appearance

- **`mode="drip"`** starts with a finite coating on the upper edges of marked text. If no text is marked, it coats marked containers. Gravity eases to zero after two seconds of draping; interaction and the fluid solver remain active. Dragging restores gravity, and releasing restarts the settling window. Pouring or enabling drips also restarts it. Continuous spawning requires the `drips` attribute.
- **`mode="text"`** fills the marked glyphs with slime and hides their native ink while preserving accessible text and layout. The letters start with zero gravity. Pulling restores gravity; after release it fades to zero over two seconds while friction damps drifting. The solver, viscosity, and recoil remain active. `reset()` restores the letters. Continuous spawning is disabled in this mode.

| Attribute    | Values / default                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`       | `drip` (default), `text`                                                                                                                              |
| `material`   | `slime` (default), `cheese`, `clear`                                                                                                                  |
| `color`      | A three- or six-digit hex color; overrides the material's absorption color                                                                            |
| `friction`   | Resistance to drifting, 0?20; default `5` in text mode, `0` in drip mode                                                                              |
| `viscosity`  | 0?1; default `0.88`                                                                                                                                   |
| `stickiness` | 0?1; default `0.96`                                                                                                                                   |
| `gravity`    | 0?20; constant override; without it, drip mode starts at `3.4` and eases to `0`, and text mode starts at `0` and activates gravity during interaction |
| `drips`      | Boolean; enables a continuous inlet in drip mode                                                                                                      |
| `flow`       | Inlet speed, 0?1; default `0.55`                                                                                                                      |
| `paused`     | Boolean; freezes the simulation                                                                                                                       |
| `quality`    | Pixel ratio multiplier, 0.5?1.5; default `1`                                                                                                          |
| `backdrop`   | Capture background color; default `#f7f4e9`, should match the host background                                                                         |

The demo includes neon lime `#c4ff00`, amber `#ffb800`, pink `#ff26b9`, violet `#a04dff`, blue `#00cfff`, mint `#00ffe0`, and green `#00ffaa`.

## DOM integration

| Marker                  | Behavior                                                                         |
| ----------------------- | -------------------------------------------------------------------------------- |
| `data-goo`              | Includes simple text and boxes in the refraction capture                         |
| `data-goo-solid="text"` | Captures glyphs for the initial coating or fluid text; also add `data-goo`       |
| `data-goo-solid`        | Uses the element's rounded bounding box as a solid collider; also add `data-goo` |
| `data-goo-draggable`    | Makes a collider movable with the pointer or arrow keys; add `tabindex="0"`      |
| `data-goo-ui`           | Keeps a direct slotted child above the canvas                                    |

Text in drip mode provides sticky relief, so the slime can overlap its edges. It is not an impermeable glyph collider. Rounded containers are solid. Capture supports plain text and simple boxes; rotated elements, arbitrary CSS clipping, images, and filters are not captured. The component reads the actual computed font and recaptures after web fonts load. Large text and open letter spacing work best; very fine strokes can disappear at the simulation's resolution. Use `reset()` after changing the font or text of material you have already manipulated.

## Methods

```js
const slime = document.querySelector('slimey-goo');
slime.pause();
slime.play();
slime.reset(); // Rebuild the initial coating or letters.
slime.pour(); // Add one portion of material.
slime.refresh(); // Recapture DOM layout and appearance.
slime.setMaterial('clear');
slime.setAttribute('color', '#ff26b9');
slime.setAttribute('mode', 'text'); // Changing modes resets the material.
```

Events: `goo-ready`, `goo-error` (`detail.message`), and `goo-material-change` (`detail.material`).

The component respects reduced-motion preferences, suspends work offscreen, and disposes its renderer and worker when removed. Physics runs in a Web Worker with a main-thread fallback. If your site uses CSP, allow `worker-src blob:` for the worker. The simulation is planar; its reconstructed surface supplies depth, lighting, and refraction.

## Develop

```sh
npm ci
npm run dev
npm test
npm run format:check
npm run build
```

`npm run deploy` builds the demo and publishes `dist/` to the origin repository's `gh-pages` branch using Git. Configure GitHub Pages to serve that branch's root directory.

`src/slimey-goo.js` owns the element lifecycle, DOM capture, interaction, and rendering. `liquid-solver.js` contains the fluid physics, `liquid-surface.js` reconstructs the mesh, and `liquid-thread.js` transports simulation snapshots. The demo lives in `main.js`, `style.css`, and `index.html`.
