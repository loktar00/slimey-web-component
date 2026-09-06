import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ViscousFluid } from '../src/liquid-solver.js';
import { FluidSurface } from '../src/liquid-surface.js';

test('environmental friction damps free translation without pausing the fluid', () => {
  const free = new ViscousFluid({ initial: 'empty', gravity: 0, cellSize: 0.12 });
  const resisted = new ViscousFluid({ initial: 'empty', gravity: 0, cellSize: 0.12 });
  for (const fluid of [free, resisted])
    for (let y = -0.4; y < 0.4; y += fluid.spacing)
      for (let x = -0.6; x < 0.6; x += fluid.spacing) fluid.add(x, y, 0.8, 0.3);
  const initialMass = totalMass(resisted);
  for (let i = 0; i < 60; i++) {
    free.step(1 / 60, { emit: false });
    resisted.step(1 / 60, { emit: false, drag: 5 });
  }
  const speed = (fluid) => {
    const mass = totalMass(fluid);
    return Math.hypot(
      ...['vx', 'vy'].map(
        (axis) => fluid.particles.reduce((sum, p) => sum + p[axis] * p.mass, 0) / mass,
      ),
    );
  };
  assert.ok(speed(resisted) < speed(free) * 0.02);
  assert.ok(resisted.time > 0.99);
  assert.ok(Math.abs(totalMass(resisted) - initialMass) < 1e-9);
  assert.ok(finite(resisted));
});

const box = { id: 0, left: -0.8, right: 1.6, top: 0.4, bottom: -0.34, radius: 0.14 };
const advance = (f, frames, options = {}) => {
  for (let i = 0; i < frames; i++) f.step(1 / 60, { emit: false, ...options });
};
const finite = (f) =>
  f.particles.every((p) =>
    ['x', 'y', 'vx', 'vy', 'density', 'q00', 'q01', 'q11'].every((key) => Number.isFinite(p[key])),
  );
const totalMass = (f) => f.particles.reduce((n, p) => n + p.mass, 0);

