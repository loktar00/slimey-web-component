import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

/** Mass-derived liquid surface, with an optional back face. The contour carries a rounded rim;
 * the interior thins with the liquid's local polymer extension. Geometry is
 * generated only where particles supply mass, including stretched necks.
 */
export class FluidSurface extends THREE.Mesh {
  constructor(material, resolution = 256, { closed = true } = {}) {
    const geometry = new THREE.BufferGeometry();
    const cells = resolution * Math.ceil((resolution * 8.8) / 16),
      capacity = cells * 8;
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'gooThickness',
      new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'gooMaterialUV',
      new THREE.BufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setIndex(
      new THREE.BufferAttribute(new Uint32Array(cells * 24), 1).setUsage(THREE.DynamicDrawUsage),
    );
    super(geometry, material);
    this.frustumCulled = false;
    this.position.z = 0.1;
    this.closed = closed;
    this.nx = resolution;
    this.ny = Math.ceil((resolution * 8.8) / 16);
    this.sx = 16 / (this.nx - 1);
    this.sy = 8.8 / (this.ny - 1);
    const size = this.nx * this.ny;
    for (const name of [
      'density',
      'extension',
      'distance',
      'height',
      'relief',
      'gx',
      'gy',
      'materialU',
      'materialV',
      'materialMass',
    ])
      this[name] = new Float32Array(size);
    this.polygon = Array.from({ length: 5 }, () => new Float64Array(9));
    this.vertexCache = new Int32Array(size * 8);
    this.filterTemp = new Float32Array(size);
    let seed = 1729;
    this.noise = new SimplexNoise({
      random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    });
    this.isolation = 0.24;
  }
  rebuild(particles, solids = [], particleSpacing = 0.05, obstacle = null) {
    const { nx, ny, sx, sy, density, extension, relief, materialU, materialV, materialMass } = this;
    density.fill(0);
    extension.fill(0);
    materialU.fill(0);
    materialV.fill(0);
    const rebuildRelief = !obstacle?.drape || this._reliefObstacle !== obstacle;
    if (rebuildRelief) relief.fill(0);
    const radius = particleSpacing * 2.5,
      kernelScale = 3 / (Math.PI * radius * radius);
    for (const p of particles) {
      const amplitude = (p.mass ?? particleSpacing ** 2) * kernelScale;
      const u = p.materialX ?? p.x,
        v = p.materialY ?? p.y;
      const cx = (p.x + 8) / sx,
        cy = (p.y + 4.4) / sy,
        rx = radius / sx,
        ry = radius / sy;
      // The conformation tensor comes from the fluid solver, so stretched
      // material becomes a thinner sheet while compressed folds remain full.
      const thinning = 1 / Math.sqrt(Math.max(1, ((p.q00 ?? 1) + (p.q11 ?? 1)) * 0.5));
      const invRx = 1 / rx,
        invRy = 1 / ry;
      for (
        let y = Math.max(0, Math.ceil(cy - ry));
        y <= Math.min(ny - 1, Math.floor(cy + ry));
        y++
      ) {
        const dy = (y - cy) * invRy,
          dy2 = dy * dy,
          row = y * nx;
        for (
          let x = Math.max(0, Math.ceil(cx - rx));
          x <= Math.min(nx - 1, Math.floor(cx + rx));
          x++
        ) {
          const dx = (x - cx) * invRx,
            r2 = dx * dx + dy2;
          if (r2 < 1) {
            const k = row + x,
              w = amplitude * (1 - r2) ** 2;
            density[k] += w;
            extension[k] += w * thinning;
            materialU[k] += w * u;
            materialV[k] += w * v;
          }
        }
      }
    }
    // Filter mass and its weighted quantities together. This suppresses
    // sampling-scale scallops without painting over empty holes or solids.
    for (const field of [density, extension, materialU, materialV]) this._smooth(field);
    // Material coordinates travel with mass, including solver split/merge
    // operations. Normalize before obstacle clipping so UVs remain continuous.
    materialMass.set(density);
    for (let k = 0; k < density.length; k++)
      if (density[k] > 1e-8) {
        materialU[k] /= density[k];
        materialV[k] /= density[k];
      }
    const cell = Math.max(sx, sy),
      iso = this.isolation;
    for (const box of solids) {
      const cx = (box.left + box.right) / 2,
        cy = (box.top + box.bottom) / 2,
        hx = (box.right - box.left) / 2,
        hy = (box.top - box.bottom) / 2,
        r = Math.min(box.radius || 0, hx, hy);
      for (
        let y = Math.max(0, Math.floor((box.bottom - cell + 4.4) / sy));
        y <= Math.min(ny - 1, Math.ceil((box.top + cell + 4.4) / sy));
        y++
      )
        for (
          let x = Math.max(0, Math.floor((box.left - cell + 8) / sx));
          x <= Math.min(nx - 1, Math.ceil((box.right + cell + 8) / sx));
          x++
        ) {
          const dx = Math.abs(x * sx - 8 - cx) - hx + r,
            dy = Math.abs(y * sy - 4.4 - cy) - hy + r;
          const sdf =
            Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
          density[y * nx + x] = Math.min(density[y * nx + x], Math.max(0, iso + sdf / cell));
        }
    }
    if (obstacle?.distance && rebuildRelief) {
      const { distance, nx: ox, ny: oy, inv } = obstacle;
      for (let y = 0; y < ny; y++)
        for (let x = 0; x < nx; x++) {
          const k = y * nx + x;
          if (!obstacle.drape && density[k] <= 0) continue;
          const fx = Math.max(0, Math.min(ox - 1.000001, x * sx * inv)),
            fy = Math.max(0, Math.min(oy - 1.000001, y * sy * inv));
          const ix = Math.floor(fx),
            iy = Math.floor(fy),
            tx = fx - ix,
            ty = fy - iy,
            i = iy * ox + ix;
          const sdf =
            (distance[i] * (1 - tx) + distance[i + 1] * tx) * (1 - ty) +
            (distance[i + ox] * (1 - tx) + distance[i + ox + 1] * tx) * ty;
          if (obstacle.drape) {
            // A shallow submerged relief can curve a continuous sheet over a
            // glyph. This is intentionally distinct from a solid 2D cutout.
            relief[k] = 0.24 / (1 + Math.exp(Math.max(-25, Math.min(25, sdf / 0.095))));
          } else density[k] = Math.min(density[k], Math.max(0, iso + sdf / cell));
        }
    }
    this._reliefObstacle = obstacle;
    this._profile();
    this.cursor = 0;
    this.indexCursor = 0;
    this.vertexCache.fill(-1);
    for (let y = 0; y < ny - 1; y++)
      for (let x = 0; x < nx - 1; x++) {
        const a = y * nx + x,
          b = a + 1,
          c = a + nx + 1,
          d = a + nx;
        if (Math.max(density[a], density[b], density[c], density[d]) < iso) continue;
        if (Math.min(density[a], density[b], density[c], density[d]) >= iso) {
          this._quad(a, b, c, d);
          continue;
        }
        this._triangle(a, b, c);
        this._triangle(a, c, d);
      }
    this.geometry.setDrawRange(0, this.indexCursor);
    this.geometry.index.clearUpdateRanges();
    this.geometry.index.addUpdateRange(0, this.indexCursor);
    this.geometry.index.needsUpdate = true;
    for (const name of ['position', 'normal', 'gooThickness', 'gooMaterialUV']) {
      const attr = this.geometry.attributes[name];
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.cursor * attr.itemSize);
      attr.needsUpdate = true;
    }
  }
  _profile() {
    const {
        nx,
        ny,
        sx,
        sy,
        density,
        extension,
        distance,
        height,
        relief,
        gx,
        gy,
        materialU,
        materialV,
      } = this,
      iso = this.isolation;
    // Distance to the actual mass contour, in world units. Fractional edge
    // distances keep the rolled cross-section independent of grid resolution.
    distance.fill(100);
    height.fill(0);
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const k = y * nx + x,
          v = density[k];
        if (v < iso) {
          distance[k] = 0;
          continue;
        }
        if (x === 0 || y === 0 || x === nx - 1 || y === ny - 1) {
          distance[k] = 0;
          continue;
        }
        for (let dir = 0; dir < 4; dir++) {
          const j = k + (dir === 0 ? -1 : dir === 1 ? 1 : dir === 2 ? -nx : nx);
          if (density[j] < iso)
            distance[k] = Math.min(
              distance[k],
              ((dir < 2 ? sx : sy) * (v - iso)) / (v - density[j]),
            );
        }
      }
    const diagonal = Math.hypot(sx, sy);
    for (let y = 1; y < ny - 1; y++)
      for (let x = 1; x < nx - 1; x++) {
        const k = y * nx + x;
        if (density[k] < iso) continue;
        distance[k] = Math.min(
          distance[k],
          distance[k - 1] + sx,
          distance[k - nx] + sy,
          distance[k - nx - 1] + diagonal,
          distance[k - nx + 1] + diagonal,
        );
      }
    for (let y = ny - 2; y > 0; y--)
      for (let x = nx - 2; x > 0; x--) {
        const k = y * nx + x;
        if (density[k] < iso) continue;
        distance[k] = Math.min(
          distance[k],
          distance[k + 1] + sx,
          distance[k + nx] + sy,
          distance[k + nx + 1] + diagonal,
          distance[k + nx - 1] + diagonal,
        );
      }
    for (let k = 0; k < density.length; k++) {
      if (density[k] < iso) continue;
      const d = distance[k],
        mass = Math.min(1.8, density[k]),
        thinning = Math.max(0.22, Math.min(1, extension[k] / Math.max(0.01, density[k])));
      const film = (0.02 + 0.027 * Math.sqrt(mass)) * thinning;
      const rim = 0.11 * Math.exp(-(((d - 0.115) / 0.14) ** 2)) * Math.sqrt(thinning);
      const u = materialU[k],
        v = materialV[k];
      // Small folds are a material detail, not a force or a prescribed neck.
      // Sampling advected coordinates makes them stretch with the liquid.
      const broad = this._noise(u * 1.25 + v * 0.2, v * 1.7),
        fine = this._noise(u * 2.3, v * 3.1);
      const wrinkle = (0.035 * broad + 0.008 * fine) * Math.pow(thinning, 0.8);
      height[k] =
        Math.max(0.012, film + rim + relief[k] + wrinkle) * Math.sqrt(1 - Math.exp(-d / 0.055));
    }
    this._smooth(height, true);
    // Normals come from this reconstructed height, including its curved rim.
    // No screen-space noise or unrelated oscillation is applied to the sheet.
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const k = y * nx + x,
          l = y * nx + Math.max(0, x - 1),
          r = y * nx + Math.min(nx - 1, x + 1),
          b = Math.max(0, y - 1) * nx + x,
          t = Math.min(ny - 1, y + 1) * nx + x;
        gx[k] = (height[r] - height[l]) / (sx * (x === 0 || x === nx - 1 ? 1 : 2));
        gy[k] = (height[t] - height[b]) / (sy * (y === 0 || y === ny - 1 ? 1 : 2));
      }
  }
  _noise(x, y) {
    return this.noise.noise(x, y);
  }
  _smooth(field, insideOnly = false) {
    const { nx, ny, filterTemp, density, isolation } = this;
    if (!insideOnly) {
      for (let y = 0; y < ny; y++) {
        const row = y * nx,
          end = row + nx - 1;
        filterTemp[row] = (field[row] * 3 + field[row + 1]) * 0.25;
        for (let k = row + 1; k < end; k++)
          filterTemp[k] = (field[k] * 2 + field[k - 1] + field[k + 1]) * 0.25;
        filterTemp[end] = (field[end] * 3 + field[end - 1]) * 0.25;
      }
      for (let y = 0; y < ny; y++) {
        const row = y * nx,
          b = y ? -nx : 0,
          t = y < ny - 1 ? nx : 0;
        for (let k = row; k < row + nx; k++)
          field[k] = (filterTemp[k] * 2 + filterTemp[k + b] + filterTemp[k + t]) * 0.25;
      }
      return;
    }
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const k = y * nx + x,
          l = x ? k - 1 : k,
          r = x < nx - 1 ? k + 1 : k,
          c = field[k];
        filterTemp[k] =
          insideOnly && density[k] < isolation
            ? 0
            : (c * 2 +
                (insideOnly && density[l] < isolation ? c : field[l]) +
                (insideOnly && density[r] < isolation ? c : field[r])) *
              0.25;
      }
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const k = y * nx + x,
          b = y ? k - nx : k,
          t = y < ny - 1 ? k + nx : k,
          c = filterTemp[k];
        field[k] =
          insideOnly && density[k] < isolation
            ? 0
            : (c * 2 +
                (insideOnly && density[b] < isolation ? c : filterTemp[b]) +
                (insideOnly && density[t] < isolation ? c : filterTemp[t])) *
              0.25;
      }
  }
  _corner(i, side) {
    this.geometry.index.array[this.indexCursor++] = this._gridVertex(i, side);
  }
  _gridVertex(i, side) {
    const cached = this.vertexCache[i * 2 + (side < 0 ? 1 : 0)];
    if (cached >= 0) return cached;
    const index = this.cursor++,
      k = index * 3,
      j = index * 2,
      attributes = this.geometry.attributes;
    const p = attributes.position.array,
      n = attributes.normal.array,
      uv = attributes.gooMaterialUV.array;
    const length = Math.sqrt(this.gx[i] * this.gx[i] + this.gy[i] * this.gy[i] + 1);
    this.vertexCache[i * 2 + (side < 0 ? 1 : 0)] = index;
    p[k] = (i % this.nx) * this.sx - 8;
    p[k + 1] = ((i / this.nx) | 0) * this.sy - 4.4;
    p[k + 2] = this.height[i] * side;
    n[k] = -this.gx[i] / length;
    n[k + 1] = -this.gy[i] / length;
    n[k + 2] = side / length;
    uv[j] = this.materialU[i];
    uv[j + 1] = this.materialV[i];
    attributes.gooThickness.array[index] = this.height[i] * 2;
    return index;
  }
  _quad(a, b, c, d) {
    const index = this.geometry.index.array;
    const p = this._gridVertex(a, 1),
      q = this._gridVertex(b, 1),
      r = this._gridVertex(c, 1),
      s = this._gridVertex(d, 1);
    let k = this.indexCursor;
    index[k++] = p;
    index[k++] = q;
    index[k++] = r;
    index[k++] = p;
    index[k++] = r;
    index[k++] = s;
    if (this.closed) {
      const p = this._gridVertex(a, -1),
        q = this._gridVertex(b, -1),
        r = this._gridVertex(c, -1),
        s = this._gridVertex(d, -1);
      index[k++] = p;
      index[k++] = r;
      index[k++] = q;
      index[k++] = p;
      index[k++] = s;
      index[k++] = r;
    }
    this.indexCursor = k;
  }
  _triangle(a, b, c) {
    const { density, height, gx, gy, nx, ny, sx, sy, polygon, materialU, materialV, materialMass } =
        this,
      iso = this.isolation;
    if (density[a] >= iso && density[b] >= iso && density[c] >= iso) {
      this._corner(a, 1);
      this._corner(b, 1);
      this._corner(c, 1);
      if (this.closed) {
        this._corner(a, -1);
        this._corner(c, -1);
        this._corner(b, -1);
      }
      return;
    }
    let count = 0;
    for (let edge = 0; edge < 3; edge++) {
      const i = edge === 0 ? a : edge === 1 ? b : c,
        j = edge === 0 ? b : edge === 1 ? c : a,
        vi = density[i],
        vj = density[j];
      if (vi >= iso) {
        const p = polygon[count++],
          length = Math.hypot(gx[i], gy[i], 1);
        p[0] = (i % nx) * sx - 8;
        p[1] = ((i / nx) | 0) * sy - 4.4;
        p[2] = height[i];
        p[3] = -gx[i] / length;
        p[4] = -gy[i] / length;
        p[5] = 1 / length;
        p[6] = materialU[i];
        p[7] = materialV[i];
        p[8] = i;
      }
      if (vi >= iso !== vj >= iso) {
        const t = (iso - vi) / (vj - vi),
          p = polygon[count++];
        p[0] = ((i % nx) + ((j % nx) - (i % nx)) * t) * sx - 8;
        p[1] = (((i / nx) | 0) + (((j / nx) | 0) - ((i / nx) | 0)) * t) * sy - 4.4;
        p[2] = 0;
        const ix = i % nx,
          iy = (i / nx) | 0,
          jx = j % nx,
          jy = (j / nx) | 0;
        const dxI =
          (density[iy * nx + Math.min(nx - 1, ix + 1)] - density[iy * nx + Math.max(0, ix - 1)]) /
          (2 * sx);
        const dyI =
          (density[Math.min(ny - 1, iy + 1) * nx + ix] - density[Math.max(0, iy - 1) * nx + ix]) /
          (2 * sy);
        const dxJ =
          (density[jy * nx + Math.min(nx - 1, jx + 1)] - density[jy * nx + Math.max(0, jx - 1)]) /
          (2 * sx);
        const dyJ =
          (density[Math.min(ny - 1, jy + 1) * nx + jx] - density[Math.max(0, jy - 1) * nx + jx]) /
          (2 * sy);
        const dx = dxI + (dxJ - dxI) * t,
          dy = dyI + (dyJ - dyI) * t,
          length = Math.hypot(dx, dy) || 1;
        p[3] = -dx / length;
        p[4] = -dy / length;
        p[5] = 0;
        const mi = materialMass[i] > 1e-8 ? i : j,
          mj = materialMass[j] > 1e-8 ? j : i;
        p[6] = materialU[mi] + (materialU[mj] - materialU[mi]) * t;
        p[7] = materialV[mi] + (materialV[mj] - materialV[mi]) * t;
        const difference = Math.abs(j - i),
          size = nx * ny;
        p[8] = Math.min(i, j) + size * (difference === 1 ? 1 : difference === nx ? 2 : 3);
      }
    }
    for (let i = 1; i < count - 1; i++) {
      this._vertex(polygon[0], 1);
      this._vertex(polygon[i], 1);
      this._vertex(polygon[i + 1], 1);
      if (this.closed) {
        this._vertex(polygon[0], -1);
        this._vertex(polygon[i + 1], -1);
        this._vertex(polygon[i], -1);
      }
    }
  }
  _vertex(p, side) {
    const key = p[8] * 2 + (side < 0 ? 1 : 0);
    let index = this.vertexCache[key];
    if (index >= 0) {
      this.geometry.index.array[this.indexCursor++] = index;
      return;
    }
    index = this.cursor++;
    this.vertexCache[key] = index;
    this.geometry.index.array[this.indexCursor++] = index;
    const pos = this.geometry.attributes.position.array,
      normal = this.geometry.attributes.normal.array,
      k = index * 3;
    pos[k] = p[0];
    pos[k + 1] = p[1];
    pos[k + 2] = p[2] * side;
    normal[k] = p[3];
    normal[k + 1] = p[4];
    normal[k + 2] = p[5] * side;
    this.geometry.attributes.gooThickness.array[this.cursor - 1] = p[2] * 2;
    const uv = this.geometry.attributes.gooMaterialUV.array,
      j = (this.cursor - 1) * 2;
    uv[j] = p[6];
    uv[j + 1] = p[7];
  }
}
