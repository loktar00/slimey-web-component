import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ViscousFluid } from './liquid-solver.js';
import { FluidSurface } from './liquid-surface.js';
import { createFluidThread } from './liquid-thread.js';

const clampSetting = (n, a, b) => Math.max(a, Math.min(b, n));
const scalar = (el, key, fallback) => {
  const raw = el.getAttribute(key),
    v = raw === null ? fallback : Number(raw);
  return Number.isFinite(v) ? clampSetting(v, 0, 1) : fallback;
};
const MATERIALS = {
  slime: {
    color: '#ffffff',
    attenuation: '#c6cc55',
    distance: 0.8,
    transmission: 1,
    roughness: 0.11,
    thickness: 0.38,
  },
  cheese: {
    color: '#fff0be',
    attenuation: '#efa324',
    distance: 0.48,
    transmission: 0.76,
    roughness: 0.19,
    thickness: 0.8,
  },
  clear: {
    color: '#ffffff',
    attenuation: '#edf0df',
    distance: 2.5,
    transmission: 1,
    roughness: 0.09,
    thickness: 0.32,
  },
};
function roundBox(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

/**
 * A viscous fluid web component. Simulation runs in the page plane; a lit 3D
 * surface is reconstructed for Three.js transmission/refraction.
 * data-goo: include simple text/boxes in the optical capture.
 * data-goo-solid: collide with a rounded DOM bounding box (also add data-goo).
 * data-goo-draggable: move a collider with pointer or arrow keys.
 * data-goo-solid="text": sticky glyph relief in drip mode; fluid letters in text mode.
 */
export class SlimeyGoo extends HTMLElement {
  static observedAttributes = [
    'material',
    'color',
    'mode',
    'gravity',
    'friction',
    'viscosity',
    'stickiness',
    'flow',
    'backdrop',
    'paused',
    'quality',
    'drips',
  ];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;position:relative;isolation:isolate;overflow:hidden}
      canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;filter:drop-shadow(1px 7px 7px #69712615) drop-shadow(0 2px 2px #71802912)}
      ::slotted([data-goo-ui]){position:relative;z-index:2}
      :host([data-dragging]){user-select:none;-webkit-user-select:none}
      .fallback{display:none;position:absolute;inset:8% 0 10%;pointer-events:none;z-index:1;opacity:.3;background:radial-gradient(ellipse at 25% 40%,#b6c75f,transparent 65%)}
      :host([data-fallback]) .fallback{display:block}
      :host([data-fallback]) canvas{display:none}
    </style><div class="fallback" aria-hidden="true"></div><slot></slot>`;
    this._dirty = true;
    this._visible = true;
    this._reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this._frame = this._frame.bind(this);
    this._pointer = new THREE.Vector2();
    this._colliderIds = new WeakMap();
    this._nextCollider = 0;
    this._hiddenText = new Map();
    this._needsSeed = true;
  }
  connectedCallback() {
    if (this._renderer) return;
    this._abort = new AbortController();
    const signal = this._abort.signal;
    try {
      this._renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this._renderer.setClearColor(0, 0);
      this._renderer.toneMapping = THREE.NoToneMapping;
      this._renderer.domElement.setAttribute('aria-hidden', 'true');
      this.shadowRoot.prepend(this._renderer.domElement);
      this._scene = new THREE.Scene();
      this._camera = new THREE.OrthographicCamera(-6.4, 6.4, 4, -4, 0.1, 50);
      this._camera.position.set(0, 4, 12);
      this._camera.lookAt(0, 0, 0);
      const room = new RoomEnvironment(),
        pmrem = new THREE.PMREMGenerator(this._renderer);
      const darkCard = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 9),
        new THREE.MeshBasicMaterial({ color: '#111810', side: THREE.DoubleSide }),
      );
      darkCard.position.set(-5, 1, 2);
      darkCard.lookAt(0, 0, 0);
      room.add(darkCard);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 0.65),
        new THREE.MeshBasicMaterial({ color: '#fffce8', side: THREE.DoubleSide }),
      );
      strip.position.set(1, 5, 3);
      strip.lookAt(0, 0, 0);
      room.add(strip);
      this._environment = pmrem.fromScene(room, 0.035);
      this._scene.environment = this._environment.texture;
      this._scene.environmentIntensity = 0.85;
      room.dispose();
      pmrem.dispose();
      const key = new THREE.DirectionalLight('#fff7dc', 1.4);
      key.position.set(-3, 7, 6);
      const rim = new THREE.DirectionalLight('#feffed', 0.7);
      rim.position.set(4, 1, -1);
      this._scene.add(key, rim, new THREE.AmbientLight('#eff1df', 0.18));
      this._pageCanvas = document.createElement('canvas');
      this._pageTexture = new THREE.CanvasTexture(this._pageCanvas);
      this._pageTexture.colorSpace = THREE.SRGBColorSpace;
      this._material = new THREE.MeshPhysicalMaterial({
        metalness: 0,
        ior: 1.39,
        transmission: 0,
        roughness: 0.08,
        thickness: 0.38,
        envMapIntensity: 1.1,
        clearcoat: 0.1,
        clearcoatRoughness: 0.07,
        side: THREE.FrontSide,
      });
      // Refraction samples our DOM texture. Enable its physical shader path
      // directly so Three does not render an unused transmission framebuffer.
      this._material.defines.USE_TRANSMISSION = '';
      this._transmissionUniforms = {
        transmission: { value: 1 },
        thickness: { value: this._material.thickness },
        attenuationDistance: { value: this._material.attenuationDistance },
        attenuationColor: { value: this._material.attenuationColor },
      };
      this._material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this._transmissionUniforms);
        shader.uniforms.uPage = { value: this._pageTexture };
        shader.vertexShader =
          'attribute float gooThickness;\nattribute vec2 gooMaterialUV;\nvarying float vGooThickness;\nvarying vec2 vGooMaterialUV;\n' +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvGooThickness = gooThickness;\nvGooMaterialUV = gooMaterialUV;',
        );
        shader.fragmentShader =
          `uniform sampler2D uPage;
          varying float vGooThickness;
          varying vec2 vGooMaterialUV;
          float gooHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float gooNoise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(gooHash(i),gooHash(i+vec2(1,0)),f.x),mix(gooHash(i+vec2(0,1)),gooHash(i+vec2(1,1)),f.x),f.y);
          }
          float gooMicro(vec2 p){
            vec2 q=p*18.0,cell=floor(q),local=fract(q);
            vec2 center=.2+.6*vec2(gooHash(cell),gooHash(cell+17.0));
            float radius=.09+.15*gooHash(cell+41.0),d=length(local-center);
            float width=max(.035,fwidth(d)*.7);
            float ring=exp(-pow((d-radius)/width,2.0));
            float folds=gooNoise(p*13.0+gooNoise(p*3.0)*2.0)*.0025+gooNoise(p*31.0)*.001;
            return folds+ring*step(.93,gooHash(cell+93.0))*.0035;
          }
        ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          float micro=gooMicro(vGooMaterialUV)*smoothstep(.05,.18,vGooThickness);
          vec3 surfacePosition=-vViewPosition;
          vec3 tangentX=dFdx(surfacePosition),tangentY=dFdy(surfacePosition);
          vec3 crossX=cross(tangentY,normal),crossY=cross(normal,tangentX);
          float determinant=dot(tangentX,crossX);
          normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(micro)*crossX+dFdy(micro)*crossY));
        `,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <transmission_pars_fragment>',
          THREE.ShaderChunk.transmission_pars_fragment
            .replace(
              'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );',
              'return texture2D(uPage,clamp(fragCoord.xy,vec2(0.001),vec2(0.999)));',
            )
            .replace(
              'float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );',
              '',
            )
            .replace(
              'return normalize( refractionVector ) * thickness * modelScale;',
              'return normalize( refractionVector ) * thickness;',
            ),
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <transmission_fragment>',
          THREE.ShaderChunk.transmission_fragment
            .replace(
              'vec3 v = normalize( cameraPosition - pos );',
              'vec3 v = normalize(vec3(0.0,4.0,12.0));',
            )
            .replace(
              'material.thickness = thickness;',
              'material.thickness = thickness * max(0.025, vGooThickness) / 0.38;',
            ),
        );
      };
      this._configureFluid();
      this._needsSeed = true;
      this._sync();
      this._resizeObserver = new ResizeObserver(() => this._resize());
      this._resizeObserver.observe(this);
      this._mutationObserver = new MutationObserver(() => {
        this._dirty = true;
        this._observeTargets();
      });
      this._mutationObserver.observe(this, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-goo', 'data-goo-solid', 'class', 'style'],
      });
      this._intersectionObserver = new IntersectionObserver((entries) => {
        this._visible = entries[0].isIntersecting;
      });
      this._intersectionObserver.observe(this);
      this._observeTargets();
      this.addEventListener('pointerdown', (e) => this._down(e), { signal });
      this.addEventListener('pointermove', (e) => this._move(e), { signal, passive: true });
      this.addEventListener('keydown', (e) => this._keyMove(e), { signal });
      window.addEventListener(
        'pointermove',
        (e) => {
          if (this._movingElement || this._fluidGrab) this._move(e);
        },
        { signal, passive: true },
      );
      window.addEventListener('pointerup', () => this._release(), { signal });
      window.addEventListener('pointercancel', () => this._release(), { signal });
      window.addEventListener(
        'scroll',
        () => {
          this._dirty = true;
        },
        { signal, passive: true },
      );
      window.addEventListener('resize', () => this._resize(), { signal });
      this._reduced.addEventListener(
        'change',
        () => {
          this._release();
          this._dirty = true;
        },
        { signal },
      );
      this._renderer.domElement.addEventListener(
        'webglcontextlost',
        (e) => {
          e.preventDefault();
          this._lost = true;
          this.setAttribute('data-fallback', '');
          this._syncTextVisibility();
        },
        { signal },
      );
      this._renderer.domElement.addEventListener(
        'webglcontextrestored',
        () => {
          this._lost = false;
          this._dirty = true;
          this.removeAttribute('data-fallback');
        },
        { signal },
      );
      document.fonts?.ready.then(() => {
        if (this.isConnected) {
          if (!this._interacted) this._needsSeed = true;
          this.refresh();
        }
      });
      document.fonts?.addEventListener(
        'loadingdone',
        () => {
          if (!this._interacted) this._needsSeed = true;
          this.refresh();
        },
        { signal },
      );
      this._resize();
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._frame);
      this._lost = false;
      this.removeAttribute('data-fallback');
      this.dispatchEvent(new CustomEvent('goo-ready', { bubbles: true }));
    } catch (error) {
      this._destroy();
      this.setAttribute('data-fallback', '');
      this.dispatchEvent(
        new CustomEvent('goo-error', { detail: { message: error.message }, bubbles: true }),
      );
    }
  }
  _observeTargets() {
    const targets = Array.from(this.querySelectorAll('[data-goo]')).slice(0, 24);
    for (const el of this._targets || [])
      if (!targets.includes(el)) this._resizeObserver?.unobserve(el);
    for (const el of targets) this._resizeObserver?.observe(el);
    this._targets = targets;
  }
  _sync() {
    if (!this._material) return;
    const p = MATERIALS[this.getAttribute('material')] || MATERIALS.slime;
    const color = this.getAttribute('color');
    this._material.color.set(p.color);
    this._material.attenuationColor.set(
      /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color || '') ? color : p.attenuation,
    );
    this._material.attenuationDistance = p.distance;
    this._material.roughness = p.roughness;
    this._material.thickness = p.thickness;
    // Three skips these uniform updates when material.transmission is zero.
    this._transmissionUniforms.transmission.value = p.transmission;
    this._transmissionUniforms.thickness.value = p.thickness;
    this._transmissionUniforms.attenuationDistance.value = p.distance;
    this._dirty = true;
  }
  get mode() {
    return this.getAttribute('mode') === 'text' ? 'text' : 'drip';
  }
  get gravity() {
    const raw = this.getAttribute('gravity'),
      value = raw === null ? 3.4 : Number(raw);
    return Number.isFinite(value) ? clampSetting(value, 0, 20) : 3.4;
  }
  get friction() {
    const raw = this.getAttribute('friction'),
      fallback = this.mode === 'text' ? 5 : 0,
      value = raw === null ? fallback : Number(raw);
    return Number.isFinite(value) ? clampSetting(value, 0, 20) : fallback;
  }
  _effectiveGravity() {
    if (this.hasAttribute('gravity')) return this.gravity;
    if (this.mode === 'text' && !this._textActivated) return 0;
    if (this._fluidGrab || this._movingElement) return this.gravity;
    if (this.mode === 'text' && this._gravityStartedAt == null) return 0;
    // Give the coating time to drape, then remove acceleration without
    // stopping the solver or discarding its velocity and polymer stress.
    const elapsed = (this._fluid?.time || 0) - (this._gravityStartedAt || 0);
    const t = clampSetting(this.mode === 'text' ? elapsed / 2 : (elapsed - 2) / 0.6, 0, 1);
    return this.gravity * (1 - t * t * (3 - 2 * t));
  }
  _restartGravity() {
    this._gravityStartedAt = this._fluid?.time || 0;
  }
  attributeChangedCallback(name, previous, value) {
    if (previous === value) return;
    this._sync();
    if (name === 'quality') this._resize();
    if (name === 'drips' && value !== null) this._restartGravity();
    if (name === 'mode') {
      this._release();
      this._needsSeed = true;
      this._dirty = true;
      this._interacted = false;
      this._textActivated = false;
      this._resize();
    }
  }
  _resize() {
    if (!this._renderer) return;
    const r = this.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (
      this.mode === 'text' &&
      this._layoutWidth != null &&
      (this._layoutWidth !== r.width || this._layoutHeight !== r.height)
    ) {
      this._needsSeed = true;
      this._interacted = false;
    }
    this._layoutWidth = r.width;
    this._layoutHeight = r.height;
    this._bounds = r;
    const aspect = r.width / r.height;
    this._scaleX = this.mode === 'text' && r.width < 650 ? 1 : aspect / 1.6;
    this._camera.left = -aspect * 4;
    this._camera.right = aspect * 4;
    this._camera.updateProjectionMatrix();
    const q = Number(this.getAttribute('quality') || 1);
    this._renderer.setPixelRatio(
      Math.min(devicePixelRatio || 1, 1.5) * clampSetting(Number.isFinite(q) ? q : 1, 0.5, 1.5),
    );
    this._renderer.setSize(r.width, r.height, false);
    this._surface.scale.x = this._scaleX;
    this._captureScale = Math.min(devicePixelRatio || 1, 1.5, 2200 / r.width);
    this._pageCanvas.width = Math.round(r.width * this._captureScale);
    this._pageCanvas.height = Math.round(r.height * this._captureScale);
    this._dirty = true;
    this._lastSurface = 0;
  }
  _captureDOM() {
    if (this._needsSeed) this._configureFluid();
    const r = this.getBoundingClientRect(),
      s = this._captureScale,
      ctx = this._pageCanvas.getContext('2d');
    this._bounds = r;
    this._syncTextVisibility();
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = this.getAttribute('backdrop') || '#f7f4e9';
    ctx.fillRect(0, 0, r.width, r.height);
    this._glyphCanvas ??= document.createElement('canvas');
    this._glyphCanvas.width = this._fluid.nx;
    this._glyphCanvas.height = this._fluid.ny;
    const mask = this._glyphCanvas.getContext('2d', { willReadFrequently: true }),
      inv = this._fluid.inv;
    const worldPerPixelX = 8 / r.height / this._scaleX;
    mask.setTransform(
      worldPerPixelX * inv,
      0,
      0,
      (8 / r.height) * inv,
      (8 - (r.width * worldPerPixelX) / 2) * inv,
      0.4 * inv,
    );
    mask.fillStyle = '#ffffff';
    for (const el of this._targets || []) {
      const box = el.getBoundingClientRect(),
        css = getComputedStyle(el);
      if (!box.width || !box.height || css.visibility === 'hidden') continue;
      const x = box.left - r.left,
        y = box.top - r.top;
      if (css.backgroundColor !== 'rgba(0, 0, 0, 0)' && css.backgroundColor !== 'transparent') {
        ctx.fillStyle = css.backgroundColor;
        roundBox(ctx, x, y, box.width, box.height, parseFloat(css.borderRadius) || 0);
        ctx.fill();
      }
      if (parseFloat(css.borderTopWidth) > 0 && css.borderTopStyle !== 'none') {
        ctx.strokeStyle = css.borderTopColor;
        ctx.lineWidth = parseFloat(css.borderTopWidth);
        roundBox(
          ctx,
          x + 0.5,
          y + 0.5,
          box.width - 1,
          box.height - 1,
          parseFloat(css.borderRadius) || 0,
        );
        ctx.stroke();
      }
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent;
        if (!text.trim()) continue;
        const style = getComputedStyle(node.parentElement);
        ctx.font =
          style.fontStyle + ' ' + style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
        ctx.fillStyle = style.color;
        ctx.textBaseline = 'alphabetic';
        ctx.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect(),
          m = ctx.measureText(text);
        const ascent = m.fontBoundingBoxAscent || parseFloat(style.fontSize) * 0.8,
          descent = m.fontBoundingBoxDescent || parseFloat(style.fontSize) * 0.2;
        ctx.globalAlpha = el.getAttribute('data-goo-solid') === 'text' ? 0.8 : 1;
        if (this.mode !== 'text' || el.getAttribute('data-goo-solid') !== 'text')
          ctx.fillText(
            text,
            rect.left - r.left,
            rect.top - r.top + (rect.height - ascent - descent) / 2 + ascent,
          );
        ctx.globalAlpha = 1;
        if (el.getAttribute('data-goo-solid') === 'text') {
          mask.font = ctx.font;
          mask.textBaseline = ctx.textBaseline;
          mask.letterSpacing = ctx.letterSpacing;
          mask.fillText(
            text,
            rect.left - r.left,
            rect.top - r.top + (rect.height - ascent - descent) / 2 + ascent,
          );
        }
      }
    }
    this._pageTexture.needsUpdate = true;
    const pixels = mask.getImageData(0, 0, this._fluid.nx, this._fluid.ny).data,
      field = new Uint8Array(this._fluid.nx * this._fluid.ny);
    for (let y = 0; y < this._fluid.ny; y++)
      for (let x = 0; x < this._fluid.nx; x++)
        field[y * this._fluid.nx + x] =
          pixels[((this._fluid.ny - 1 - y) * this._fluid.nx + x) * 4 + 3] > 96 ? 1 : 0;
    this._glyphMask = field;
    if (this.mode === 'text') {
      this._fluid.obstacle = null;
      this._fluid.obstacleMask = null;
    } else this._fluid.setObstacleMask(field, { drape: true });
    this._threadMaskDirty = true;
    if (this._needsSeed) {
      const seedMask = field.some(Boolean) || this.mode === 'text' ? field : this._boxSeedMask();
      this._seed = { mode: this.mode, mask: seedMask };
      this._fluid.seed(this._seed);
      this._textActivated = false;
      this._gravityStartedAt = this.mode === 'text' ? null : 0;
      this._fluid.gravity = this._effectiveGravity();
      this._startThread();
      this._needsSeed = false;
      this._surfaceDirty = true;
    }
  }
  _configureFluid() {
    const narrow = this.clientWidth < 650,
      isText = this.mode === 'text';
    const cellSize = isText ? (narrow ? 0.04 : 0.08) : narrow ? 0.16 : 0.12;
    if (this._fluidOptions?.cellSize !== cellSize) {
      this._fluidOptions = {
        cellSize,
        maxParticles: narrow ? 10000 : 16000,
        initial: 'empty',
        gravity: isText ? 0 : this.gravity,
      };
      this._fluid = new ViscousFluid(this._fluidOptions);
    }
    const resolution = narrow ? (isText ? 384 : 192) : 288;
    if (this._surface?.nx !== resolution) {
      if (this._surface) {
        this._scene.remove(this._surface);
        this._surface.geometry.dispose();
      }
      this._surface = new FluidSurface(this._material, resolution, { closed: false });
      this._surface.scale.set(this._scaleX || 1, Math.sqrt(160) / 12, 1);
      this._scene.add(this._surface);
    }
    // A tighter contour and shallower profile preserve counters and spacing.
    this._surface.isolation = isText ? 0.54 : 0.24;
    this._surface.depthScale = isText ? 0.55 : 1;
  }
  _syncTextVisibility() {
    const hidden =
      this.mode === 'text' && !this._lost && !this.hasAttribute('data-fallback')
        ? new Set(
            (this._targets || []).filter((el) => el.getAttribute('data-goo-solid') === 'text'),
          )
        : new Set();
    for (const [el, original] of this._hiddenText) {
      if (hidden.has(el)) continue;
      el.style.opacity = original.opacity;
      el.style.pointerEvents = original.pointerEvents;
      this._hiddenText.delete(el);
    }
    for (const el of hidden) {
      if (this._hiddenText.has(el)) continue;
      this._hiddenText.set(el, {
        opacity: el.style.opacity,
        pointerEvents: el.style.pointerEvents,
      });
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }
  }
  _boxSeedMask() {
    const field = new Uint8Array(this._fluid.nx * this._fluid.ny),
      { nx, ny, dx } = this._fluid;
    for (const box of this._solidBodies()) {
      for (let y = 1; y < ny - 1; y++)
        for (let x = 1; x < nx - 1; x++) {
          const wx = x * dx - 8,
            wy = y * dx - 4.4;
          if (wx >= box.left && wx <= box.right && wy >= box.bottom && wy <= box.top)
            field[y * nx + x] = 1;
        }
    }
    return field;
  }
  _solidBodies() {
    const r = this.getBoundingClientRect(),
      s = 8 / r.height;
    return (this._targets || [])
      .filter(
        (el) => el.hasAttribute('data-goo-solid') && el.getAttribute('data-goo-solid') !== 'text',
      )
      .map((el) => {
        const b = el.getBoundingClientRect();
        if (!this._colliderIds.has(el)) this._colliderIds.set(el, this._nextCollider++);
        return {
          id: this._colliderIds.get(el),
          left: ((b.left - r.left - r.width / 2) * s) / this._scaleX,
          right: ((b.right - r.left - r.width / 2) * s) / this._scaleX,
          top: (r.height / 2 - b.top + r.top) * s,
          bottom: (r.height / 2 - b.bottom + r.top) * s,
          radius: parseFloat(getComputedStyle(el).borderRadius) * s || 0,
        };
      });
  }
  _move(e) {
    const r = this.getBoundingClientRect();
    this._pointer.set(
      ((e.clientX - r.left - r.width / 2) * 8) / r.height / this._scaleX,
      ((r.height / 2 - e.clientY + r.top) * 8) / r.height,
    );
    if (this._movingElement) {
      const dx = clampSetting(e.clientX - this._wordStart.x, -r.width * 0.4, r.width * 0.4),
        dy = clampSetting(e.clientY - this._wordStart.y, -r.height * 0.35, r.height * 0.35);
      this._movingElement.style.translate =
        this._wordStart.tx + dx + 'px ' + (this._wordStart.ty + dy) + 'px';
      this._dirty = true;
    }
    if (this._fluidGrab) {
      this._fluidGrab.x = this._pointer.x;
      this._fluidGrab.y = this._pointer.y;
    }
  }
  _down(e) {
    if (
      e.button !== 0 ||
      e.target.closest('a,input,textarea,select,[contenteditable],button:not([data-goo-pull])')
    )
      return;
    const target = e.target.closest('[data-goo-draggable]');
    if (target) {
      this._movingElement = target;
      const offset = getComputedStyle(target).translate.split(' ');
      this._wordStart = {
        x: e.clientX,
        y: e.clientY,
        tx: parseFloat(offset[0]) || 0,
        ty: parseFloat(offset[1]) || 0,
      };
      target.setPointerCapture?.(e.pointerId);
    } else {
      if (this.hasAttribute('paused') || this._reduced.matches || !this._fluid) return;
      this._move(e);
      this._fluidGrab = this._fluid.grab(this._pointer.x, this._pointer.y);
      if (!this._fluidGrab.weights.size) {
        this._fluidGrab = null;
        return;
      }
      this._fluidGrab.generation = this._grabGeneration = (this._grabGeneration || 0) + 1;
    }
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    this.setAttribute('data-dragging', '');
    this._interacted = true;
    if (this._fluidGrab) this._textActivated = true;
    this._restartGravity();
  }
  _release() {
    if (this._movingElement || this._fluidGrab) this._restartGravity();
    this._movingElement = null;
    this._fluidGrab = null;
    this.removeAttribute('data-dragging');
  }
  _keyMove(e) {
    const target = e.target.closest('[data-goo-draggable]');
    if (!target || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const t = getComputedStyle(target).translate.split(' '),
      step = e.shiftKey ? 20 : 5;
    let x = parseFloat(t[0]) || 0,
      y = parseFloat(t[1]) || 0;
    if (e.key === 'ArrowLeft') x -= step;
    if (e.key === 'ArrowRight') x += step;
    if (e.key === 'ArrowUp') y -= step;
    if (e.key === 'ArrowDown') y += step;
    target.style.translate = x + 'px ' + y + 'px';
    this._dirty = true;
    this._restartGravity();
  }
  _frame(now) {
    this._raf = requestAnimationFrame(this._frame);
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    if (!this._visible || document.hidden || this._lost) return;
    const paused = this.hasAttribute('paused') || this._reduced.matches,
      dirty = this._dirty;
    if (paused && !dirty && !this._surfaceDirty) return;
    if (dirty) {
      this._captureDOM();
      this._dirty = false;
    }
    const solids = this._solidBodies();
    if (!paused) {
      const options = {
        viscosity: scalar(this, 'viscosity', 0.88),
        stickiness: scalar(this, 'stickiness', 0.96),
        flow: scalar(this, 'flow', 0.55),
        emit: this.mode !== 'text' && this.hasAttribute('drips'),
        gravity: this._effectiveGravity(),
        drag: this.friction,
        solids,
      };
      this._fluid.gravity = options.gravity;
      if (this._thread) {
        this._physicsElapsed = Math.min(0.05, this._physicsElapsed + dt);
        if (!this._threadBusy && this._physicsElapsed >= 1 / 90) {
          const pointer = this._fluidGrab
            ? { x: this._fluidGrab.x, y: this._fluidGrab.y, generation: this._fluidGrab.generation }
            : null;
          const buffer = this._threadBuffer;
          this._threadBusy = true;
          this._thread.postMessage(
            {
              type: 'step',
              dt: this._physicsElapsed,
              options,
              pointer,
              pour: this._pourPending,
              mask: this._threadMaskDirty ? this._fluid.obstacleMask : null,
              buffer,
            },
            buffer ? [buffer] : [],
          );
          this._threadBuffer = null;
          this._physicsElapsed = 0;
          this._pourPending = false;
          this._threadMaskDirty = false;
        }
      } else {
        this._fluid.step(dt, { ...options, grab: this._fluidGrab });
        this._surfaceDirty = true;
      }
    }
    const surfaceInterval = 1000 / 60;
    if (
      dirty ||
      !this._lastSurface ||
      (this._surfaceDirty && now - this._lastSurface >= surfaceInterval - 0.5)
    ) {
      this._surface.rebuild(
        this._fluid.particles,
        solids,
        this._fluid.spacing,
        this._fluid.obstacle,
      );
      // Keep a regular deadline across 60/120/144 Hz displays instead of
      // rounding every update to a multiple of the display's frame interval.
      this._lastSurface =
        dirty || !this._lastSurface
          ? now
          : Math.max(this._lastSurface + surfaceInterval, now - surfaceInterval);
      this._surfaceDirty = false;
      this._renderer.render(this._scene, this._camera);
    }
  }
  _startThread() {
    const revision = (this._threadRevision = (this._threadRevision || 0) + 1);
    this._thread?.terminate();
    this._thread = null;
    this._threadBuffer = null;
    this._threadBusy = true;
    this._threadMaskDirty = true;
    this._physicsElapsed = 0;
    this._pourPending = false;
    if (typeof Worker === 'undefined') return;
    const failed = (error) => {
      if (revision !== this._threadRevision) return;
      this._threadError = error?.message || 'Worker unavailable';
      this._thread?.terminate();
      this._thread = null;
      this._threadBuffer = null;
      this._fluid.seed(this._seed);
      this._dirty = true;
    };
    try {
      this._thread = createFluidThread(
        { ...this._fluidOptions, gravity: this._effectiveGravity(), seed: this._seed },
        (data) => {
          if (revision !== this._threadRevision) return;
          const a = new Float32Array(data.buffer),
            particles = this._fluid.particles;
          while (particles.length < data.count) particles.push({});
          particles.length = data.count;
          for (let i = 0; i < data.count; i++) {
            const p = particles[i],
              j = i * 12;
            p.id = a[j];
            p.x = a[j + 1];
            p.y = a[j + 2];
            p.vx = a[j + 3];
            p.vy = a[j + 4];
            p.mass = a[j + 5];
            p.q00 = a[j + 6];
            p.q01 = a[j + 7];
            p.q11 = a[j + 8];
            p.materialX = a[j + 9];
            p.materialY = a[j + 10];
            p.attachment = a[j + 11] ? { body: 'wet' } : null;
          }
          this._fluid.time = data.time;
          this._threadBuffer = data.buffer;
          this._threadBusy = false;
          this._surfaceDirty = true;
        },
        failed,
      );
    } catch (error) {
      failed(error);
    }
  }
  refresh() {
    this._observeTargets();
    this._dirty = true;
  }
  pause() {
    this.setAttribute('paused', '');
    this._release();
  }
  play() {
    this.removeAttribute('paused');
  }
  reset() {
    this._release();
    this._needsSeed = true;
    this._interacted = false;
    this._targets?.forEach((el) => {
      if (el.hasAttribute('data-goo-draggable')) el.style.translate = 'none';
    });
    this._lastSurface = 0;
    this._dirty = true;
  }
  pour() {
    if (!this._fluid || this._reduced.matches || this.hasAttribute('paused')) return;
    this._restartGravity();
    if (this._thread) this._pourPending = true;
    else this._fluid.pour();
  }
  setMaterial(name) {
    if (!MATERIALS[name]) throw new RangeError('Unknown material: ' + name);
    this.setAttribute('material', name);
    this.dispatchEvent(
      new CustomEvent('goo-material-change', { detail: { material: name }, bubbles: true }),
    );
  }
  _destroy() {
    this._threadRevision = (this._threadRevision || 0) + 1;
    this._thread?.terminate();
    this._thread = null;
    this._threadBuffer = null;
    cancelAnimationFrame(this._raf);
    this._abort?.abort();
    this._resizeObserver?.disconnect();
    this._mutationObserver?.disconnect();
    this._intersectionObserver?.disconnect();
    for (const [el, original] of this._hiddenText) {
      el.style.opacity = original.opacity;
      el.style.pointerEvents = original.pointerEvents;
    }
    this._hiddenText.clear();
    this._surface?.geometry.dispose();
    this._material?.dispose();
    this._pageTexture?.dispose();
    this._environment?.dispose();
    this._renderer?.dispose();
    this._renderer?.domElement.remove();
    this._renderer = null;
    this._surface = null;
    this._material = null;
    this._fluid = null;
    this._fluidOptions = null;
    this._interacted = false;
  }
  disconnectedCallback() {
    this._release();
    this._destroy();
  }
}
if (!customElements.get('slimey-goo')) customElements.define('slimey-goo', SlimeyGoo);