test('liquid mass is conserved by particle-to-grid transfer and remains finite around a solid', () => {
  const f = new ViscousFluid();
  const mass = totalMass(f);
  advance(f, 300, { solids: [box] });
  assert.ok(Math.abs(totalMass(f) - mass) < 1e-8);
  assert.ok(finite(f));
  const gridMass = f.massGrid.reduce((n, m) => n + m, 0);
  assert.ok(Math.abs(gridMass - mass) / mass < 1e-6);
  assert.equal(f.particles.filter((p) => f.contact(p.x, p.y, box).distance < -0.00001).length, 0);
  assert.ok(f.particles.some((p) => p.y < box.bottom));
  assert.ok(f.particles.filter((p) => p.attachment).length > 20);
  const density = f.particles.reduce((n, p) => n + p.density * p.mass, 0) / mass;
  assert.ok(density > 0.8 && density < 1.15, `mean density ${density}`);
});
test('higher viscosity dissipates shear more strongly', () => {
  const sample = (viscosity) => {
    const f = new ViscousFluid();
    for (const p of f.particles) p.vx = 0.3 * Math.sin(p.x * 7);
    advance(f, 12, { viscosity });
    const mean = f.particles.reduce((n, p) => n + p.vx, 0) / f.particles.length;
    return f.particles.reduce((n, p) => n + (p.vx - mean) ** 2, 0) / f.particles.length;
  };
  assert.ok(sample(0.95) < sample(0) * 0.3);
});
test('a stretched liquid patch recoils relative to its moving center of mass on release', () => {
  const f = new ViscousFluid({ cellSize: 0.08 });
  f.particles = [];
  for (let y = 1; y < 1.6; y += f.spacing) for (let x = -0.8; x < 0.8; x += f.spacing) f.add(x, y);
  const grab = f.grab(0.7, 1.3);
  for (let i = 0; i < 48; i++) {
    grab.x = 0.7 + ((i + 1) / 48) * 0.7;
    advance(f, 1, { viscosity: 0.9, grab });
  }
  const extension = () => {
    const held = f.particles.filter((p) => Math.hypot(p.materialX - 0.7, p.materialY - 1.3) < 0.42),
      mass = held.reduce((n, p) => n + p.mass, 0);
    return (
      held.reduce((n, p) => n + p.x * p.mass, 0) / mass -
      f.particles.reduce((n, p) => n + p.x * p.mass, 0) / totalMass(f)
    );
  };
  const before = extension();
  advance(f, 18, { viscosity: 0.9 });
  assert.ok(finite(f));
  assert.ok(extension() < before - 0.025);
});
test('particles exactly on interpolation boundaries do not divide by zero', () => {
  for (const viscosity of [0, 1]) {
    const f = new ViscousFluid();
    f.particles = [];
    for (let y = 1; y < 1.8; y += 0.05) for (let x = -0.8; x < 0.8; x += 0.05) f.add(x, y);
    for (let i = 0; i < 100; i++) f.step(0.045, { viscosity, emit: true, solids: [box] });
    assert.ok(finite(f));
  }
});
test('the fixed physics timestep gives the same result at 30 and 60 rendering frames per second', () => {
  const a = new ViscousFluid({ cellSize: 0.14 }),
    b = new ViscousFluid({ cellSize: 0.14 });
  for (let i = 0; i < 30; i++) a.step(1 / 30, { emit: false, solids: [box] });
  advance(b, 60, { solids: [box] });
  assert.ok(
    a.particles.every((p, i) => Math.hypot(p.x - b.particles[i].x, p.y - b.particles[i].y) < 1e-9),
  );
});
test('wet moving boundaries carry contacting liquid and zero stickiness clears wet contacts', () => {
  const f = new ViscousFluid();
  advance(f, 150, { solids: [box] });
  const wet = f.particles.filter((p) => p.attachment),
    before = new Map(wet.map((p) => [p.id, p.x]));
  assert.ok(wet.length > 20);
  for (let i = 0; i < 30; i++)
    advance(f, 1, {
      solids: [{ ...box, left: box.left + (i + 1) * 0.006, right: box.right + (i + 1) * 0.006 }],
    });
  assert.ok(wet.filter((p) => p.x - before.get(p.id) > 0.05).length > 10);
  advance(f, 1, { stickiness: 0, solids: [box] });
  assert.equal(f.particles.filter((p) => p.attachment).length, 0);
});
test('pouring adds fluid and the inlet recycles settled mass at the particle budget', () => {
  const f = new ViscousFluid();
  const count = f.particles.length;
  f.pour();
  assert.ok(f.particles.length > count);
  f.particles = [];
  for (let i = 0; i < f.maxParticles; i++) f.add(0, f.bounds.bottom);
  const id = f.particles[0].id;
  assert.equal(f.add(0, 4), true);
  assert.equal(f.particles.length, f.maxParticles);
  assert.ok(!f.particles.some((p) => p.id === id));
  f.seed();
  assert.equal(f.particles.length, count);
  assert.equal(f.time, 0);
});
test('surface reconstruction leaves an empty gap between disconnected liquid regions', () => {
  const f = new ViscousFluid();
  f.particles = [];
  for (const cx of [-2, 2])
    for (let y = -0.25; y <= 0.25; y += f.spacing)
      for (let x = -0.25; x <= 0.25; x += f.spacing) f.add(cx + x, y);
  const material = new THREE.MeshPhysicalMaterial(),
    surface = new FluidSurface(material, 160);
  surface.rebuild(f.particles, [], f.spacing);
  const positions = surface.geometry.attributes.position.array;
  assert.ok(surface.cursor > 0);
  for (let i = 0; i < surface.cursor; i++) assert.ok(Math.abs(positions[i * 3]) > 1.5);
  const indices = surface.geometry.index.array;
  assert.equal(surface.geometry.drawRange.count, surface.indexCursor);
  assert.ok(surface.indexCursor <= indices.length);
  for (let i = 0; i < surface.indexCursor; i++)
    assert.ok(indices[i] < surface.cursor, 'surface index points to an emitted vertex');
  for (const attr of Object.values(surface.geometry.attributes)) {
    assert.ok(surface.cursor <= attr.count);
    for (let i = 0; i < surface.cursor * attr.itemSize; i++)
      assert.ok(Number.isFinite(attr.array[i]));
  }
  surface.geometry.dispose();
  material.dispose();
});

test('adaptive samples preserve mass and momentum when a liquid neck stretches', () => {
  const f = new ViscousFluid({ cellSize: 0.12 });
  f.particles = [];
  f.add(0, 0, 0.4, -0.7);
  const p = f.particles[0];
  p.d00 = f.mass * 4;
  p.c00 = 0.8;
  p.c10 = 0.25;
  const mass = totalMass(f),
    momentum = [p.vx * mass, p.vy * mass];
  f._adaptParticles([], null);
  assert.equal(f.particles.length, 2);
  assert.ok(Math.abs(totalMass(f) - mass) < 1e-12);
  for (const [axis, v] of [
    ['x', 'vx'],
    ['y', 'vy'],
  ]) {
    assert.ok(Math.abs(f.particles.reduce((n, p) => n + p[axis] * p.mass, 0)) < 1e-12);
    assert.ok(
      Math.abs(
        f.particles.reduce((n, p) => n + p[v] * p.mass, 0) - momentum[axis === 'x' ? 0 : 1],
      ) < 1e-12,
    );
  }
});

