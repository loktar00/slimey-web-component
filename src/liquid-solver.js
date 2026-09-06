const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** MLS-MPM liquid: APIC transfers, Tait pressure, implicit viscosity, and
 * a relaxing conformation tensor. No particle bonds or prescribed topology.
 * World coordinates are in the page plane; density drives the 3D surface.
 */
export class ViscousFluid {
  constructor({ cellSize = 0.1, maxParticles = 24000, gravity = 3.4, initial = 'sheet' } = {}) {
    this.dx = cellSize;
    this.inv = 1 / cellSize;
    this.nx = Math.ceil(16 / cellSize) + 1;
    this.ny = Math.ceil(8.8 / cellSize) + 1;
    this.spacing = cellSize * 0.5;
    this.mass = this.spacing * this.spacing;
    this.maxParticles = maxParticles;
    this.gravity = gravity;
    this.obstacle = null;
    this.bounds = { left: -7.65, right: 7.65, bottom: -3.72, top: 4.2 };
    const n = this.nx * this.ny;
    for (const key of [
      'massGrid',
      'u',
      'v',
      'u0',
      'v0',
      'viscL',
      'viscR',
      'viscB',
      'viscT',
      'viscU',
      'viscV',
      'wall',
      'wallU',
      'wallV',
    ])
      this[key] = new Float32Array(n);
    this.active = [];
    this.previousSolids = new Map();
    this.seed({ mode: initial });
  }
  add(x, y, vx = 0, vy = 0) {
    if (this.particles.length >= this.maxParticles) {
      const index = this.particles.findIndex(
        (p) => p.y < this.bounds.bottom + this.dx * 2 && !p.attachment && p.mass <= this.mass,
      );
      if (index < 0) return false;
      // Recycling moves an existing parcel through the inlet. Adaptive
      // samples have different masses; replacing one with the reference mass
      // would repeatedly create or destroy fluid in the settled pool. Keep
      // oversized merged deposits out of the fixed-width inlet.
      const recycled = this._particle(x, y, vx, vy),
        mass = this.particles[index].mass;
      recycled.mass = mass;
      recycled.d00 = mass;
      recycled.d11 = mass;
      this.particles[index] = recycled;
    } else this.particles.push(this._particle(x, y, vx, vy));
    return true;
  }
  _particle(x, y, vx, vy) {
    return {
      id: this.nextId++,
      x,
      y,
      materialX: x,
      materialY: y,
      vx,
      vy,
      mass: this.mass,
      c00: 0,
      c01: 0,
      c10: 0,
      c11: 0,
      q00: 1,
      q01: 0,
      q11: 1,
      d00: this.mass,
      d01: 0,
      d11: this.mass,
      density: 1,
      attachment: null,
      weights: new Float64Array(6),
    };
  }
  seed({ mode = 'sheet', mask = null } = {}) {
    this.particles = [];
    this.nextId = 0;
    this.time = 0;
    this.accumulator = 0;
    this.emitted = 0;
    this.inletStarted = false;
    this.adaptStep = 0;
    this.splits = 0;
    this.merges = 0;
    this.previousSolids.clear();
    const s = this.spacing;
    if (mode === 'empty') return;
    if (mask) {
      this._seedCoating(mask);
      return;
    }
    for (let row = 0; row < Math.ceil(6.0 / s); row++)
      for (let col = 0; col < Math.ceil(11.0 / s); col++) {
        const x = -7.5 + col * s,
          y = -3.1 + row * s;
        const right = 1.4 + 1.35 * Math.sin((y + 2.5) * 1.13) - 0.43 * y;
        const top = 2.7 - 0.1 * (x + 5) + 0.14 * Math.sin(x * 1.9);
        if (x > right || y > top || y < -2.65 + 0.17 * Math.sin(x * 1.4)) continue;
        const holes = [
          [-5.45, 1.85, 0.64, 0.77],
          [-3.95, 0.35, 1.06, 0.53],
          [-0.95, 0.05, 1.18, 0.74],
          [-3.55, -1.91, 1.08, 0.57],
          [1.35, -1.25, 0.6, 0.66],
          [-2.7, 2.04, 0.35, 0.32],
        ];
        if (
          holes.some(([cx, cy, rx, ry]) => {
            const angle = Math.atan2((y - cy) / ry, (x - cx) / rx);
            return (
              ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <
              1 + 0.1 * Math.sin(angle * 5 + cx) + 0.035 * Math.cos(angle * 9 + cy)
            );
          })
        )
          continue;
        if (this.obstacle && !this.obstacle.drape && this.sampleObstacle(x, y).distance < s * 0.6)
          continue;
        this.add(
          x + s * 0.03 * Math.sin(col * 3.7 + row),
          y + s * 0.03 * Math.cos(row * 3.1 + col),
        );
      }
  }
  _seedCoating(mask) {
    const { nx, ny, dx, bounds } = this;
    // Exposed upward edges receive a finite coating. Interior vertical runs
    // stay connected, while counters and spaces in the lettering stay open.
    const coating = new Uint8Array(nx * ny);
    for (let y = 1; y < ny - 1; y++)
      for (let x = 1; x < nx - 1; x++) {
        if (!mask[y * nx + x] || mask[(y + 1) * nx + x]) continue;
        const layers = 3 + Math.round((Math.sin(x * 0.43) + 1) * 0.8);
        for (let offset = -1; offset < layers; offset++) {
          const row = y + offset;
          if (row > 0 && row < ny - 1) coating[row * nx + x] = 1;
        }
      }
    for (let y = 1; y < ny - 1; y++)
      for (let x = 1; x < nx - 1; x++) {
        if (!coating[y * nx + x]) continue;
        for (const oy of [-0.25, 0.25])
          for (const ox of [-0.25, 0.25]) {
            const px = (x + ox) * dx - 8,
              py = (y + oy) * dx - 4.4;
            if (px > bounds.left && px < bounds.right && py > bounds.bottom && py < bounds.top)
              this.add(px, py);
          }
      }
  }
  pour(x = -0.6, y = 3.8, radius = 0.32) {
    for (let py = -radius; py <= radius; py += this.spacing)
      for (let px = -radius; px <= radius; px += this.spacing)
        if (px * px + py * py < radius * radius) this.add(x + px, y + py, 0, -0.06);
  }
  grab(x, y) {
    const weights = new Map(),
      offsets = new Map();
    for (const p of this.particles) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 0.42) {
        weights.set(p.id, Math.exp((-d * d) / 0.045));
        offsets.set(p.id, [p.x - x, p.y - y]);
      }
    }
    return { x, y, weights, offsets };
  }
  setObstacleMask(mask, { drape = false } = {}) {
    if (
      this.obstacleMask?.length === mask.length &&
      this.obstacle?.drape === drape &&
      mask.every((v, i) => v === this.obstacleMask[i])
    )
      return;
    const first = !this.obstacleMask;
    this.obstacleMask = mask;
    const { nx, ny, dx, inv } = this,
      n = nx * ny,
      inside = new Float32Array(n),
      outside = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      inside[i] = mask[i] ? 0 : 1e5;
      outside[i] = mask[i] ? 1e5 : 0;
    }
    const transform = (field) => {
      for (let y = 0; y < ny; y++)
        for (let x = 0; x < nx; x++) {
          const k = y * nx + x;
          let v = field[k];
          if (x > 0) v = Math.min(v, field[k - 1] + 1);
          if (y > 0) v = Math.min(v, field[k - nx] + 1);
          if (x > 0 && y > 0) v = Math.min(v, field[k - nx - 1] + Math.SQRT2);
          if (x < nx - 1 && y > 0) v = Math.min(v, field[k - nx + 1] + Math.SQRT2);
          field[k] = v;
        }
      for (let y = ny - 1; y >= 0; y--)
        for (let x = nx - 1; x >= 0; x--) {
          const k = y * nx + x;
          let v = field[k];
          if (x < nx - 1) v = Math.min(v, field[k + 1] + 1);
          if (y < ny - 1) v = Math.min(v, field[k + nx] + 1);
          if (x < nx - 1 && y < ny - 1) v = Math.min(v, field[k + nx + 1] + Math.SQRT2);
          if (x > 0 && y < ny - 1) v = Math.min(v, field[k + nx - 1] + Math.SQRT2);
          field[k] = v;
        }
    };
    transform(inside);
    transform(outside);
    const distance = new Float32Array(n),
      gx = new Float32Array(n),
      gy = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const d = inside[k] - outside[k];
      distance[k] = (d - Math.sign(d) * 0.5) * dx;
    }
    for (let y = 1; y < ny - 1; y++)
      for (let x = 1; x < nx - 1; x++) {
        const k = y * nx + x,
          a = distance[k + 1] - distance[k - 1],
          b = distance[k + nx] - distance[k - nx],
          length = Math.hypot(a, b) || 1;
        gx[k] = a / length;
        gy[k] = b / length;
      }
    this.obstacle = { distance, gx, gy, nx, ny, inv, drape };
    if (first && !drape)
      this.particles = this.particles.filter(
        (p) => this.sampleObstacle(p.x, p.y).distance > this.spacing * 0.5,
      );
  }
  sampleObstacle(x, y) {
    const f = this.obstacle,
      px = clamp((x + 8) * f.inv, 0, f.nx - 1.001),
      py = clamp((y + 4.4) * f.inv, 0, f.ny - 1.001),
      ix = Math.floor(px),
      iy = Math.floor(py),
      fx = px - ix,
      fy = py - iy,
      k = iy * f.nx + ix;
    const sample = (a) =>
      (a[k] * (1 - fx) + a[k + 1] * fx) * (1 - fy) +
      (a[k + f.nx] * (1 - fx) + a[k + f.nx + 1] * fx) * fy;
    let nx = sample(f.gx),
      ny = sample(f.gy);
    const length = Math.hypot(nx, ny) || 1;
    return { distance: sample(f.distance), nx: nx / length, ny: ny / length };
  }
  _drapeRetentionFor(dt, stickiness) {
    const obstacle = this.obstacle;
    if (!obstacle?.drape) return null;
    if (
      this._retentionObstacle === obstacle &&
      this._retentionStep === dt &&
      this._retentionStickiness === stickiness
    )
      return this._drapeRetention;
    const retention = (this._drapeRetention ??= new Float64Array(this.nx * this.ny)),
      radius = this.dx * 0.8;
    for (let k = 0; k < retention.length; k++) {
      const d = obstacle.distance[k],
        wet = d < 0 ? 1 : d < radius ? (1 - d / radius) ** 2 : 0;
      retention[k] = Math.exp(-dt * stickiness * 800 * wet);
    }
    this._retentionObstacle = obstacle;
    this._retentionStep = dt;
    this._retentionStickiness = stickiness;
    return retention;
  }
  // Rounded-box signed distance and outward normal, shared by grid and particles.
  contact(x, y, box) {
    const cx = (box.left + box.right) / 2,
      cy = (box.top + box.bottom) / 2,
      hx = (box.right - box.left) / 2,
      hy = (box.top - box.bottom) / 2;
    const r = Math.min(box.radius || 0, hx, hy),
      dx = x - cx,
      dy = y - cy,
      qx = Math.abs(dx) - hx + r,
      qy = Math.abs(dy) - hy + r;
    const ox = Math.max(qx, 0),
      oy = Math.max(qy, 0),
      outside = Math.hypot(ox, oy);
    const distance = outside + Math.min(Math.max(qx, qy), 0) - r;
    let nx = 0,
      ny = 0;
    if (outside > 1e-8) {
      nx = (ox / outside) * Math.sign(dx);
      ny = (oy / outside) * Math.sign(dy);
    } else if (qx > qy) nx = Math.sign(dx) || 1;
    else ny = Math.sign(dy) || 1;
    return { distance, nx, ny };
  }
  step(
    dt,
    {
      viscosity = 0.88,
      drag = 0,
      stickiness = 0.85,
      flow = 0.55,
      emit = true,
      solids = [],
      grab = null,
    } = {},
  ) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    const moving = solids.map((s, i) => {
      const id = s.id ?? i,
        x = (s.left + s.right) / 2,
        y = (s.top + s.bottom) / 2,
        old = this.previousSolids.get(id);
      this.previousSolids.set(id, { x, y });
      return {
        ...s,
        id,
        vx: old ? clamp((x - old.x) / dt, -5, 5) : 0,
        vy: old ? clamp((y - old.y) / dt, -5, 5) : 0,
      };
    });
    this.accumulator += dt;
    const hdt = this.dx >= 0.12 ? 1 / 180 : 1 / 240;
    while (this.accumulator >= hdt - 1e-9) {
      this.substep(hdt, { viscosity, drag, stickiness, flow, emit, solids: moving, grab });
      this.accumulator -= hdt;
    }
  }
  substep(dt, { viscosity, drag = 0, stickiness, flow, emit, solids, grab }) {
    this.time += dt;
    // Feed a filled nozzle at a prescribed flux. Isolated free-falling rows
    // produce pellets before a fluid neck has a chance to form.
    const inletSpeed = 0.68 + flow * 0.45,
      inletY = 2.55,
      inletHalfWidth = 0.3;
    if (emit) {
      if (!this.inletStarted) {
        const reservoir = this.particles.filter(
          (p) => p.x < -6.7 && Math.abs(p.y - inletY) < inletHalfWidth + this.spacing,
        );
        for (let x = -7.4; x <= -6.82; x += this.spacing)
          for (let y = -inletHalfWidth; y <= inletHalfWidth; y += this.spacing) {
            if (!reservoir.some((p) => Math.hypot(p.x - x, p.y - inletY - y) < this.spacing * 0.65))
              this.add(x, inletY + y, inletSpeed, 0);
          }
        this.inletStarted = true;
      }
      this.emitted += (dt * inletSpeed) / this.spacing;
      while (this.emitted >= 1) {
        for (let y = -inletHalfWidth; y <= inletHalfWidth; y += this.spacing)
          this.add(-7.4, inletY + y, inletSpeed, 0);
        this.emitted--;
      }
    }
    const { nx, ny, inv, dx, mass, massGrid, u, v, active } = this;
    const drapeRetention = this._drapeRetentionFor(dt, stickiness);
    massGrid.fill(0);
    u.fill(0);
    v.fill(0);
    active.length = 0;
    // P2G: quadratic B-spline interpolation conserves particle mass and momentum.
    for (const p of this.particles) {
      const gx = (p.x + 8) * inv,
        gy = (p.y + 4.4) * inv,
        bx = Math.floor(gx - 0.5),
        by = Math.floor(gy - 0.5),
        fx = gx - bx,
        fy = gy - by,
        w = p.weights;
      p.bx = bx;
      p.by = by;
      p.fx = fx;
      p.fy = fy;
      w[0] = 0.5 * (1.5 - fx) ** 2;
      w[1] = 0.75 - (fx - 1) ** 2;
      w[2] = 0.5 * (fx - 0.5) ** 2;
      w[3] = 0.5 * (1.5 - fy) ** 2;
      w[4] = 0.75 - (fy - 1) ** 2;
      w[5] = 0.5 * (fy - 0.5) ** 2;
      const pvx = p.vx,
        pvy = p.vy,
        pc00 = p.c00,
        pc01 = p.c01,
        pc10 = p.c10,
        pc11 = p.c11,
        particleMass = p.mass;
      for (let j = 0; j < 3; j++) {
        const row = (by + j) * nx + bx,
          wy = w[3 + j],
          ry = (j - fy) * dx,
          tx = pc01 * ry,
          ty = pc11 * ry;
        for (let i = 0; i < 3; i++) {
          const k = row + i,
            weight = w[i] * wy,
            rx = (i - fx) * dx;
          if (weight < 1e-12) continue;
          if (massGrid[k] === 0) active.push(k);
          const weightedMass = weight * particleMass;
          massGrid[k] += weightedMass;
          u[k] += weightedMass * (pvx + pc00 * rx + tx);
          v[k] += weightedMass * (pvy + pc10 * rx + ty);
        }
      }
    }
    // Pressure + polymer stress divergence. Volume is re-estimated each step,
    // so fluid can separate and merge without a reference shape or springs.
    const modulus = 0.15 + viscosity * viscosity * 2.8;
    for (const p of this.particles) {
      const w = p.weights,
        bx = p.bx,
        by = p.by,
        fx = p.fx,
        fy = p.fy;
      let rho = 0;
      for (let j = 0; j < 3; j++) {
        const row = (by + j) * nx + bx,
          wy = w[3 + j];
        for (let i = 0; i < 3; i++) rho += w[i] * wy * massGrid[row + i] * inv * inv;
      }
      p.density = rho;
      const rho2 = rho * rho;
      const pressure = clamp(22 * (rho2 * rho2 - 1), -0.65, 100),
        volume = p.mass / Math.max(0.3, rho);
      const extensibility = 30 / Math.max(0.001, 32 - p.q00 - p.q11);
      const s00 = -pressure + modulus * (extensibility * p.q00 - 1),
        s01 = modulus * extensibility * p.q01,
        s11 = -pressure + modulus * (extensibility * p.q11 - 1);
      const coefficient = -dt * volume * 4 * inv * inv;
      for (let j = 0; j < 3; j++) {
        const row = (by + j) * nx + bx,
          wy = w[3 + j],
          ry = (j - fy) * dx,
          tx = s01 * ry,
          ty = s11 * ry;
        for (let i = 0; i < 3; i++) {
          const k = row + i,
            weight = w[i] * wy,
            rx = (i - fx) * dx;
          if (weight < 1e-12) continue;
          u[k] += coefficient * weight * (s00 * rx + tx);
          v[k] += coefficient * weight * (s01 * rx + ty);
        }
      }
    }
    this.wall.fill(0);
    this.wallU.fill(0);
    this.wallV.fill(0);
    for (const k of active) {
      u[k] = clamp(u[k] / massGrid[k], -9, 9);
      v[k] = clamp(v[k] / massGrid[k] - dt * this.gravity, -9, 9);
      const ix = k % nx,
        iy = (k / nx) | 0,
        x = ix * dx - 8,
        y = iy * dx - 4.4;
      if (x < this.bounds.left + dx || x > this.bounds.right - dx || y < this.bounds.bottom + dx) {
        this.wall[k] = 1;
      }
      if (emit && Math.abs(y - inletY) < inletHalfWidth + dx && x < -6.84) {
        this.wall[k] = 1;
        this.wallU[k] = inletSpeed;
      }
      if (this.obstacle && this.obstacle.distance[k] < dx * 0.8) {
        const d = this.obstacle.distance[k],
          normalX = this.obstacle.gx[k],
          normalY = this.obstacle.gy[k];
        if (this.obstacle.drape) {
          // A submerged relief retains fluid through wet friction without
          // cutting the planar mass into separate pockets inside glyphs.
          const retention = drapeRetention[k];
          u[k] *= retention;
          v[k] *= retention;
        } else {
          this.wall[k] = Math.max(this.wall[k], d < 0 ? 1 : stickiness * (1 - d / (dx * 0.8)) ** 2);
          const normal = u[k] * normalX + v[k] * normalY;
          if (normal < 0 && d < dx * 0.35) {
            u[k] -= normal * normalX;
            v[k] -= normal * normalY;
          }
        }
      }
      for (const box of solids) {
        if (x < box.left - dx || x > box.right + dx || y < box.bottom - dx || y > box.top + dx)
          continue;
        const c = this.contact(x, y, box);
        if (c.distance < dx * 0.8) {
          const weight = c.distance < 0 ? 1 : stickiness * Math.pow(1 - c.distance / (dx * 0.8), 2);
          this.wall[k] = Math.max(this.wall[k], weight);
          this.wallU[k] = box.vx;
          this.wallV[k] = box.vy;
          const normal = (u[k] - box.vx) * c.nx + (v[k] - box.vy) * c.ny;
          if (normal < 0 && c.distance < dx * 0.35) {
            u[k] -= normal * c.nx;
            v[k] -= normal * c.ny;
          }
        }
      }
      this.u0[k] = u[k];
      this.v0[k] = v[k];
    }
    // Backward-Euler viscosity with precomputed coefficients and six SOR
    // sweeps. In-place updates propagate wet-wall and shear response faster.
    const alpha = (0.018 + viscosity * viscosity * 3.5) * dt * inv * inv;
    const { viscL, viscR, viscB, viscT, viscU, viscV } = this;
    for (const k of active) {
      const denominator = Math.max(massGrid[k], mass * 0.02),
        cutoff = mass * 0.001;
      const wl = massGrid[k - 1] >= cutoff ? Math.min(1, massGrid[k - 1] / denominator) : 0,
        wr = massGrid[k + 1] >= cutoff ? Math.min(1, massGrid[k + 1] / denominator) : 0;
      const wb = massGrid[k - nx] >= cutoff ? Math.min(1, massGrid[k - nx] / denominator) : 0,
        wt = massGrid[k + nx] >= cutoff ? Math.min(1, massGrid[k + nx] / denominator) : 0;
      const wall = this.wall[k],
        inverse = (1 - wall) / (1 + alpha * (wl + wr + wb + wt)),
        scale = alpha * inverse;
      viscL[k] = wl * scale;
      viscR[k] = wr * scale;
      viscB[k] = wb * scale;
      viscT[k] = wt * scale;
      viscU[k] = this.u0[k] * inverse + this.wallU[k] * wall;
      viscV[k] = this.v0[k] * inverse + this.wallV[k] * wall;
      if (wall === 1) {
        u[k] = viscU[k];
        v[k] = viscV[k];
      }
    }
    const readU = u,
      readV = v;
    for (let iteration = 0; iteration < 6; iteration++) {
      for (let index = 0; index < active.length; index++) {
        const k = active[iteration % 2 === 0 ? index : active.length - 1 - index];
        const a =
          viscU[k] +
          viscL[k] * (u[k - 1] ?? 0) +
          viscR[k] * (u[k + 1] ?? 0) +
          viscB[k] * (u[k - nx] ?? 0) +
          viscT[k] * (u[k + nx] ?? 0);
        const b =
          viscV[k] +
          viscL[k] * (v[k - 1] ?? 0) +
          viscR[k] * (v[k + 1] ?? 0) +
          viscB[k] * (v[k - nx] ?? 0) +
          viscT[k] * (v[k + nx] ?? 0);
        u[k] += 1.15 * (a - u[k]);
        v[k] += 1.15 * (b - v[k]);
      }
    }
    // G2P: advect mass and its affine velocity field. Tensor stress is local to
    // material, convects with flow, and relaxes continuously instead of fixing shape.
    const relaxationStep = dt / (0.25 + viscosity * 2.5);
    // Environmental friction damps translation as well as shear. Unlike
    // pausing, it leaves forces, recoil, and pointer interaction continuous.
    if (drag > 0) {
      const retention = Math.exp(-dt * drag);
      for (const k of active) {
        readU[k] *= retention;
        readV[k] *= retention;
      }
    }
    for (const p of this.particles) {
      const w = p.weights,
        bx = p.bx,
        by = p.by,
        fx = p.fx,
        fy = p.fy;
      let vx = 0,
        vy = 0,
        c00 = 0,
        c01 = 0,
        c10 = 0,
        c11 = 0;
      for (let j = 0; j < 3; j++) {
        const row = (by + j) * nx + bx,
          wy = w[3 + j],
          ry = (j - fy) * dx;
        for (let i = 0; i < 3; i++) {
          const k = row + i,
            weight = w[i] * wy,
            rx = (i - fx) * dx;
          if (weight < 1e-12) continue;
          const a = readU[k],
            b = readV[k],
            wa = weight * a,
            wb = weight * b;
          vx += wa;
          vy += wb;
          c00 += wa * rx;
          c01 += wa * ry;
          c10 += wb * rx;
          c11 += wb * ry;
        }
      }
      const factor = 4 * inv * inv;
      p.c00 = clamp(c00 * factor, -25, 25);
      p.c01 = clamp(c01 * factor, -25, 25);
      p.c10 = clamp(c10 * factor, -25, 25);
      p.c11 = clamp(c11 * factor, -25, 25);
      const a = 1 + dt * p.c00,
        b = dt * p.c01,
        c = dt * p.c10,
        d = 1 + dt * p.c11;
      const q00 = a * a * p.q00 + 2 * a * b * p.q01 + b * b * p.q11,
        q01 = a * c * p.q00 + (a * d + b * c) * p.q01 + b * d * p.q11,
        q11 = c * c * p.q00 + 2 * c * d * p.q01 + d * d * p.q11;
      // Implicit FENE-P relaxation uses the same finite-extension factor as
      // stress. Solve the trace first, then scale the positive tensor.
      const bt = q00 + q11 + 2 * relaxationStep,
        sum = 32 + 30 * relaxationStep + bt;
      const trace = (64 * bt) / (sum + Math.sqrt(Math.max(0, sum * sum - 128 * bt))),
        tensorScale = trace / bt;
      p.q00 = (q00 + relaxationStep) * tensorScale;
      p.q11 = (q11 + relaxationStep) * tensorScale;
      p.q01 = q01 * tensorScale;
      const d00 = a * a * p.d00 + 2 * a * b * p.d01 + b * b * p.d11,
        d01 = a * c * p.d00 + (a * d + b * c) * p.d01 + b * d * p.d11,
        d11 = c * c * p.d00 + 2 * c * d * p.d01 + d * d * p.d11;
      p.d00 = d00;
      p.d01 = d01;
      p.d11 = d11;
      if (grab) {
        const weight = grab.weights.get(p.id) || 0;
        if (weight) {
          const offset = grab.offsets.get(p.id),
            gain = 1 - Math.exp(-dt * 110 * weight);
          vx += (clamp((grab.x + offset[0] - p.x) * 15, -6, 6) - vx) * gain;
          vy += (clamp((grab.y + offset[1] - p.y) * 15, -6, 6) - vy) * gain;
        }
      }
      p.vx = vx;
      p.vy = vy;
      p.x += vx * dt;
      p.y += vy * dt;
      p.attachment = null;
      if (this.obstacle && !this.obstacle.drape) {
        const contact = this.sampleObstacle(p.x, p.y),
          radius = this.spacing * 0.5;
        if (contact.distance < radius) {
          p.x += contact.nx * (radius - contact.distance);
          p.y += contact.ny * (radius - contact.distance);
          const normal = p.vx * contact.nx + p.vy * contact.ny;
          if (normal < 0) {
            p.vx -= normal * contact.nx;
            p.vy -= normal * contact.ny;
          }
          p.vx *= 1 - stickiness * 0.4;
          p.vy *= 1 - stickiness * 0.4;
        }
        if (contact.distance < dx * 0.65 && stickiness > 0.02) p.attachment = { body: 'text' };
      }
      for (const box of solids) {
        if (
          p.x < box.left - dx ||
          p.x > box.right + dx ||
          p.y < box.bottom - dx ||
          p.y > box.top + dx
        )
          continue;
        const c = this.contact(p.x, p.y, box),
          radius = this.spacing * 0.5;
        if (c.distance < radius) {
          p.x += c.nx * (radius - c.distance);
          p.y += c.ny * (radius - c.distance);
          const normal = (p.vx - box.vx) * c.nx + (p.vy - box.vy) * c.ny;
          if (normal < 0) {
            p.vx -= normal * c.nx;
            p.vy -= normal * c.ny;
          }
          p.vx += (box.vx - p.vx) * stickiness * 0.4;
          p.vy += (box.vy - p.vy) * stickiness * 0.4;
        }
        if (c.distance < dx * 0.65 && stickiness > 0.02) p.attachment = { body: box.id };
      }
      if (p.x < this.bounds.left || p.x > this.bounds.right) {
        p.x = clamp(p.x, this.bounds.left, this.bounds.right);
        p.vx = 0;
        p.c00 = p.c01 = p.c10 = p.c11 = 0;
      }
      if (p.y < this.bounds.bottom) {
        p.y = this.bounds.bottom;
        p.vy = 0;
        p.vx *= 0.85;
        p.c00 = p.c01 = p.c10 = p.c11 = 0;
      }
      if (p.y > this.bounds.top) {
        p.y = this.bounds.top;
        p.vy = Math.min(0, p.vy);
      }
    }
    if (++this.adaptStep % 4 === 0) this._adaptParticles(solids, grab);
  }
  _adaptParticles(solids, grab) {
    // Refine the material quadrature, not its topology. A stretched sample
    // becomes two half-mass samples before their grid support can separate.
    const threshold = this.mass * 1.7 ** 2,
      initialCount = this.particles.length;
    if (initialCount > this.maxParticles * 0.9) this._mergeSettled(grab);
    const count = this.particles.length;
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const p = this.particles[i];
      if (
        p.mass <= this.mass / 16 ||
        p.attachment ||
        grab?.weights.has(p.id) ||
        (p.y < this.bounds.bottom + this.dx * 3 && Math.hypot(p.vx, p.vy) < 0.15)
      )
        continue;
      const gap = Math.hypot(p.d00 - p.d11, 2 * p.d01),
        eigenvalue = (p.d00 + p.d11 + gap) * 0.5;
      if (eigenvalue < threshold) continue;
      const angle = 0.5 * Math.atan2(2 * p.d01, p.d00 - p.d11),
        nx = Math.cos(angle),
        ny = Math.sin(angle),
        offset = Math.sqrt(eigenvalue) * 0.25;
      const ox = nx * offset,
        oy = ny * offset,
        x = p.x,
        y = p.y;
      const clear = (px, py) =>
        px > this.bounds.left &&
        px < this.bounds.right &&
        py > this.bounds.bottom &&
        py < this.bounds.top &&
        (!this.obstacle ||
          this.obstacle.drape ||
          this.sampleObstacle(px, py).distance > this.spacing * 0.5) &&
        !solids.some((box) => this.contact(px, py, box).distance < this.spacing * 0.5);
      if (!clear(x - ox, y - oy) || !clear(x + ox, y + oy)) continue;
      const vx = p.vx,
        vy = p.vy,
        dvx = p.c00 * ox + p.c01 * oy,
        dvy = p.c10 * ox + p.c11 * oy;
      p.mass *= 0.5;
      p.d00 -= eigenvalue * 0.75 * nx * nx;
      p.d01 -= eigenvalue * 0.75 * nx * ny;
      p.d11 -= eigenvalue * 0.75 * ny * ny;
      const child = { ...p, id: this.nextId++, weights: new Float64Array(6) };
      p.x = x - ox;
      p.y = y - oy;
      p.vx = vx - dvx;
      p.vy = vy - dvy;
      child.x = x + ox;
      child.y = y + oy;
      child.vx = vx + dvx;
      child.vy = vy + dvy;
      this.particles.push(child);
      this.splits++;
    }
  }
  _mergeSettled(grab) {
    // Coarsen only quiet floor deposits. Weighted centroids preserve mass and
    // linear momentum; the material-domain moment includes the pair separation.
    const cells = new Map(),
      removed = new Set(),
      cell = this.spacing * 1.15;
    for (const p of this.particles) {
      if (
        p.y > this.bounds.bottom + this.dx * 3 ||
        p.attachment ||
        Math.hypot(p.vx, p.vy) > 0.15 ||
        grab?.weights.has(p.id) ||
        p.mass >= this.mass * 2
      )
        continue;
      const key = Math.floor((p.x + 8) / cell) + ',' + Math.floor((p.y + 4.4) / cell),
        other = cells.get(key);
      if (!other || other.mass + p.mass > this.mass * 2) {
        cells.set(key, p);
        continue;
      }
      const total = other.mass + p.mass,
        wa = other.mass / total,
        wb = p.mass / total,
        ox = p.x - other.x,
        oy = p.y - other.y;
      for (const name of [
        'x',
        'y',
        'materialX',
        'materialY',
        'vx',
        'vy',
        'c00',
        'c01',
        'c10',
        'c11',
        'q00',
        'q01',
        'q11',
        'density',
      ])
        other[name] = other[name] * wa + p[name] * wb;
      other.d00 = other.d00 * wa + p.d00 * wb + 12 * wa * wb * ox * ox;
      other.d01 = other.d01 * wa + p.d01 * wb + 12 * wa * wb * ox * oy;
      other.d11 = other.d11 * wa + p.d11 * wb + 12 * wa * wb * oy * oy;
      other.mass = total;
      removed.add(p.id);
      this.merges++;
      cells.delete(key);
    }
    if (removed.size) this.particles = this.particles.filter((p) => !removed.has(p.id));
  }
}
