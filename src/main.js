import './style.css';
import './slimey-goo.js';
import rawComponent from './slimey-goo.js?raw';
import rawFluid from './liquid-solver.js?raw';
import rawSurface from './liquid-surface.js?raw';
import rawThread from './liquid-thread.js?raw';

// Keep the downloadable module self-contained, including its worker source.
// Three.js itself is supplied by the import map in the copied example.
const componentSource = [
  rawFluid,
  rawSurface.replace("import * as THREE from 'three';", ''),
  'const solverSource=' + JSON.stringify(rawFluid) + ';',
  rawThread.replace(/^import solverSource.*\r?\n/, ''),
  rawComponent.replace(/^import .* from '\.\/liquid-(?:solver|surface|thread)\.js';\r?\n/gm, ''),
].join('\n');

const goo = document.getElementById('goo');
const toast = document.getElementById('toast');
const dripsButton = document.getElementById('drips');
const pourButton = document.getElementById('pour');
const pauseButton = document.getElementById('pause');
const materialButtons = [...document.querySelectorAll('[data-material]')];
const colorButtons = [...document.querySelectorAll('[data-color]')];
const customColor = document.getElementById('custom-color');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let toastTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2700);
}

function syncDrips() {
  const enabled = goo.hasAttribute('drips');
  dripsButton.setAttribute('aria-pressed', String(enabled));
  dripsButton.textContent = enabled ? 'Drips on' : 'Drips off';
  dripsButton.title = 'Toggle continuous drips';
}

function syncMotion() {
  const paused = goo.hasAttribute('paused') || reduced.matches;
  pauseButton.textContent = paused ? 'Play' : 'Pause';
  pauseButton.setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
  pauseButton.setAttribute('aria-pressed', String(paused));
  document.getElementById('motion-label').textContent = reduced.matches
    ? 'REDUCED MOTION'
    : paused
      ? 'PAUSED'
      : 'LIVE SLIME';
}

function exampleMarkup() {
  return [
    '<slimey-goo',
    '  material="' + goo.getAttribute('material') + '"',
    '  color="' + goo.getAttribute('color') + '"',
    '  viscosity="' + goo.getAttribute('viscosity') + '"',
    '  stickiness="' +
      goo.getAttribute('stickiness') +
      '"' +
      (goo.hasAttribute('drips') ? ' drips' : '') +
      '>',
    '',
    '  <h1 data-goo data-goo-solid="text">',
    '    Slime Time.',
    '  </h1>',
    '',
    '</slimey-goo>',
  ].join('\n');
}

function syncExample() {
  document.getElementById('code-example').textContent = exampleMarkup();
}

for (const button of materialButtons) {
  button.addEventListener('click', () => {
    goo.setMaterial(button.dataset.material);
    materialButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    syncExample();
  });
}

function setColor(color, name) {
  goo.setAttribute('color', color);
  customColor.value = color;
  document.getElementById('color-name').textContent = name;
  colorButtons.forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.color === color.toLowerCase())),
  );
  syncExample();
}

for (const button of colorButtons) {
  button.addEventListener('click', () => setColor(button.dataset.color, button.dataset.colorName));
}
customColor.addEventListener('input', () => {
  const preset = colorButtons.find((button) => button.dataset.color === customColor.value);
  setColor(customColor.value, preset?.dataset.colorName || 'Custom');
});

for (const property of ['viscosity', 'stickiness']) {
  const input = document.getElementById(property);
  input.addEventListener('input', () => {
    goo.setAttribute(property, input.value / 100);
    input.style.setProperty('--value', input.value + '%');
    document.getElementById(property + '-output').value = input.value + '%';
    syncExample();
  });
}

pauseButton.addEventListener('click', () => {
  if (reduced.matches) {
    notify('Motion follows your system’s reduced-motion preference.');
    return;
  }
  if (goo.hasAttribute('paused')) goo.play();
  else goo.pause();
  syncMotion();
});
reduced.addEventListener('change', syncMotion);

dripsButton.addEventListener('click', () => {
  goo.toggleAttribute('drips', !goo.hasAttribute('drips'));
  syncDrips();
  syncExample();
});
pourButton.addEventListener('click', () => goo.pour());

document.getElementById('reset').addEventListener('click', () => {
  goo.removeAttribute('drips');
  goo.reset();
  syncDrips();
  syncExample();
  notify('Fresh slime.');
});

function completeExample() {
  return [
    '<script type="importmap">',
    JSON.stringify({
      imports: {
        three: 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
        'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/',
      },
    }),
    '</script>',
    '<script type="module" src="./slimey-goo.js"></script>',
    '<style>',
    '  body { margin: 0; background: #f7f4e9; color: #1b201a; font-family: Arial, sans-serif; }',
    '  slimey-goo { min-height: 100vh; padding: 20vh 12vw; box-sizing: border-box; }',
    '  h1 { font-size: clamp(70px, 16vw, 220px); letter-spacing: -.06em; margin: 0; }',
    '</style>',
    exampleMarkup(),
  ].join('\n');
}

document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(completeExample());
    notify('Example copied with your current settings.');
  } catch {
    notify('Clipboard unavailable. The README includes a setup example.');
  }
});

document.getElementById('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([componentSource], { type: 'text/javascript' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'slimey-goo.js';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Downloaded. Copy the example to get started.');
});

goo.addEventListener('goo-error', () =>
  notify('The still version is showing because WebGL is unavailable.'),
);

syncDrips();
syncMotion();
syncExample();