test('budget recycling preserves mass and keeps merged parcels out of the narrow inlet', () => {
  const f = new ViscousFluid({ initial: 'empty', maxParticles: 4 });
  for (const ratio of [0.25, 0.5, 1, 2]) {
    f.add(0, f.bounds.bottom);
    f.particles.at(-1).mass = f.mass * ratio;
  }
  const mass = totalMass(f),
    originalIds = f.particles.map((p) => p.id);
  for (let i = 0; i < 3; i++) assert.equal(f.add(-7.4, 2.55, 0.9, 0), true);
  assert.equal(f.add(-7.4, 2.55, 0.9, 0), false);
  assert.equal(f.particles.length, 4);
  assert.ok(f.particles.slice(0, 3).every((p) => !originalIds.includes(p.id)));
  assert.equal(f.particles[3].id, originalIds[3]);
  assert.ok(Math.abs(totalMass(f) - mass) < 1e-12);
  assert.deepEqual(
    f.particles.map((p) => p.mass / f.mass),
    [0.25, 0.5, 1, 2],
  );
});

test('finite edge coatings preserve their supplied mass', () => {
  const f = new ViscousFluid({
    initial: 'empty',
    cellSize: 0.16,
    maxParticles: 8000,
    gravity: 0.035,
  });
  const mask = new Uint8Array(f.nx * f.ny);
  for (let y = 1; y < f.ny - 1; y++)
    for (let x = 1; x < f.nx - 1; x++) {
      const px = x * f.dx - 8,
        py = y * f.dx - 4.4;
      if (Math.abs(px) < 1.7 && Math.abs(py) < 1.2 && (Math.abs(px) > 1.1 || Math.abs(py) > 0.65))
        mask[y * f.nx + x] = 1;
    }
  f.setObstacleMask(mask, { drape: true });
  f.seed({ mask });
  f.gravity = 3.4;
  assert.ok(f.particles.length > 0);
  const dripMass = totalMass(f);
  advance(f, 120);
  assert.ok(Math.abs(totalMass(f) - dripMass) < 1e-9);
  assert.ok(finite(f));
  f.seed({ mode: 'empty' });
  assert.equal(f.particles.length, 0);
});

test('sticky text relief resists gravitational slip while remaining draggable', () => {
  const sample = (stickiness) => {
    const f = new ViscousFluid({ initial: 'empty', cellSize: 0.16 }),
      mask = new Uint8Array(f.nx * f.ny);
    for (let y = 1; y < f.ny - 1; y++)
      for (let x = 1; x < f.nx - 1; x++)
        if (Math.abs(x * f.dx - 8) < 2 && Math.abs(y * f.dx - 4.4) < 2) mask[y * f.nx + x] = 1;
    f.setObstacleMask(mask, { drape: true });
    for (let y = -0.3; y < 0.3; y += f.spacing)
      for (let x = -0.8; x < 0.8; x += f.spacing) f.add(x, y);
    const mass = totalMass(f),
      center = () => f.particles.reduce((n, p) => n + p.y * p.mass, 0) / mass,
      before = center();
    advance(f, 120, { stickiness });
    return { f, slip: before - center() };
  };
  const weak = sample(0.1),
    strong = sample(0.96);
  assert.ok(strong.slip < weak.slip * 0.05, `weak slip ${weak.slip}, strong slip ${strong.slip}`);
  assert.ok(strong.slip < 0.002);
  const grab = strong.f.grab(0, 0);
  grab.x = 1;
  const held = strong.f.particles.filter((p) => grab.weights.has(p.id)),
    before = held.reduce((n, p) => n + p.x, 0) / held.length;
  advance(strong.f, 30, { stickiness: 0.96, grab });
  assert.ok(held.reduce((n, p) => n + p.x, 0) / held.length > before + 0.1);
});

test('a strong pull dissipates internal motion after release without freezing translation', () => {
  const f = new ViscousFluid({ initial: 'empty', cellSize: 0.16, gravity: 0.035 });
  for (let y = 0.7; y < 1.7; y += f.spacing) for (let x = -2; x < 2; x += f.spacing) f.add(x, y);
  const mass = totalMass(f),
    grab = f.grab(1.75, 1.2);
  const motion = () => {
    let energy = 0,
      px = 0,
      py = 0,
      x = 0,
      y = 0;
    for (const p of f.particles) {
      energy += 0.5 * p.mass * (p.vx * p.vx + p.vy * p.vy);
      px += p.vx * p.mass;
      py += p.vy * p.mass;
      x += p.x * p.mass;
      y += p.y * p.mass;
    }
    return { internal: energy - (px * px + py * py) / (2 * mass), x: x / mass, y: y / mass };
  };
  for (let i = 0; i < 120; i++) {
    grab.x = 1.75 + 1.5 * Math.sin((i / 120) * Math.PI);
    grab.y = 1.2 + (1.7 * i) / 120;
    advance(f, 1, { grab });
  }
  const released = motion();
  assert.ok(released.internal > 0.05);
  advance(f, 360);
  const settled = motion();
  assert.ok(finite(f));
  assert.ok(Math.abs(totalMass(f) - mass) < 1e-9);
  assert.ok(
    settled.internal < released.internal * 0.02,
    `${released.internal} -> ${settled.internal}`,
  );
  assert.ok(
    Math.hypot(settled.x - released.x, settled.y - released.y) > 0.1,
    'released material continues translating',
  );
});
