/*! Bundled Three.js addons:
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
import * as e from "three";
import { BackSide as t, BoxGeometry as n, InstancedMesh as r, Mesh as i, MeshLambertMaterial as a, MeshStandardMaterial as o, Object3D as s, PointLight as c, Scene as l } from "three";
//#region node_modules/three/examples/jsm/environments/RoomEnvironment.js
var u = class extends l {
	constructor() {
		super();
		let e = new n();
		e.deleteAttribute("uv");
		let a = new o({ side: t }), l = new o(), u = new c(16777215, 900, 28, 2);
		u.position.set(.418, 16.199, .3), this.add(u);
		let f = new i(e, a);
		f.position.set(-.757, 13.219, .717), f.scale.set(31.713, 28.305, 28.591), this.add(f);
		let p = new r(e, l, 6), m = new s();
		m.position.set(-10.906, 2.009, 1.846), m.rotation.set(0, -.195, 0), m.scale.set(2.328, 7.905, 4.651), m.updateMatrix(), p.setMatrixAt(0, m.matrix), m.position.set(-5.607, -.754, -.758), m.rotation.set(0, .994, 0), m.scale.set(1.97, 1.534, 3.955), m.updateMatrix(), p.setMatrixAt(1, m.matrix), m.position.set(6.167, .857, 7.803), m.rotation.set(0, .561, 0), m.scale.set(3.927, 6.285, 3.687), m.updateMatrix(), p.setMatrixAt(2, m.matrix), m.position.set(-2.017, .018, 6.124), m.rotation.set(0, .333, 0), m.scale.set(2.002, 4.566, 2.064), m.updateMatrix(), p.setMatrixAt(3, m.matrix), m.position.set(2.291, -.756, -2.621), m.rotation.set(0, -.286, 0), m.scale.set(1.546, 1.552, 1.496), m.updateMatrix(), p.setMatrixAt(4, m.matrix), m.position.set(-2.193, -.369, -5.547), m.rotation.set(0, .516, 0), m.scale.set(3.875, 3.487, 2.986), m.updateMatrix(), p.setMatrixAt(5, m.matrix), this.add(p);
		let h = new i(e, d(50));
		h.position.set(-16.116, 14.37, 8.208), h.scale.set(.1, 2.428, 2.739), this.add(h);
		let g = new i(e, d(50));
		g.position.set(-16.109, 18.021, -8.207), g.scale.set(.1, 2.425, 2.751), this.add(g);
		let _ = new i(e, d(17));
		_.position.set(14.904, 12.198, -1.832), _.scale.set(.15, 4.265, 6.331), this.add(_);
		let v = new i(e, d(43));
		v.position.set(-.462, 8.89, 14.52), v.scale.set(4.38, 5.441, .088), this.add(v);
		let y = new i(e, d(20));
		y.position.set(3.235, 11.486, -12.541), y.scale.set(2.5, 2, .1), this.add(y);
		let b = new i(e, d(100));
		b.position.set(0, 20, 0), b.scale.set(1, .1, 1), this.add(b);
	}
	dispose() {
		let e = /* @__PURE__ */ new Set();
		this.traverse((t) => {
			t.isMesh && (e.add(t.geometry), e.add(t.material));
		});
		for (let t of e) t.dispose();
	}
};
function d(e) {
	return new a({
		color: 0,
		emissive: 16777215,
		emissiveIntensity: e
	});
}
//#endregion
//#region src/liquid-solver.js
var f = (e, t, n) => Math.max(t, Math.min(n, e)), p = class {
	constructor({ cellSize: e = .1, maxParticles: t = 24e3, gravity: n = 3.4, initial: r = "sheet" } = {}) {
		this.dx = e, this.inv = 1 / e, this.nx = Math.ceil(16 / e) + 1, this.ny = Math.ceil(8.8 / e) + 1, this.spacing = e * .5, this.mass = this.spacing * this.spacing, this.maxParticles = t, this.gravity = n, this.obstacle = null, this.bounds = {
			left: -7.65,
			right: 7.65,
			bottom: -3.72,
			top: 4.2
		};
		let i = this.nx * this.ny;
		for (let e of [
			"massGrid",
			"u",
			"v",
			"u0",
			"v0",
			"viscL",
			"viscR",
			"viscB",
			"viscT",
			"viscU",
			"viscV",
			"wall",
			"wallU",
			"wallV"
		]) this[e] = new Float32Array(i);
		this.active = [], this.previousSolids = /* @__PURE__ */ new Map(), this.seed({ mode: r });
	}
	add(e, t, n = 0, r = 0) {
		if (this.particles.length >= this.maxParticles) {
			let i = this.particles.findIndex((e) => e.y < this.bounds.bottom + this.dx * 2 && !e.attachment && e.mass <= this.mass);
			if (i < 0) return !1;
			let a = this._particle(e, t, n, r), o = this.particles[i].mass;
			a.mass = o, a.d00 = o, a.d11 = o, this.particles[i] = a;
		} else this.particles.push(this._particle(e, t, n, r));
		return !0;
	}
	_particle(e, t, n, r) {
		return {
			id: this.nextId++,
			x: e,
			y: t,
			materialX: e,
			materialY: t,
			vx: n,
			vy: r,
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
			weights: /* @__PURE__ */ new Float64Array(6)
		};
	}
	seed({ mode: e = "sheet", mask: t = null } = {}) {
		this.particles = [], this.nextId = 0, this.time = 0, this.accumulator = 0, this.emitted = 0, this.inletStarted = !1, this.adaptStep = 0, this.splits = 0, this.merges = 0, this.previousSolids.clear();
		let n = this.spacing;
		if (e !== "empty") {
			if (t) {
				this._seedGlyphs(t, e);
				return;
			}
			for (let e = 0; e < Math.ceil(6 / n); e++) for (let t = 0; t < Math.ceil(11 / n); t++) {
				let r = -7.5 + t * n, i = -3.1 + e * n, a = 1.4 + 1.35 * Math.sin((i + 2.5) * 1.13) - .43 * i, o = 2.7 - .1 * (r + 5) + .14 * Math.sin(r * 1.9);
				r > a || i > o || i < -2.65 + .17 * Math.sin(r * 1.4) || [
					[
						-5.45,
						1.85,
						.64,
						.77
					],
					[
						-3.95,
						.35,
						1.06,
						.53
					],
					[
						-.95,
						.05,
						1.18,
						.74
					],
					[
						-3.55,
						-1.91,
						1.08,
						.57
					],
					[
						1.35,
						-1.25,
						.6,
						.66
					],
					[
						-2.7,
						2.04,
						.35,
						.32
					]
				].some(([e, t, n, a]) => {
					let o = Math.atan2((i - t) / a, (r - e) / n);
					return ((r - e) / n) ** 2 + ((i - t) / a) ** 2 < 1 + .1 * Math.sin(o * 5 + e) + .035 * Math.cos(o * 9 + t);
				}) || this.obstacle && !this.obstacle.drape && this.sampleObstacle(r, i).distance < n * .6 || this.add(r + n * .03 * Math.sin(t * 3.7 + e), i + n * .03 * Math.cos(e * 3.1 + t));
			}
		}
	}
	_seedGlyphs(e, t) {
		let { nx: n, ny: r, dx: i, bounds: a } = this;
		if (t === "text") {
			for (let t = 1; t < r - 1; t++) for (let r = 1; r < n - 1; r++) if (e[t * n + r]) for (let e of [-.25, .25]) for (let n of [-.25, .25]) {
				let o = (r + n) * i - 8, s = (t + e) * i - 4.4;
				o > a.left && o < a.right && s > a.bottom && s < a.top && this.add(o, s);
			}
			return;
		}
		let o = new Uint8Array(n * r);
		for (let t = 1; t < r - 1; t++) for (let i = 1; i < n - 1; i++) {
			if (!e[t * n + i] || e[(t + 1) * n + i]) continue;
			let a = 3 + Math.round((Math.sin(i * .43) + 1) * .8);
			for (let e = -1; e < a; e++) {
				let a = t + e;
				a > 0 && a < r - 1 && (o[a * n + i] = 1);
			}
		}
		for (let e = 1; e < r - 1; e++) for (let t = 1; t < n - 1; t++) if (o[e * n + t]) for (let n of [-.25, .25]) for (let r of [-.25, .25]) {
			let o = (t + r) * i - 8, s = (e + n) * i - 4.4;
			o > a.left && o < a.right && s > a.bottom && s < a.top && this.add(o, s);
		}
	}
	pour(e = -.6, t = 3.8, n = .32) {
		for (let r = -n; r <= n; r += this.spacing) for (let i = -n; i <= n; i += this.spacing) i * i + r * r < n * n && this.add(e + i, t + r, 0, -.06);
	}
	grab(e, t) {
		let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
		for (let i of this.particles) {
			let a = Math.hypot(i.x - e, i.y - t);
			a < .42 && (n.set(i.id, Math.exp(-a * a / .045)), r.set(i.id, [i.x - e, i.y - t]));
		}
		return {
			x: e,
			y: t,
			weights: n,
			offsets: r
		};
	}
	setObstacleMask(e, { drape: t = !1 } = {}) {
		if (this.obstacleMask?.length === e.length && this.obstacle?.drape === t && e.every((e, t) => e === this.obstacleMask[t])) return;
		let n = !this.obstacleMask;
		this.obstacleMask = e;
		let { nx: r, ny: i, dx: a, inv: o } = this, s = r * i, c = new Float32Array(s), l = new Float32Array(s);
		for (let t = 0; t < s; t++) c[t] = e[t] ? 0 : 1e5, l[t] = e[t] ? 1e5 : 0;
		let u = (e) => {
			for (let t = 0; t < i; t++) for (let n = 0; n < r; n++) {
				let i = t * r + n, a = e[i];
				n > 0 && (a = Math.min(a, e[i - 1] + 1)), t > 0 && (a = Math.min(a, e[i - r] + 1)), n > 0 && t > 0 && (a = Math.min(a, e[i - r - 1] + Math.SQRT2)), n < r - 1 && t > 0 && (a = Math.min(a, e[i - r + 1] + Math.SQRT2)), e[i] = a;
			}
			for (let t = i - 1; t >= 0; t--) for (let n = r - 1; n >= 0; n--) {
				let a = t * r + n, o = e[a];
				n < r - 1 && (o = Math.min(o, e[a + 1] + 1)), t < i - 1 && (o = Math.min(o, e[a + r] + 1)), n < r - 1 && t < i - 1 && (o = Math.min(o, e[a + r + 1] + Math.SQRT2)), n > 0 && t < i - 1 && (o = Math.min(o, e[a + r - 1] + Math.SQRT2)), e[a] = o;
			}
		};
		u(c), u(l);
		let d = new Float32Array(s), f = new Float32Array(s), p = new Float32Array(s);
		for (let e = 0; e < s; e++) {
			let t = c[e] - l[e];
			d[e] = (t - Math.sign(t) * .5) * a;
		}
		for (let e = 1; e < i - 1; e++) for (let t = 1; t < r - 1; t++) {
			let n = e * r + t, i = d[n + 1] - d[n - 1], a = d[n + r] - d[n - r], o = Math.hypot(i, a) || 1;
			f[n] = i / o, p[n] = a / o;
		}
		this.obstacle = {
			distance: d,
			gx: f,
			gy: p,
			nx: r,
			ny: i,
			inv: o,
			drape: t
		}, n && !t && (this.particles = this.particles.filter((e) => this.sampleObstacle(e.x, e.y).distance > this.spacing * .5));
	}
	sampleObstacle(e, t) {
		let n = this.obstacle, r = f((e + 8) * n.inv, 0, n.nx - 1.001), i = f((t + 4.4) * n.inv, 0, n.ny - 1.001), a = Math.floor(r), o = Math.floor(i), s = r - a, c = i - o, l = o * n.nx + a, u = (e) => (e[l] * (1 - s) + e[l + 1] * s) * (1 - c) + (e[l + n.nx] * (1 - s) + e[l + n.nx + 1] * s) * c, d = u(n.gx), p = u(n.gy), m = Math.hypot(d, p) || 1;
		return {
			distance: u(n.distance),
			nx: d / m,
			ny: p / m
		};
	}
	_drapeRetentionFor(e, t) {
		let n = this.obstacle;
		if (!n?.drape) return null;
		if (this._retentionObstacle === n && this._retentionStep === e && this._retentionStickiness === t) return this._drapeRetention;
		let r = this._drapeRetention ??= new Float64Array(this.nx * this.ny), i = this.dx * .8;
		for (let a = 0; a < r.length; a++) {
			let o = n.distance[a], s = o < 0 ? 1 : o < i ? (1 - o / i) ** 2 : 0;
			r[a] = Math.exp(-e * t * 800 * s);
		}
		return this._retentionObstacle = n, this._retentionStep = e, this._retentionStickiness = t, r;
	}
	contact(e, t, n) {
		let r = (n.left + n.right) / 2, i = (n.top + n.bottom) / 2, a = (n.right - n.left) / 2, o = (n.top - n.bottom) / 2, s = Math.min(n.radius || 0, a, o), c = e - r, l = t - i, u = Math.abs(c) - a + s, d = Math.abs(l) - o + s, f = Math.max(u, 0), p = Math.max(d, 0), m = Math.hypot(f, p), h = m + Math.min(Math.max(u, d), 0) - s, g = 0, _ = 0;
		return m > 1e-8 ? (g = f / m * Math.sign(c), _ = p / m * Math.sign(l)) : u > d ? g = Math.sign(c) || 1 : _ = Math.sign(l) || 1, {
			distance: h,
			nx: g,
			ny: _
		};
	}
	step(e, { viscosity: t = .88, drag: n = 0, stickiness: r = .85, flow: i = .55, emit: a = !0, solids: o = [], grab: s = null } = {}) {
		if (!Number.isFinite(e) || e <= 0) return;
		e = Math.min(e, .05);
		let c = o.map((t, n) => {
			let r = t.id ?? n, i = (t.left + t.right) / 2, a = (t.top + t.bottom) / 2, o = this.previousSolids.get(r);
			return this.previousSolids.set(r, {
				x: i,
				y: a
			}), {
				...t,
				id: r,
				vx: o ? f((i - o.x) / e, -5, 5) : 0,
				vy: o ? f((a - o.y) / e, -5, 5) : 0
			};
		});
		this.accumulator += e;
		let l = this.dx >= .12 ? 1 / 180 : 1 / 240;
		for (; this.accumulator >= l - 1e-9;) this.substep(l, {
			viscosity: t,
			drag: n,
			stickiness: r,
			flow: i,
			emit: a,
			solids: c,
			grab: s
		}), this.accumulator -= l;
	}
	substep(e, { viscosity: t, drag: n = 0, stickiness: r, flow: i, emit: a, solids: o, grab: s }) {
		this.time += e;
		let c = .68 + i * .45, l = 2.55, u = .3;
		if (a) {
			if (!this.inletStarted) {
				let e = this.particles.filter((e) => e.x < -6.7 && Math.abs(e.y - l) < u + this.spacing);
				for (let t = -7.4; t <= -6.82; t += this.spacing) for (let n = -.3; n <= u; n += this.spacing) e.some((e) => Math.hypot(e.x - t, e.y - l - n) < this.spacing * .65) || this.add(t, l + n, c, 0);
				this.inletStarted = !0;
			}
			for (this.emitted += e * c / this.spacing; this.emitted >= 1;) {
				for (let e = -.3; e <= u; e += this.spacing) this.add(-7.4, l + e, c, 0);
				this.emitted--;
			}
		}
		let { nx: d, ny: p, inv: m, dx: h, mass: g, massGrid: _, u: v, v: y, active: b } = this, x = this._drapeRetentionFor(e, r);
		_.fill(0), v.fill(0), y.fill(0), b.length = 0;
		for (let e of this.particles) {
			let t = (e.x + 8) * m, n = (e.y + 4.4) * m, r = Math.floor(t - .5), i = Math.floor(n - .5), a = t - r, o = n - i, s = e.weights;
			e.bx = r, e.by = i, e.fx = a, e.fy = o, s[0] = .5 * (1.5 - a) ** 2, s[1] = .75 - (a - 1) ** 2, s[2] = .5 * (a - .5) ** 2, s[3] = .5 * (1.5 - o) ** 2, s[4] = .75 - (o - 1) ** 2, s[5] = .5 * (o - .5) ** 2;
			let c = e.vx, l = e.vy, u = e.c00, f = e.c01, p = e.c10, g = e.c11, x = e.mass;
			for (let e = 0; e < 3; e++) {
				let t = (i + e) * d + r, n = s[3 + e], m = (e - o) * h, S = f * m, C = g * m;
				for (let e = 0; e < 3; e++) {
					let r = t + e, i = s[e] * n, o = (e - a) * h;
					if (i < 1e-12) continue;
					_[r] === 0 && b.push(r);
					let d = i * x;
					_[r] += d, v[r] += d * (c + u * o + S), y[r] += d * (l + p * o + C);
				}
			}
		}
		let S = .15 + t * t * 2.8;
		for (let t of this.particles) {
			let n = t.weights, r = t.bx, i = t.by, a = t.fx, o = t.fy, s = 0;
			for (let e = 0; e < 3; e++) {
				let t = (i + e) * d + r, a = n[3 + e];
				for (let e = 0; e < 3; e++) s += n[e] * a * _[t + e] * m * m;
			}
			t.density = s;
			let c = s * s, l = f(22 * (c * c - 1), -.65, 100), u = t.mass / Math.max(.3, s), p = 30 / Math.max(.001, 32 - t.q00 - t.q11), g = -l + S * (p * t.q00 - 1), b = S * p * t.q01, x = -l + S * (p * t.q11 - 1), C = -e * u * 4 * m * m;
			for (let e = 0; e < 3; e++) {
				let t = (i + e) * d + r, s = n[3 + e], c = (e - o) * h, l = b * c, u = x * c;
				for (let e = 0; e < 3; e++) {
					let r = t + e, i = n[e] * s, o = (e - a) * h;
					i < 1e-12 || (v[r] += C * i * (g * o + l), y[r] += C * i * (b * o + u));
				}
			}
		}
		this.wall.fill(0), this.wallU.fill(0), this.wallV.fill(0);
		for (let t of b) {
			v[t] = f(v[t] / _[t], -9, 9), y[t] = f(y[t] / _[t] - e * this.gravity, -9, 9);
			let n = t % d, i = t / d | 0, s = n * h - 8, p = i * h - 4.4;
			if ((s < this.bounds.left + h || s > this.bounds.right - h || p < this.bounds.bottom + h) && (this.wall[t] = 1), a && Math.abs(p - l) < u + h && s < -6.84 && (this.wall[t] = 1, this.wallU[t] = c), this.obstacle && this.obstacle.distance[t] < h * .8) {
				let e = this.obstacle.distance[t], n = this.obstacle.gx[t], i = this.obstacle.gy[t];
				if (this.obstacle.drape) {
					let e = x[t];
					v[t] *= e, y[t] *= e;
				} else {
					this.wall[t] = Math.max(this.wall[t], e < 0 ? 1 : r * (1 - e / (h * .8)) ** 2);
					let a = v[t] * n + y[t] * i;
					a < 0 && e < h * .35 && (v[t] -= a * n, y[t] -= a * i);
				}
			}
			for (let e of o) {
				if (s < e.left - h || s > e.right + h || p < e.bottom - h || p > e.top + h) continue;
				let n = this.contact(s, p, e);
				if (n.distance < h * .8) {
					let i = n.distance < 0 ? 1 : r * (1 - n.distance / (h * .8)) ** 2;
					this.wall[t] = Math.max(this.wall[t], i), this.wallU[t] = e.vx, this.wallV[t] = e.vy;
					let a = (v[t] - e.vx) * n.nx + (y[t] - e.vy) * n.ny;
					a < 0 && n.distance < h * .35 && (v[t] -= a * n.nx, y[t] -= a * n.ny);
				}
			}
			this.u0[t] = v[t], this.v0[t] = y[t];
		}
		let C = (.018 + t * t * 3.5) * e * m * m, { viscL: w, viscR: T, viscB: E, viscT: D, viscU: O, viscV: k } = this;
		for (let e of b) {
			let t = Math.max(_[e], g * .02), n = g * .001, r = _[e - 1] >= n ? Math.min(1, _[e - 1] / t) : 0, i = _[e + 1] >= n ? Math.min(1, _[e + 1] / t) : 0, a = _[e - d] >= n ? Math.min(1, _[e - d] / t) : 0, o = _[e + d] >= n ? Math.min(1, _[e + d] / t) : 0, s = this.wall[e], c = (1 - s) / (1 + C * (r + i + a + o)), l = C * c;
			w[e] = r * l, T[e] = i * l, E[e] = a * l, D[e] = o * l, O[e] = this.u0[e] * c + this.wallU[e] * s, k[e] = this.v0[e] * c + this.wallV[e] * s, s === 1 && (v[e] = O[e], y[e] = k[e]);
		}
		let A = v, j = y;
		for (let e = 0; e < 6; e++) for (let t = 0; t < b.length; t++) {
			let n = b[e % 2 == 0 ? t : b.length - 1 - t], r = O[n] + w[n] * (v[n - 1] ?? 0) + T[n] * (v[n + 1] ?? 0) + E[n] * (v[n - d] ?? 0) + D[n] * (v[n + d] ?? 0), i = k[n] + w[n] * (y[n - 1] ?? 0) + T[n] * (y[n + 1] ?? 0) + E[n] * (y[n - d] ?? 0) + D[n] * (y[n + d] ?? 0);
			v[n] += 1.15 * (r - v[n]), y[n] += 1.15 * (i - y[n]);
		}
		let M = e / (.25 + t * 2.5);
		if (n > 0) {
			let t = Math.exp(-e * n);
			for (let e of b) A[e] *= t, j[e] *= t;
		}
		for (let t of this.particles) {
			let n = t.weights, i = t.bx, a = t.by, c = t.fx, l = t.fy, u = 0, p = 0, g = 0, _ = 0, v = 0, y = 0;
			for (let e = 0; e < 3; e++) {
				let t = (a + e) * d + i, r = n[3 + e], o = (e - l) * h;
				for (let e = 0; e < 3; e++) {
					let i = t + e, a = n[e] * r, s = (e - c) * h;
					if (a < 1e-12) continue;
					let l = A[i], d = j[i], f = a * l, m = a * d;
					u += f, p += m, g += f * s, _ += f * o, v += m * s, y += m * o;
				}
			}
			let b = 4 * m * m;
			t.c00 = f(g * b, -25, 25), t.c01 = f(_ * b, -25, 25), t.c10 = f(v * b, -25, 25), t.c11 = f(y * b, -25, 25);
			let x = 1 + e * t.c00, S = e * t.c01, C = e * t.c10, w = 1 + e * t.c11, T = x * x * t.q00 + 2 * x * S * t.q01 + S * S * t.q11, E = x * C * t.q00 + (x * w + S * C) * t.q01 + S * w * t.q11, D = C * C * t.q00 + 2 * C * w * t.q01 + w * w * t.q11, O = T + D + 2 * M, k = 32 + 30 * M + O, N = 64 * O / (k + Math.sqrt(Math.max(0, k * k - 128 * O))) / O;
			t.q00 = (T + M) * N, t.q11 = (D + M) * N, t.q01 = E * N;
			let P = x * x * t.d00 + 2 * x * S * t.d01 + S * S * t.d11, F = x * C * t.d00 + (x * w + S * C) * t.d01 + S * w * t.d11, I = C * C * t.d00 + 2 * C * w * t.d01 + w * w * t.d11;
			if (t.d00 = P, t.d01 = F, t.d11 = I, s) {
				let n = s.weights.get(t.id) || 0;
				if (n) {
					let r = s.offsets.get(t.id), i = 1 - Math.exp(-e * 110 * n);
					u += (f((s.x + r[0] - t.x) * 15, -6, 6) - u) * i, p += (f((s.y + r[1] - t.y) * 15, -6, 6) - p) * i;
				}
			}
			if (t.vx = u, t.vy = p, t.x += u * e, t.y += p * e, t.attachment = null, this.obstacle && !this.obstacle.drape) {
				let e = this.sampleObstacle(t.x, t.y), n = this.spacing * .5;
				if (e.distance < n) {
					t.x += e.nx * (n - e.distance), t.y += e.ny * (n - e.distance);
					let i = t.vx * e.nx + t.vy * e.ny;
					i < 0 && (t.vx -= i * e.nx, t.vy -= i * e.ny), t.vx *= 1 - r * .4, t.vy *= 1 - r * .4;
				}
				e.distance < h * .65 && r > .02 && (t.attachment = { body: "text" });
			}
			for (let e of o) {
				if (t.x < e.left - h || t.x > e.right + h || t.y < e.bottom - h || t.y > e.top + h) continue;
				let n = this.contact(t.x, t.y, e), i = this.spacing * .5;
				if (n.distance < i) {
					t.x += n.nx * (i - n.distance), t.y += n.ny * (i - n.distance);
					let a = (t.vx - e.vx) * n.nx + (t.vy - e.vy) * n.ny;
					a < 0 && (t.vx -= a * n.nx, t.vy -= a * n.ny), t.vx += (e.vx - t.vx) * r * .4, t.vy += (e.vy - t.vy) * r * .4;
				}
				n.distance < h * .65 && r > .02 && (t.attachment = { body: e.id });
			}
			(t.x < this.bounds.left || t.x > this.bounds.right) && (t.x = f(t.x, this.bounds.left, this.bounds.right), t.vx = 0, t.c00 = t.c01 = t.c10 = t.c11 = 0), t.y < this.bounds.bottom && (t.y = this.bounds.bottom, t.vy = 0, t.vx *= .85, t.c00 = t.c01 = t.c10 = t.c11 = 0), t.y > this.bounds.top && (t.y = this.bounds.top, t.vy = Math.min(0, t.vy));
		}
		++this.adaptStep % 4 == 0 && this._adaptParticles(o, s);
	}
	_adaptParticles(e, t) {
		let n = this.mass * 1.7 ** 2;
		this.particles.length > this.maxParticles * .9 && this._mergeSettled(t);
		let r = this.particles.length;
		for (let i = 0; i < r && this.particles.length < this.maxParticles; i++) {
			let r = this.particles[i];
			if (r.mass <= this.mass / 16 || r.attachment || t?.weights.has(r.id) || r.y < this.bounds.bottom + this.dx * 3 && Math.hypot(r.vx, r.vy) < .15) continue;
			let a = Math.hypot(r.d00 - r.d11, 2 * r.d01), o = (r.d00 + r.d11 + a) * .5;
			if (o < n) continue;
			let s = .5 * Math.atan2(2 * r.d01, r.d00 - r.d11), c = Math.cos(s), l = Math.sin(s), u = Math.sqrt(o) * .25, d = c * u, f = l * u, p = r.x, m = r.y, h = (t, n) => t > this.bounds.left && t < this.bounds.right && n > this.bounds.bottom && n < this.bounds.top && (!this.obstacle || this.obstacle.drape || this.sampleObstacle(t, n).distance > this.spacing * .5) && !e.some((e) => this.contact(t, n, e).distance < this.spacing * .5);
			if (!h(p - d, m - f) || !h(p + d, m + f)) continue;
			let g = r.vx, _ = r.vy, v = r.c00 * d + r.c01 * f, y = r.c10 * d + r.c11 * f;
			r.mass *= .5, r.d00 -= o * .75 * c * c, r.d01 -= o * .75 * c * l, r.d11 -= o * .75 * l * l;
			let b = {
				...r,
				id: this.nextId++,
				weights: /* @__PURE__ */ new Float64Array(6)
			};
			r.x = p - d, r.y = m - f, r.vx = g - v, r.vy = _ - y, b.x = p + d, b.y = m + f, b.vx = g + v, b.vy = _ + y, this.particles.push(b), this.splits++;
		}
	}
	_mergeSettled(e) {
		let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set(), r = this.spacing * 1.15;
		for (let i of this.particles) {
			if (i.y > this.bounds.bottom + this.dx * 3 || i.attachment || Math.hypot(i.vx, i.vy) > .15 || e?.weights.has(i.id) || i.mass >= this.mass * 2) continue;
			let a = Math.floor((i.x + 8) / r) + "," + Math.floor((i.y + 4.4) / r), o = t.get(a);
			if (!o || o.mass + i.mass > this.mass * 2) {
				t.set(a, i);
				continue;
			}
			let s = o.mass + i.mass, c = o.mass / s, l = i.mass / s, u = i.x - o.x, d = i.y - o.y;
			for (let e of [
				"x",
				"y",
				"materialX",
				"materialY",
				"vx",
				"vy",
				"c00",
				"c01",
				"c10",
				"c11",
				"q00",
				"q01",
				"q11",
				"density"
			]) o[e] = o[e] * c + i[e] * l;
			o.d00 = o.d00 * c + i.d00 * l + 12 * c * l * u * u, o.d01 = o.d01 * c + i.d01 * l + 12 * c * l * u * d, o.d11 = o.d11 * c + i.d11 * l + 12 * c * l * d * d, o.mass = s, n.add(i.id), this.merges++, t.delete(a);
		}
		n.size && (this.particles = this.particles.filter((e) => !n.has(e.id)));
	}
}, m = class {
	constructor(e = Math) {
		this.grad3 = [
			[
				1,
				1,
				0
			],
			[
				-1,
				1,
				0
			],
			[
				1,
				-1,
				0
			],
			[
				-1,
				-1,
				0
			],
			[
				1,
				0,
				1
			],
			[
				-1,
				0,
				1
			],
			[
				1,
				0,
				-1
			],
			[
				-1,
				0,
				-1
			],
			[
				0,
				1,
				1
			],
			[
				0,
				-1,
				1
			],
			[
				0,
				1,
				-1
			],
			[
				0,
				-1,
				-1
			]
		], this.grad4 = [
			[
				0,
				1,
				1,
				1
			],
			[
				0,
				1,
				1,
				-1
			],
			[
				0,
				1,
				-1,
				1
			],
			[
				0,
				1,
				-1,
				-1
			],
			[
				0,
				-1,
				1,
				1
			],
			[
				0,
				-1,
				1,
				-1
			],
			[
				0,
				-1,
				-1,
				1
			],
			[
				0,
				-1,
				-1,
				-1
			],
			[
				1,
				0,
				1,
				1
			],
			[
				1,
				0,
				1,
				-1
			],
			[
				1,
				0,
				-1,
				1
			],
			[
				1,
				0,
				-1,
				-1
			],
			[
				-1,
				0,
				1,
				1
			],
			[
				-1,
				0,
				1,
				-1
			],
			[
				-1,
				0,
				-1,
				1
			],
			[
				-1,
				0,
				-1,
				-1
			],
			[
				1,
				1,
				0,
				1
			],
			[
				1,
				1,
				0,
				-1
			],
			[
				1,
				-1,
				0,
				1
			],
			[
				1,
				-1,
				0,
				-1
			],
			[
				-1,
				1,
				0,
				1
			],
			[
				-1,
				1,
				0,
				-1
			],
			[
				-1,
				-1,
				0,
				1
			],
			[
				-1,
				-1,
				0,
				-1
			],
			[
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				-1,
				0
			],
			[
				1,
				-1,
				1,
				0
			],
			[
				1,
				-1,
				-1,
				0
			],
			[
				-1,
				1,
				1,
				0
			],
			[
				-1,
				1,
				-1,
				0
			],
			[
				-1,
				-1,
				1,
				0
			],
			[
				-1,
				-1,
				-1,
				0
			]
		], this.p = [];
		for (let t = 0; t < 256; t++) this.p[t] = Math.floor(e.random() * 256);
		this.perm = [];
		for (let e = 0; e < 512; e++) this.perm[e] = this.p[e & 255];
		this.simplex = [
			[
				0,
				1,
				2,
				3
			],
			[
				0,
				1,
				3,
				2
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				2,
				3,
				1
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				1,
				2,
				3,
				0
			],
			[
				0,
				2,
				1,
				3
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				3,
				1,
				2
			],
			[
				0,
				3,
				2,
				1
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				1,
				3,
				2,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				1,
				2,
				0,
				3
			],
			[
				0,
				0,
				0,
				0
			],
			[
				1,
				3,
				0,
				2
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				2,
				3,
				0,
				1
			],
			[
				2,
				3,
				1,
				0
			],
			[
				1,
				0,
				2,
				3
			],
			[
				1,
				0,
				3,
				2
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				2,
				0,
				3,
				1
			],
			[
				0,
				0,
				0,
				0
			],
			[
				2,
				1,
				3,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				2,
				0,
				1,
				3
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				3,
				0,
				1,
				2
			],
			[
				3,
				0,
				2,
				1
			],
			[
				0,
				0,
				0,
				0
			],
			[
				3,
				1,
				2,
				0
			],
			[
				2,
				1,
				0,
				3
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0
			],
			[
				3,
				1,
				0,
				2
			],
			[
				0,
				0,
				0,
				0
			],
			[
				3,
				2,
				0,
				1
			],
			[
				3,
				2,
				1,
				0
			]
		];
	}
	noise(e, t) {
		let n, r, i, a = .5 * (Math.sqrt(3) - 1), o = (e + t) * a, s = Math.floor(e + o), c = Math.floor(t + o), l = (3 - Math.sqrt(3)) / 6, u = (s + c) * l, d = s - u, f = c - u, p = e - d, m = t - f, h, g;
		p > m ? (h = 1, g = 0) : (h = 0, g = 1);
		let _ = p - h + l, v = m - g + l, y = p - 1 + 2 * l, b = m - 1 + 2 * l, x = s & 255, S = c & 255, C = this.perm[x + this.perm[S]] % 12, w = this.perm[x + h + this.perm[S + g]] % 12, T = this.perm[x + 1 + this.perm[S + 1]] % 12, E = .5 - p * p - m * m;
		E < 0 ? n = 0 : (E *= E, n = E * E * this._dot(this.grad3[C], p, m));
		let D = .5 - _ * _ - v * v;
		D < 0 ? r = 0 : (D *= D, r = D * D * this._dot(this.grad3[w], _, v));
		let O = .5 - y * y - b * b;
		return O < 0 ? i = 0 : (O *= O, i = O * O * this._dot(this.grad3[T], y, b)), 70 * (n + r + i);
	}
	noise3d(e, t, n) {
		let r, i, a, o, s = (e + t + n) * (1 / 3), c = Math.floor(e + s), l = Math.floor(t + s), u = Math.floor(n + s), d = 1 / 6, f = (c + l + u) * d, p = c - f, m = l - f, h = u - f, g = e - p, _ = t - m, v = n - h, y, b, x, S, C, w;
		g >= _ ? _ >= v ? (y = 1, b = 0, x = 0, S = 1, C = 1, w = 0) : g >= v ? (y = 1, b = 0, x = 0, S = 1, C = 0, w = 1) : (y = 0, b = 0, x = 1, S = 1, C = 0, w = 1) : _ < v ? (y = 0, b = 0, x = 1, S = 0, C = 1, w = 1) : g < v ? (y = 0, b = 1, x = 0, S = 0, C = 1, w = 1) : (y = 0, b = 1, x = 0, S = 1, C = 1, w = 0);
		let T = g - y + d, E = _ - b + d, D = v - x + d, O = g - S + 2 * d, k = _ - C + 2 * d, A = v - w + 2 * d, j = g - 1 + 3 * d, M = _ - 1 + 3 * d, N = v - 1 + 3 * d, P = c & 255, F = l & 255, I = u & 255, ee = this.perm[P + this.perm[F + this.perm[I]]] % 12, te = this.perm[P + y + this.perm[F + b + this.perm[I + x]]] % 12, ne = this.perm[P + S + this.perm[F + C + this.perm[I + w]]] % 12, re = this.perm[P + 1 + this.perm[F + 1 + this.perm[I + 1]]] % 12, L = .6 - g * g - _ * _ - v * v;
		L < 0 ? r = 0 : (L *= L, r = L * L * this._dot3(this.grad3[ee], g, _, v));
		let R = .6 - T * T - E * E - D * D;
		R < 0 ? i = 0 : (R *= R, i = R * R * this._dot3(this.grad3[te], T, E, D));
		let z = .6 - O * O - k * k - A * A;
		z < 0 ? a = 0 : (z *= z, a = z * z * this._dot3(this.grad3[ne], O, k, A));
		let B = .6 - j * j - M * M - N * N;
		return B < 0 ? o = 0 : (B *= B, o = B * B * this._dot3(this.grad3[re], j, M, N)), 32 * (r + i + a + o);
	}
	noise4d(e, t, n, r) {
		let i = this.grad4, a = this.simplex, o = this.perm, s = (Math.sqrt(5) - 1) / 4, c = (5 - Math.sqrt(5)) / 20, l, u, d, f, p, m = (e + t + n + r) * s, h = Math.floor(e + m), g = Math.floor(t + m), _ = Math.floor(n + m), v = Math.floor(r + m), y = (h + g + _ + v) * c, b = h - y, x = g - y, S = _ - y, C = v - y, w = e - b, T = t - x, E = n - S, D = r - C, O = w > T ? 32 : 0, k = w > E ? 16 : 0, A = T > E ? 8 : 0, j = w > D ? 4 : 0, M = T > D ? 2 : 0, N = +(E > D), P = O + k + A + j + M + N, F = +(a[P][0] >= 3), I = +(a[P][1] >= 3), ee = +(a[P][2] >= 3), te = +(a[P][3] >= 3), ne = +(a[P][0] >= 2), re = +(a[P][1] >= 2), L = +(a[P][2] >= 2), R = +(a[P][3] >= 2), z = +(a[P][0] >= 1), B = +(a[P][1] >= 1), ie = +(a[P][2] >= 1), ae = +(a[P][3] >= 1), oe = w - F + c, se = T - I + c, ce = E - ee + c, le = D - te + c, V = w - ne + 2 * c, H = T - re + 2 * c, U = E - L + 2 * c, W = D - R + 2 * c, ue = w - z + 3 * c, de = T - B + 3 * c, fe = E - ie + 3 * c, pe = D - ae + 3 * c, me = w - 1 + 4 * c, he = T - 1 + 4 * c, ge = E - 1 + 4 * c, _e = D - 1 + 4 * c, G = h & 255, K = g & 255, q = _ & 255, J = v & 255, ve = o[G + o[K + o[q + o[J]]]] % 32, ye = o[G + F + o[K + I + o[q + ee + o[J + te]]]] % 32, be = o[G + ne + o[K + re + o[q + L + o[J + R]]]] % 32, xe = o[G + z + o[K + B + o[q + ie + o[J + ae]]]] % 32, Se = o[G + 1 + o[K + 1 + o[q + 1 + o[J + 1]]]] % 32, Y = .6 - w * w - T * T - E * E - D * D;
		Y < 0 ? l = 0 : (Y *= Y, l = Y * Y * this._dot4(i[ve], w, T, E, D));
		let X = .6 - oe * oe - se * se - ce * ce - le * le;
		X < 0 ? u = 0 : (X *= X, u = X * X * this._dot4(i[ye], oe, se, ce, le));
		let Z = .6 - V * V - H * H - U * U - W * W;
		Z < 0 ? d = 0 : (Z *= Z, d = Z * Z * this._dot4(i[be], V, H, U, W));
		let Q = .6 - ue * ue - de * de - fe * fe - pe * pe;
		Q < 0 ? f = 0 : (Q *= Q, f = Q * Q * this._dot4(i[xe], ue, de, fe, pe));
		let $ = .6 - me * me - he * he - ge * ge - _e * _e;
		return $ < 0 ? p = 0 : ($ *= $, p = $ * $ * this._dot4(i[Se], me, he, ge, _e)), 27 * (l + u + d + f + p);
	}
	_dot(e, t, n) {
		return e[0] * t + e[1] * n;
	}
	_dot3(e, t, n, r) {
		return e[0] * t + e[1] * n + e[2] * r;
	}
	_dot4(e, t, n, r, i) {
		return e[0] * t + e[1] * n + e[2] * r + e[3] * i;
	}
}, h = class extends e.Mesh {
	constructor(t, n = 256, { closed: r = !0 } = {}) {
		let i = new e.BufferGeometry(), a = n * Math.ceil(n * 8.8 / 16), o = a * 8;
		i.setAttribute("position", new e.BufferAttribute(new Float32Array(o * 3), 3).setUsage(e.DynamicDrawUsage)), i.setAttribute("normal", new e.BufferAttribute(new Float32Array(o * 3), 3).setUsage(e.DynamicDrawUsage)), i.setAttribute("gooThickness", new e.BufferAttribute(new Float32Array(o), 1).setUsage(e.DynamicDrawUsage)), i.setAttribute("gooMaterialUV", new e.BufferAttribute(new Float32Array(o * 2), 2).setUsage(e.DynamicDrawUsage)), i.setIndex(new e.BufferAttribute(new Uint32Array(a * 24), 1).setUsage(e.DynamicDrawUsage)), super(i, t), this.frustumCulled = !1, this.position.z = .1, this.closed = r, this.nx = n, this.ny = Math.ceil(n * 8.8 / 16), this.sx = 16 / (this.nx - 1), this.sy = 8.8 / (this.ny - 1);
		let s = this.nx * this.ny;
		for (let e of [
			"density",
			"extension",
			"distance",
			"height",
			"relief",
			"gx",
			"gy",
			"materialU",
			"materialV",
			"materialMass"
		]) this[e] = new Float32Array(s);
		this.polygon = Array.from({ length: 5 }, () => /* @__PURE__ */ new Float64Array(9)), this.vertexCache = new Int32Array(s * 8), this.filterTemp = new Float32Array(s);
		let c = 1729;
		this.noise = new m({ random: () => (c = Math.imul(c, 1664525) + 1013904223 >>> 0) / 4294967296 }), this.isolation = .24, this.depthScale = 1;
	}
	rebuild(e, t = [], n = .05, r = null) {
		let { nx: i, ny: a, sx: o, sy: s, density: c, extension: l, relief: u, materialU: d, materialV: f, materialMass: p } = this;
		c.fill(0), l.fill(0), d.fill(0), f.fill(0);
		let m = !r?.drape || this._reliefObstacle !== r;
		m && u.fill(0);
		let h = n * 2.5, g = 3 / (Math.PI * h * h);
		for (let t of e) {
			let e = (t.mass ?? n ** 2) * g, r = t.materialX ?? t.x, u = t.materialY ?? t.y, p = (t.x + 8) / o, m = (t.y + 4.4) / s, _ = h / o, v = h / s, y = 1 / Math.sqrt(Math.max(1, ((t.q00 ?? 1) + (t.q11 ?? 1)) * .5)), b = 1 / _, x = 1 / v;
			for (let t = Math.max(0, Math.ceil(m - v)); t <= Math.min(a - 1, Math.floor(m + v)); t++) {
				let n = (t - m) * x, a = n * n, o = t * i;
				for (let t = Math.max(0, Math.ceil(p - _)); t <= Math.min(i - 1, Math.floor(p + _)); t++) {
					let n = (t - p) * b, i = n * n + a;
					if (i < 1) {
						let n = o + t, a = e * (1 - i) ** 2;
						c[n] += a, l[n] += a * y, d[n] += a * r, f[n] += a * u;
					}
				}
			}
		}
		for (let e of [
			c,
			l,
			d,
			f
		]) this._smooth(e);
		p.set(c);
		for (let e = 0; e < c.length; e++) c[e] > 1e-8 && (d[e] /= c[e], f[e] /= c[e]);
		let _ = Math.max(o, s), v = this.isolation;
		for (let e of t) {
			let t = (e.left + e.right) / 2, n = (e.top + e.bottom) / 2, r = (e.right - e.left) / 2, l = (e.top - e.bottom) / 2, u = Math.min(e.radius || 0, r, l);
			for (let d = Math.max(0, Math.floor((e.bottom - _ + 4.4) / s)); d <= Math.min(a - 1, Math.ceil((e.top + _ + 4.4) / s)); d++) for (let a = Math.max(0, Math.floor((e.left - _ + 8) / o)); a <= Math.min(i - 1, Math.ceil((e.right + _ + 8) / o)); a++) {
				let e = Math.abs(a * o - 8 - t) - r + u, f = Math.abs(d * s - 4.4 - n) - l + u, p = Math.hypot(Math.max(e, 0), Math.max(f, 0)) + Math.min(Math.max(e, f), 0) - u;
				c[d * i + a] = Math.min(c[d * i + a], Math.max(0, v + p / _));
			}
		}
		if (r?.distance && m) {
			let { distance: e, nx: t, ny: n, inv: l } = r;
			for (let d = 0; d < a; d++) for (let a = 0; a < i; a++) {
				let f = d * i + a;
				if (!r.drape && c[f] <= 0) continue;
				let p = Math.max(0, Math.min(t - 1.000001, a * o * l)), m = Math.max(0, Math.min(n - 1.000001, d * s * l)), h = Math.floor(p), g = Math.floor(m), y = p - h, b = m - g, x = g * t + h, S = (e[x] * (1 - y) + e[x + 1] * y) * (1 - b) + (e[x + t] * (1 - y) + e[x + t + 1] * y) * b;
				r.drape ? u[f] = .24 / (1 + Math.exp(Math.max(-25, Math.min(25, S / .095)))) : c[f] = Math.min(c[f], Math.max(0, v + S / _));
			}
		}
		this._reliefObstacle = r, this._profile(), this.cursor = 0, this.indexCursor = 0, this.vertexCache.fill(-1);
		for (let e = 0; e < a - 1; e++) for (let t = 0; t < i - 1; t++) {
			let n = e * i + t, r = n + 1, a = n + i + 1, o = n + i;
			if (!(Math.max(c[n], c[r], c[a], c[o]) < v)) {
				if (Math.min(c[n], c[r], c[a], c[o]) >= v) {
					this._quad(n, r, a, o);
					continue;
				}
				this._triangle(n, r, a), this._triangle(n, a, o);
			}
		}
		this.geometry.setDrawRange(0, this.indexCursor), this.geometry.index.clearUpdateRanges(), this.geometry.index.addUpdateRange(0, this.indexCursor), this.geometry.index.needsUpdate = !0;
		for (let e of [
			"position",
			"normal",
			"gooThickness",
			"gooMaterialUV"
		]) {
			let t = this.geometry.attributes[e];
			t.clearUpdateRanges(), t.addUpdateRange(0, this.cursor * t.itemSize), t.needsUpdate = !0;
		}
	}
	_profile() {
		let { nx: e, ny: t, sx: n, sy: r, density: i, extension: a, distance: o, height: s, relief: c, gx: l, gy: u, materialU: d, materialV: f } = this, p = this.isolation;
		o.fill(100), s.fill(0);
		for (let a = 0; a < t; a++) for (let s = 0; s < e; s++) {
			let c = a * e + s, l = i[c];
			if (l < p) {
				o[c] = 0;
				continue;
			}
			if (s === 0 || a === 0 || s === e - 1 || a === t - 1) {
				o[c] = 0;
				continue;
			}
			for (let t = 0; t < 4; t++) {
				let a = c + (t === 0 ? -1 : t === 1 ? 1 : t === 2 ? -e : e);
				i[a] < p && (o[c] = Math.min(o[c], (t < 2 ? n : r) * (l - p) / (l - i[a])));
			}
		}
		let m = Math.hypot(n, r);
		for (let a = 1; a < t - 1; a++) for (let t = 1; t < e - 1; t++) {
			let s = a * e + t;
			i[s] < p || (o[s] = Math.min(o[s], o[s - 1] + n, o[s - e] + r, o[s - e - 1] + m, o[s - e + 1] + m));
		}
		for (let a = t - 2; a > 0; a--) for (let t = e - 2; t > 0; t--) {
			let s = a * e + t;
			i[s] < p || (o[s] = Math.min(o[s], o[s + 1] + n, o[s + e] + r, o[s + e + 1] + m, o[s + e - 1] + m));
		}
		for (let e = 0; e < i.length; e++) {
			if (i[e] < p) continue;
			let t = o[e], n = Math.min(1.8, i[e]), r = Math.max(.22, Math.min(1, a[e] / Math.max(.01, i[e]))), l = (.02 + .027 * Math.sqrt(n)) * r, u = .11 * Math.exp(-(((t - .115) / .14) ** 2)) * Math.sqrt(r), m = d[e], h = f[e], g = this._noise(m * 1.25 + h * .2, h * 1.7), _ = this._noise(m * 2.3, h * 3.1), v = (.035 * g + .008 * _) * r ** .8;
			s[e] = this.depthScale * Math.max(.012, l + u + c[e] + v) * Math.sqrt(1 - Math.exp(-t / .055));
		}
		this._smooth(s, !0);
		for (let i = 0; i < t; i++) for (let a = 0; a < e; a++) {
			let o = i * e + a, c = i * e + Math.max(0, a - 1), d = i * e + Math.min(e - 1, a + 1), f = Math.max(0, i - 1) * e + a, p = Math.min(t - 1, i + 1) * e + a;
			l[o] = (s[d] - s[c]) / (n * (a === 0 || a === e - 1 ? 1 : 2)), u[o] = (s[p] - s[f]) / (r * (i === 0 || i === t - 1 ? 1 : 2));
		}
	}
	_noise(e, t) {
		return this.noise.noise(e, t);
	}
	_smooth(e, t = !1) {
		let { nx: n, ny: r, filterTemp: i, density: a, isolation: o } = this;
		if (!t) {
			for (let t = 0; t < r; t++) {
				let r = t * n, a = r + n - 1;
				i[r] = (e[r] * 3 + e[r + 1]) * .25;
				for (let t = r + 1; t < a; t++) i[t] = (e[t] * 2 + e[t - 1] + e[t + 1]) * .25;
				i[a] = (e[a] * 3 + e[a - 1]) * .25;
			}
			for (let t = 0; t < r; t++) {
				let a = t * n, o = t ? -n : 0, s = t < r - 1 ? n : 0;
				for (let t = a; t < a + n; t++) e[t] = (i[t] * 2 + i[t + o] + i[t + s]) * .25;
			}
			return;
		}
		for (let s = 0; s < r; s++) for (let r = 0; r < n; r++) {
			let c = s * n + r, l = r ? c - 1 : c, u = r < n - 1 ? c + 1 : c, d = e[c];
			i[c] = t && a[c] < o ? 0 : (d * 2 + (t && a[l] < o ? d : e[l]) + (t && a[u] < o ? d : e[u])) * .25;
		}
		for (let s = 0; s < r; s++) for (let c = 0; c < n; c++) {
			let l = s * n + c, u = s ? l - n : l, d = s < r - 1 ? l + n : l, f = i[l];
			e[l] = t && a[l] < o ? 0 : (f * 2 + (t && a[u] < o ? f : i[u]) + (t && a[d] < o ? f : i[d])) * .25;
		}
	}
	_corner(e, t) {
		this.geometry.index.array[this.indexCursor++] = this._gridVertex(e, t);
	}
	_gridVertex(e, t) {
		let n = this.vertexCache[e * 2 + +(t < 0)];
		if (n >= 0) return n;
		let r = this.cursor++, i = r * 3, a = r * 2, o = this.geometry.attributes, s = o.position.array, c = o.normal.array, l = o.gooMaterialUV.array, u = Math.sqrt(this.gx[e] * this.gx[e] + this.gy[e] * this.gy[e] + 1);
		return this.vertexCache[e * 2 + +(t < 0)] = r, s[i] = e % this.nx * this.sx - 8, s[i + 1] = (e / this.nx | 0) * this.sy - 4.4, s[i + 2] = this.height[e] * t, c[i] = -this.gx[e] / u, c[i + 1] = -this.gy[e] / u, c[i + 2] = t / u, l[a] = this.materialU[e], l[a + 1] = this.materialV[e], o.gooThickness.array[r] = this.height[e] * 2, r;
	}
	_quad(e, t, n, r) {
		let i = this.geometry.index.array, a = this._gridVertex(e, 1), o = this._gridVertex(t, 1), s = this._gridVertex(n, 1), c = this._gridVertex(r, 1), l = this.indexCursor;
		if (i[l++] = a, i[l++] = o, i[l++] = s, i[l++] = a, i[l++] = s, i[l++] = c, this.closed) {
			let a = this._gridVertex(e, -1), o = this._gridVertex(t, -1), s = this._gridVertex(n, -1), c = this._gridVertex(r, -1);
			i[l++] = a, i[l++] = s, i[l++] = o, i[l++] = a, i[l++] = c, i[l++] = s;
		}
		this.indexCursor = l;
	}
	_triangle(e, t, n) {
		let { density: r, height: i, gx: a, gy: o, nx: s, ny: c, sx: l, sy: u, polygon: d, materialU: f, materialV: p, materialMass: m } = this, h = this.isolation;
		if (r[e] >= h && r[t] >= h && r[n] >= h) {
			this._corner(e, 1), this._corner(t, 1), this._corner(n, 1), this.closed && (this._corner(e, -1), this._corner(n, -1), this._corner(t, -1));
			return;
		}
		let g = 0;
		for (let _ = 0; _ < 3; _++) {
			let v = _ === 0 ? e : _ === 1 ? t : n, y = _ === 0 ? t : _ === 1 ? n : e, b = r[v], x = r[y];
			if (b >= h) {
				let e = d[g++], t = Math.hypot(a[v], o[v], 1);
				e[0] = v % s * l - 8, e[1] = (v / s | 0) * u - 4.4, e[2] = i[v], e[3] = -a[v] / t, e[4] = -o[v] / t, e[5] = 1 / t, e[6] = f[v], e[7] = p[v], e[8] = v;
			}
			if (b >= h != x >= h) {
				let e = (h - b) / (x - b), t = d[g++];
				t[0] = (v % s + (y % s - v % s) * e) * l - 8, t[1] = ((v / s | 0) + ((y / s | 0) - (v / s | 0)) * e) * u - 4.4, t[2] = 0;
				let n = v % s, i = v / s | 0, a = y % s, o = y / s | 0, _ = (r[i * s + Math.min(s - 1, n + 1)] - r[i * s + Math.max(0, n - 1)]) / (2 * l), S = (r[Math.min(c - 1, i + 1) * s + n] - r[Math.max(0, i - 1) * s + n]) / (2 * u), C = (r[o * s + Math.min(s - 1, a + 1)] - r[o * s + Math.max(0, a - 1)]) / (2 * l), w = (r[Math.min(c - 1, o + 1) * s + a] - r[Math.max(0, o - 1) * s + a]) / (2 * u), T = _ + (C - _) * e, E = S + (w - S) * e, D = Math.hypot(T, E) || 1;
				t[3] = -T / D, t[4] = -E / D, t[5] = 0;
				let O = m[v] > 1e-8 ? v : y, k = m[y] > 1e-8 ? y : v;
				t[6] = f[O] + (f[k] - f[O]) * e, t[7] = p[O] + (p[k] - p[O]) * e;
				let A = Math.abs(y - v), j = s * c;
				t[8] = Math.min(v, y) + j * (A === 1 ? 1 : A === s ? 2 : 3);
			}
		}
		for (let e = 1; e < g - 1; e++) this._vertex(d[0], 1), this._vertex(d[e], 1), this._vertex(d[e + 1], 1), this.closed && (this._vertex(d[0], -1), this._vertex(d[e + 1], -1), this._vertex(d[e], -1));
	}
	_vertex(e, t) {
		let n = e[8] * 2 + +(t < 0), r = this.vertexCache[n];
		if (r >= 0) {
			this.geometry.index.array[this.indexCursor++] = r;
			return;
		}
		r = this.cursor++, this.vertexCache[n] = r, this.geometry.index.array[this.indexCursor++] = r;
		let i = this.geometry.attributes.position.array, a = this.geometry.attributes.normal.array, o = r * 3;
		i[o] = e[0], i[o + 1] = e[1], i[o + 2] = e[2] * t, a[o] = e[3], a[o + 1] = e[4], a[o + 2] = e[5] * t, this.geometry.attributes.gooThickness.array[this.cursor - 1] = e[2] * 2;
		let s = this.geometry.attributes.gooMaterialUV.array, c = (this.cursor - 1) * 2;
		s[c] = e[6], s[c + 1] = e[7];
	}
}, g = "const clamp = (v, a, b) => Math.max(a, Math.min(b, v));\n\n/** MLS-MPM liquid: APIC transfers, Tait pressure, implicit viscosity, and\n * a relaxing conformation tensor. No particle bonds or prescribed topology.\n * World coordinates are in the page plane; density drives the 3D surface.\n */\nexport class ViscousFluid {\n  constructor({ cellSize = 0.1, maxParticles = 24000, gravity = 3.4, initial = 'sheet' } = {}) {\n    this.dx = cellSize;\n    this.inv = 1 / cellSize;\n    this.nx = Math.ceil(16 / cellSize) + 1;\n    this.ny = Math.ceil(8.8 / cellSize) + 1;\n    this.spacing = cellSize * 0.5;\n    this.mass = this.spacing * this.spacing;\n    this.maxParticles = maxParticles;\n    this.gravity = gravity;\n    this.obstacle = null;\n    this.bounds = { left: -7.65, right: 7.65, bottom: -3.72, top: 4.2 };\n    const n = this.nx * this.ny;\n    for (const key of [\n      'massGrid',\n      'u',\n      'v',\n      'u0',\n      'v0',\n      'viscL',\n      'viscR',\n      'viscB',\n      'viscT',\n      'viscU',\n      'viscV',\n      'wall',\n      'wallU',\n      'wallV',\n    ])\n      this[key] = new Float32Array(n);\n    this.active = [];\n    this.previousSolids = new Map();\n    this.seed({ mode: initial });\n  }\n  add(x, y, vx = 0, vy = 0) {\n    if (this.particles.length >= this.maxParticles) {\n      const index = this.particles.findIndex(\n        (p) => p.y < this.bounds.bottom + this.dx * 2 && !p.attachment && p.mass <= this.mass,\n      );\n      if (index < 0) return false;\n      // Recycling moves an existing parcel through the inlet. Adaptive\n      // samples have different masses; replacing one with the reference mass\n      // would repeatedly create or destroy fluid in the settled pool. Keep\n      // oversized merged deposits out of the fixed-width inlet.\n      const recycled = this._particle(x, y, vx, vy),\n        mass = this.particles[index].mass;\n      recycled.mass = mass;\n      recycled.d00 = mass;\n      recycled.d11 = mass;\n      this.particles[index] = recycled;\n    } else this.particles.push(this._particle(x, y, vx, vy));\n    return true;\n  }\n  _particle(x, y, vx, vy) {\n    return {\n      id: this.nextId++,\n      x,\n      y,\n      materialX: x,\n      materialY: y,\n      vx,\n      vy,\n      mass: this.mass,\n      c00: 0,\n      c01: 0,\n      c10: 0,\n      c11: 0,\n      q00: 1,\n      q01: 0,\n      q11: 1,\n      d00: this.mass,\n      d01: 0,\n      d11: this.mass,\n      density: 1,\n      attachment: null,\n      weights: new Float64Array(6),\n    };\n  }\n  seed({ mode = 'sheet', mask = null } = {}) {\n    this.particles = [];\n    this.nextId = 0;\n    this.time = 0;\n    this.accumulator = 0;\n    this.emitted = 0;\n    this.inletStarted = false;\n    this.adaptStep = 0;\n    this.splits = 0;\n    this.merges = 0;\n    this.previousSolids.clear();\n    const s = this.spacing;\n    if (mode === 'empty') return;\n    if (mask) {\n      this._seedGlyphs(mask, mode);\n      return;\n    }\n    for (let row = 0; row < Math.ceil(6.0 / s); row++)\n      for (let col = 0; col < Math.ceil(11.0 / s); col++) {\n        const x = -7.5 + col * s,\n          y = -3.1 + row * s;\n        const right = 1.4 + 1.35 * Math.sin((y + 2.5) * 1.13) - 0.43 * y;\n        const top = 2.7 - 0.1 * (x + 5) + 0.14 * Math.sin(x * 1.9);\n        if (x > right || y > top || y < -2.65 + 0.17 * Math.sin(x * 1.4)) continue;\n        const holes = [\n          [-5.45, 1.85, 0.64, 0.77],\n          [-3.95, 0.35, 1.06, 0.53],\n          [-0.95, 0.05, 1.18, 0.74],\n          [-3.55, -1.91, 1.08, 0.57],\n          [1.35, -1.25, 0.6, 0.66],\n          [-2.7, 2.04, 0.35, 0.32],\n        ];\n        if (\n          holes.some(([cx, cy, rx, ry]) => {\n            const angle = Math.atan2((y - cy) / ry, (x - cx) / rx);\n            return (\n              ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <\n              1 + 0.1 * Math.sin(angle * 5 + cx) + 0.035 * Math.cos(angle * 9 + cy)\n            );\n          })\n        )\n          continue;\n        if (this.obstacle && !this.obstacle.drape && this.sampleObstacle(x, y).distance < s * 0.6)\n          continue;\n        this.add(\n          x + s * 0.03 * Math.sin(col * 3.7 + row),\n          y + s * 0.03 * Math.cos(row * 3.1 + col),\n        );\n      }\n  }\n  _seedGlyphs(mask, mode) {\n    const { nx, ny, dx, bounds } = this;\n    if (mode === 'text') {\n      // Four material samples per occupied grid cell fill the actual glyph.\n      for (let y = 1; y < ny - 1; y++)\n        for (let x = 1; x < nx - 1; x++) {\n          if (!mask[y * nx + x]) continue;\n          for (const oy of [-0.25, 0.25])\n            for (const ox of [-0.25, 0.25]) {\n              const px = (x + ox) * dx - 8,\n                py = (y + oy) * dx - 4.4;\n              if (px > bounds.left && px < bounds.right && py > bounds.bottom && py < bounds.top)\n                this.add(px, py);\n            }\n        }\n      return;\n    }\n    // Exposed upward edges receive a finite coating. Interior vertical runs\n    // stay connected, while counters and spaces in the lettering stay open.\n    const coating = new Uint8Array(nx * ny);\n    for (let y = 1; y < ny - 1; y++)\n      for (let x = 1; x < nx - 1; x++) {\n        if (!mask[y * nx + x] || mask[(y + 1) * nx + x]) continue;\n        const layers = 3 + Math.round((Math.sin(x * 0.43) + 1) * 0.8);\n        for (let offset = -1; offset < layers; offset++) {\n          const row = y + offset;\n          if (row > 0 && row < ny - 1) coating[row * nx + x] = 1;\n        }\n      }\n    for (let y = 1; y < ny - 1; y++)\n      for (let x = 1; x < nx - 1; x++) {\n        if (!coating[y * nx + x]) continue;\n        for (const oy of [-0.25, 0.25])\n          for (const ox of [-0.25, 0.25]) {\n            const px = (x + ox) * dx - 8,\n              py = (y + oy) * dx - 4.4;\n            if (px > bounds.left && px < bounds.right && py > bounds.bottom && py < bounds.top)\n              this.add(px, py);\n          }\n      }\n  }\n  pour(x = -0.6, y = 3.8, radius = 0.32) {\n    for (let py = -radius; py <= radius; py += this.spacing)\n      for (let px = -radius; px <= radius; px += this.spacing)\n        if (px * px + py * py < radius * radius) this.add(x + px, y + py, 0, -0.06);\n  }\n  grab(x, y) {\n    const weights = new Map(),\n      offsets = new Map();\n    for (const p of this.particles) {\n      const d = Math.hypot(p.x - x, p.y - y);\n      if (d < 0.42) {\n        weights.set(p.id, Math.exp((-d * d) / 0.045));\n        offsets.set(p.id, [p.x - x, p.y - y]);\n      }\n    }\n    return { x, y, weights, offsets };\n  }\n  setObstacleMask(mask, { drape = false } = {}) {\n    if (\n      this.obstacleMask?.length === mask.length &&\n      this.obstacle?.drape === drape &&\n      mask.every((v, i) => v === this.obstacleMask[i])\n    )\n      return;\n    const first = !this.obstacleMask;\n    this.obstacleMask = mask;\n    const { nx, ny, dx, inv } = this,\n      n = nx * ny,\n      inside = new Float32Array(n),\n      outside = new Float32Array(n);\n    for (let i = 0; i < n; i++) {\n      inside[i] = mask[i] ? 0 : 1e5;\n      outside[i] = mask[i] ? 1e5 : 0;\n    }\n    const transform = (field) => {\n      for (let y = 0; y < ny; y++)\n        for (let x = 0; x < nx; x++) {\n          const k = y * nx + x;\n          let v = field[k];\n          if (x > 0) v = Math.min(v, field[k - 1] + 1);\n          if (y > 0) v = Math.min(v, field[k - nx] + 1);\n          if (x > 0 && y > 0) v = Math.min(v, field[k - nx - 1] + Math.SQRT2);\n          if (x < nx - 1 && y > 0) v = Math.min(v, field[k - nx + 1] + Math.SQRT2);\n          field[k] = v;\n        }\n      for (let y = ny - 1; y >= 0; y--)\n        for (let x = nx - 1; x >= 0; x--) {\n          const k = y * nx + x;\n          let v = field[k];\n          if (x < nx - 1) v = Math.min(v, field[k + 1] + 1);\n          if (y < ny - 1) v = Math.min(v, field[k + nx] + 1);\n          if (x < nx - 1 && y < ny - 1) v = Math.min(v, field[k + nx + 1] + Math.SQRT2);\n          if (x > 0 && y < ny - 1) v = Math.min(v, field[k + nx - 1] + Math.SQRT2);\n          field[k] = v;\n        }\n    };\n    transform(inside);\n    transform(outside);\n    const distance = new Float32Array(n),\n      gx = new Float32Array(n),\n      gy = new Float32Array(n);\n    for (let k = 0; k < n; k++) {\n      const d = inside[k] - outside[k];\n      distance[k] = (d - Math.sign(d) * 0.5) * dx;\n    }\n    for (let y = 1; y < ny - 1; y++)\n      for (let x = 1; x < nx - 1; x++) {\n        const k = y * nx + x,\n          a = distance[k + 1] - distance[k - 1],\n          b = distance[k + nx] - distance[k - nx],\n          length = Math.hypot(a, b) || 1;\n        gx[k] = a / length;\n        gy[k] = b / length;\n      }\n    this.obstacle = { distance, gx, gy, nx, ny, inv, drape };\n    if (first && !drape)\n      this.particles = this.particles.filter(\n        (p) => this.sampleObstacle(p.x, p.y).distance > this.spacing * 0.5,\n      );\n  }\n  sampleObstacle(x, y) {\n    const f = this.obstacle,\n      px = clamp((x + 8) * f.inv, 0, f.nx - 1.001),\n      py = clamp((y + 4.4) * f.inv, 0, f.ny - 1.001),\n      ix = Math.floor(px),\n      iy = Math.floor(py),\n      fx = px - ix,\n      fy = py - iy,\n      k = iy * f.nx + ix;\n    const sample = (a) =>\n      (a[k] * (1 - fx) + a[k + 1] * fx) * (1 - fy) +\n      (a[k + f.nx] * (1 - fx) + a[k + f.nx + 1] * fx) * fy;\n    let nx = sample(f.gx),\n      ny = sample(f.gy);\n    const length = Math.hypot(nx, ny) || 1;\n    return { distance: sample(f.distance), nx: nx / length, ny: ny / length };\n  }\n  _drapeRetentionFor(dt, stickiness) {\n    const obstacle = this.obstacle;\n    if (!obstacle?.drape) return null;\n    if (\n      this._retentionObstacle === obstacle &&\n      this._retentionStep === dt &&\n      this._retentionStickiness === stickiness\n    )\n      return this._drapeRetention;\n    const retention = (this._drapeRetention ??= new Float64Array(this.nx * this.ny)),\n      radius = this.dx * 0.8;\n    for (let k = 0; k < retention.length; k++) {\n      const d = obstacle.distance[k],\n        wet = d < 0 ? 1 : d < radius ? (1 - d / radius) ** 2 : 0;\n      retention[k] = Math.exp(-dt * stickiness * 800 * wet);\n    }\n    this._retentionObstacle = obstacle;\n    this._retentionStep = dt;\n    this._retentionStickiness = stickiness;\n    return retention;\n  }\n  // Rounded-box signed distance and outward normal, shared by grid and particles.\n  contact(x, y, box) {\n    const cx = (box.left + box.right) / 2,\n      cy = (box.top + box.bottom) / 2,\n      hx = (box.right - box.left) / 2,\n      hy = (box.top - box.bottom) / 2;\n    const r = Math.min(box.radius || 0, hx, hy),\n      dx = x - cx,\n      dy = y - cy,\n      qx = Math.abs(dx) - hx + r,\n      qy = Math.abs(dy) - hy + r;\n    const ox = Math.max(qx, 0),\n      oy = Math.max(qy, 0),\n      outside = Math.hypot(ox, oy);\n    const distance = outside + Math.min(Math.max(qx, qy), 0) - r;\n    let nx = 0,\n      ny = 0;\n    if (outside > 1e-8) {\n      nx = (ox / outside) * Math.sign(dx);\n      ny = (oy / outside) * Math.sign(dy);\n    } else if (qx > qy) nx = Math.sign(dx) || 1;\n    else ny = Math.sign(dy) || 1;\n    return { distance, nx, ny };\n  }\n  step(\n    dt,\n    {\n      viscosity = 0.88,\n      drag = 0,\n      stickiness = 0.85,\n      flow = 0.55,\n      emit = true,\n      solids = [],\n      grab = null,\n    } = {},\n  ) {\n    if (!Number.isFinite(dt) || dt <= 0) return;\n    dt = Math.min(dt, 0.05);\n    const moving = solids.map((s, i) => {\n      const id = s.id ?? i,\n        x = (s.left + s.right) / 2,\n        y = (s.top + s.bottom) / 2,\n        old = this.previousSolids.get(id);\n      this.previousSolids.set(id, { x, y });\n      return {\n        ...s,\n        id,\n        vx: old ? clamp((x - old.x) / dt, -5, 5) : 0,\n        vy: old ? clamp((y - old.y) / dt, -5, 5) : 0,\n      };\n    });\n    this.accumulator += dt;\n    const hdt = this.dx >= 0.12 ? 1 / 180 : 1 / 240;\n    while (this.accumulator >= hdt - 1e-9) {\n      this.substep(hdt, { viscosity, drag, stickiness, flow, emit, solids: moving, grab });\n      this.accumulator -= hdt;\n    }\n  }\n  substep(dt, { viscosity, drag = 0, stickiness, flow, emit, solids, grab }) {\n    this.time += dt;\n    // Feed a filled nozzle at a prescribed flux. Isolated free-falling rows\n    // produce pellets before a fluid neck has a chance to form.\n    const inletSpeed = 0.68 + flow * 0.45,\n      inletY = 2.55,\n      inletHalfWidth = 0.3;\n    if (emit) {\n      if (!this.inletStarted) {\n        const reservoir = this.particles.filter(\n          (p) => p.x < -6.7 && Math.abs(p.y - inletY) < inletHalfWidth + this.spacing,\n        );\n        for (let x = -7.4; x <= -6.82; x += this.spacing)\n          for (let y = -inletHalfWidth; y <= inletHalfWidth; y += this.spacing) {\n            if (!reservoir.some((p) => Math.hypot(p.x - x, p.y - inletY - y) < this.spacing * 0.65))\n              this.add(x, inletY + y, inletSpeed, 0);\n          }\n        this.inletStarted = true;\n      }\n      this.emitted += (dt * inletSpeed) / this.spacing;\n      while (this.emitted >= 1) {\n        for (let y = -inletHalfWidth; y <= inletHalfWidth; y += this.spacing)\n          this.add(-7.4, inletY + y, inletSpeed, 0);\n        this.emitted--;\n      }\n    }\n    const { nx, ny, inv, dx, mass, massGrid, u, v, active } = this;\n    const drapeRetention = this._drapeRetentionFor(dt, stickiness);\n    massGrid.fill(0);\n    u.fill(0);\n    v.fill(0);\n    active.length = 0;\n    // P2G: quadratic B-spline interpolation conserves particle mass and momentum.\n    for (const p of this.particles) {\n      const gx = (p.x + 8) * inv,\n        gy = (p.y + 4.4) * inv,\n        bx = Math.floor(gx - 0.5),\n        by = Math.floor(gy - 0.5),\n        fx = gx - bx,\n        fy = gy - by,\n        w = p.weights;\n      p.bx = bx;\n      p.by = by;\n      p.fx = fx;\n      p.fy = fy;\n      w[0] = 0.5 * (1.5 - fx) ** 2;\n      w[1] = 0.75 - (fx - 1) ** 2;\n      w[2] = 0.5 * (fx - 0.5) ** 2;\n      w[3] = 0.5 * (1.5 - fy) ** 2;\n      w[4] = 0.75 - (fy - 1) ** 2;\n      w[5] = 0.5 * (fy - 0.5) ** 2;\n      const pvx = p.vx,\n        pvy = p.vy,\n        pc00 = p.c00,\n        pc01 = p.c01,\n        pc10 = p.c10,\n        pc11 = p.c11,\n        particleMass = p.mass;\n      for (let j = 0; j < 3; j++) {\n        const row = (by + j) * nx + bx,\n          wy = w[3 + j],\n          ry = (j - fy) * dx,\n          tx = pc01 * ry,\n          ty = pc11 * ry;\n        for (let i = 0; i < 3; i++) {\n          const k = row + i,\n            weight = w[i] * wy,\n            rx = (i - fx) * dx;\n          if (weight < 1e-12) continue;\n          if (massGrid[k] === 0) active.push(k);\n          const weightedMass = weight * particleMass;\n          massGrid[k] += weightedMass;\n          u[k] += weightedMass * (pvx + pc00 * rx + tx);\n          v[k] += weightedMass * (pvy + pc10 * rx + ty);\n        }\n      }\n    }\n    // Pressure + polymer stress divergence. Volume is re-estimated each step,\n    // so fluid can separate and merge without a reference shape or springs.\n    const modulus = 0.15 + viscosity * viscosity * 2.8;\n    for (const p of this.particles) {\n      const w = p.weights,\n        bx = p.bx,\n        by = p.by,\n        fx = p.fx,\n        fy = p.fy;\n      let rho = 0;\n      for (let j = 0; j < 3; j++) {\n        const row = (by + j) * nx + bx,\n          wy = w[3 + j];\n        for (let i = 0; i < 3; i++) rho += w[i] * wy * massGrid[row + i] * inv * inv;\n      }\n      p.density = rho;\n      const rho2 = rho * rho;\n      const pressure = clamp(22 * (rho2 * rho2 - 1), -0.65, 100),\n        volume = p.mass / Math.max(0.3, rho);\n      const extensibility = 30 / Math.max(0.001, 32 - p.q00 - p.q11);\n      const s00 = -pressure + modulus * (extensibility * p.q00 - 1),\n        s01 = modulus * extensibility * p.q01,\n        s11 = -pressure + modulus * (extensibility * p.q11 - 1);\n      const coefficient = -dt * volume * 4 * inv * inv;\n      for (let j = 0; j < 3; j++) {\n        const row = (by + j) * nx + bx,\n          wy = w[3 + j],\n          ry = (j - fy) * dx,\n          tx = s01 * ry,\n          ty = s11 * ry;\n        for (let i = 0; i < 3; i++) {\n          const k = row + i,\n            weight = w[i] * wy,\n            rx = (i - fx) * dx;\n          if (weight < 1e-12) continue;\n          u[k] += coefficient * weight * (s00 * rx + tx);\n          v[k] += coefficient * weight * (s01 * rx + ty);\n        }\n      }\n    }\n    this.wall.fill(0);\n    this.wallU.fill(0);\n    this.wallV.fill(0);\n    for (const k of active) {\n      u[k] = clamp(u[k] / massGrid[k], -9, 9);\n      v[k] = clamp(v[k] / massGrid[k] - dt * this.gravity, -9, 9);\n      const ix = k % nx,\n        iy = (k / nx) | 0,\n        x = ix * dx - 8,\n        y = iy * dx - 4.4;\n      if (x < this.bounds.left + dx || x > this.bounds.right - dx || y < this.bounds.bottom + dx) {\n        this.wall[k] = 1;\n      }\n      if (emit && Math.abs(y - inletY) < inletHalfWidth + dx && x < -6.84) {\n        this.wall[k] = 1;\n        this.wallU[k] = inletSpeed;\n      }\n      if (this.obstacle && this.obstacle.distance[k] < dx * 0.8) {\n        const d = this.obstacle.distance[k],\n          normalX = this.obstacle.gx[k],\n          normalY = this.obstacle.gy[k];\n        if (this.obstacle.drape) {\n          // A submerged relief retains fluid through wet friction without\n          // cutting the planar mass into separate pockets inside glyphs.\n          const retention = drapeRetention[k];\n          u[k] *= retention;\n          v[k] *= retention;\n        } else {\n          this.wall[k] = Math.max(this.wall[k], d < 0 ? 1 : stickiness * (1 - d / (dx * 0.8)) ** 2);\n          const normal = u[k] * normalX + v[k] * normalY;\n          if (normal < 0 && d < dx * 0.35) {\n            u[k] -= normal * normalX;\n            v[k] -= normal * normalY;\n          }\n        }\n      }\n      for (const box of solids) {\n        if (x < box.left - dx || x > box.right + dx || y < box.bottom - dx || y > box.top + dx)\n          continue;\n        const c = this.contact(x, y, box);\n        if (c.distance < dx * 0.8) {\n          const weight = c.distance < 0 ? 1 : stickiness * Math.pow(1 - c.distance / (dx * 0.8), 2);\n          this.wall[k] = Math.max(this.wall[k], weight);\n          this.wallU[k] = box.vx;\n          this.wallV[k] = box.vy;\n          const normal = (u[k] - box.vx) * c.nx + (v[k] - box.vy) * c.ny;\n          if (normal < 0 && c.distance < dx * 0.35) {\n            u[k] -= normal * c.nx;\n            v[k] -= normal * c.ny;\n          }\n        }\n      }\n      this.u0[k] = u[k];\n      this.v0[k] = v[k];\n    }\n    // Backward-Euler viscosity with precomputed coefficients and six SOR\n    // sweeps. In-place updates propagate wet-wall and shear response faster.\n    const alpha = (0.018 + viscosity * viscosity * 3.5) * dt * inv * inv;\n    const { viscL, viscR, viscB, viscT, viscU, viscV } = this;\n    for (const k of active) {\n      const denominator = Math.max(massGrid[k], mass * 0.02),\n        cutoff = mass * 0.001;\n      const wl = massGrid[k - 1] >= cutoff ? Math.min(1, massGrid[k - 1] / denominator) : 0,\n        wr = massGrid[k + 1] >= cutoff ? Math.min(1, massGrid[k + 1] / denominator) : 0;\n      const wb = massGrid[k - nx] >= cutoff ? Math.min(1, massGrid[k - nx] / denominator) : 0,\n        wt = massGrid[k + nx] >= cutoff ? Math.min(1, massGrid[k + nx] / denominator) : 0;\n      const wall = this.wall[k],\n        inverse = (1 - wall) / (1 + alpha * (wl + wr + wb + wt)),\n        scale = alpha * inverse;\n      viscL[k] = wl * scale;\n      viscR[k] = wr * scale;\n      viscB[k] = wb * scale;\n      viscT[k] = wt * scale;\n      viscU[k] = this.u0[k] * inverse + this.wallU[k] * wall;\n      viscV[k] = this.v0[k] * inverse + this.wallV[k] * wall;\n      if (wall === 1) {\n        u[k] = viscU[k];\n        v[k] = viscV[k];\n      }\n    }\n    const readU = u,\n      readV = v;\n    for (let iteration = 0; iteration < 6; iteration++) {\n      for (let index = 0; index < active.length; index++) {\n        const k = active[iteration % 2 === 0 ? index : active.length - 1 - index];\n        const a =\n          viscU[k] +\n          viscL[k] * (u[k - 1] ?? 0) +\n          viscR[k] * (u[k + 1] ?? 0) +\n          viscB[k] * (u[k - nx] ?? 0) +\n          viscT[k] * (u[k + nx] ?? 0);\n        const b =\n          viscV[k] +\n          viscL[k] * (v[k - 1] ?? 0) +\n          viscR[k] * (v[k + 1] ?? 0) +\n          viscB[k] * (v[k - nx] ?? 0) +\n          viscT[k] * (v[k + nx] ?? 0);\n        u[k] += 1.15 * (a - u[k]);\n        v[k] += 1.15 * (b - v[k]);\n      }\n    }\n    // G2P: advect mass and its affine velocity field. Tensor stress is local to\n    // material, convects with flow, and relaxes continuously instead of fixing shape.\n    const relaxationStep = dt / (0.25 + viscosity * 2.5);\n    // Environmental friction damps translation as well as shear. Unlike\n    // pausing, it leaves forces, recoil, and pointer interaction continuous.\n    if (drag > 0) {\n      const retention = Math.exp(-dt * drag);\n      for (const k of active) {\n        readU[k] *= retention;\n        readV[k] *= retention;\n      }\n    }\n    for (const p of this.particles) {\n      const w = p.weights,\n        bx = p.bx,\n        by = p.by,\n        fx = p.fx,\n        fy = p.fy;\n      let vx = 0,\n        vy = 0,\n        c00 = 0,\n        c01 = 0,\n        c10 = 0,\n        c11 = 0;\n      for (let j = 0; j < 3; j++) {\n        const row = (by + j) * nx + bx,\n          wy = w[3 + j],\n          ry = (j - fy) * dx;\n        for (let i = 0; i < 3; i++) {\n          const k = row + i,\n            weight = w[i] * wy,\n            rx = (i - fx) * dx;\n          if (weight < 1e-12) continue;\n          const a = readU[k],\n            b = readV[k],\n            wa = weight * a,\n            wb = weight * b;\n          vx += wa;\n          vy += wb;\n          c00 += wa * rx;\n          c01 += wa * ry;\n          c10 += wb * rx;\n          c11 += wb * ry;\n        }\n      }\n      const factor = 4 * inv * inv;\n      p.c00 = clamp(c00 * factor, -25, 25);\n      p.c01 = clamp(c01 * factor, -25, 25);\n      p.c10 = clamp(c10 * factor, -25, 25);\n      p.c11 = clamp(c11 * factor, -25, 25);\n      const a = 1 + dt * p.c00,\n        b = dt * p.c01,\n        c = dt * p.c10,\n        d = 1 + dt * p.c11;\n      const q00 = a * a * p.q00 + 2 * a * b * p.q01 + b * b * p.q11,\n        q01 = a * c * p.q00 + (a * d + b * c) * p.q01 + b * d * p.q11,\n        q11 = c * c * p.q00 + 2 * c * d * p.q01 + d * d * p.q11;\n      // Implicit FENE-P relaxation uses the same finite-extension factor as\n      // stress. Solve the trace first, then scale the positive tensor.\n      const bt = q00 + q11 + 2 * relaxationStep,\n        sum = 32 + 30 * relaxationStep + bt;\n      const trace = (64 * bt) / (sum + Math.sqrt(Math.max(0, sum * sum - 128 * bt))),\n        tensorScale = trace / bt;\n      p.q00 = (q00 + relaxationStep) * tensorScale;\n      p.q11 = (q11 + relaxationStep) * tensorScale;\n      p.q01 = q01 * tensorScale;\n      const d00 = a * a * p.d00 + 2 * a * b * p.d01 + b * b * p.d11,\n        d01 = a * c * p.d00 + (a * d + b * c) * p.d01 + b * d * p.d11,\n        d11 = c * c * p.d00 + 2 * c * d * p.d01 + d * d * p.d11;\n      p.d00 = d00;\n      p.d01 = d01;\n      p.d11 = d11;\n      if (grab) {\n        const weight = grab.weights.get(p.id) || 0;\n        if (weight) {\n          const offset = grab.offsets.get(p.id),\n            gain = 1 - Math.exp(-dt * 110 * weight);\n          vx += (clamp((grab.x + offset[0] - p.x) * 15, -6, 6) - vx) * gain;\n          vy += (clamp((grab.y + offset[1] - p.y) * 15, -6, 6) - vy) * gain;\n        }\n      }\n      p.vx = vx;\n      p.vy = vy;\n      p.x += vx * dt;\n      p.y += vy * dt;\n      p.attachment = null;\n      if (this.obstacle && !this.obstacle.drape) {\n        const contact = this.sampleObstacle(p.x, p.y),\n          radius = this.spacing * 0.5;\n        if (contact.distance < radius) {\n          p.x += contact.nx * (radius - contact.distance);\n          p.y += contact.ny * (radius - contact.distance);\n          const normal = p.vx * contact.nx + p.vy * contact.ny;\n          if (normal < 0) {\n            p.vx -= normal * contact.nx;\n            p.vy -= normal * contact.ny;\n          }\n          p.vx *= 1 - stickiness * 0.4;\n          p.vy *= 1 - stickiness * 0.4;\n        }\n        if (contact.distance < dx * 0.65 && stickiness > 0.02) p.attachment = { body: 'text' };\n      }\n      for (const box of solids) {\n        if (\n          p.x < box.left - dx ||\n          p.x > box.right + dx ||\n          p.y < box.bottom - dx ||\n          p.y > box.top + dx\n        )\n          continue;\n        const c = this.contact(p.x, p.y, box),\n          radius = this.spacing * 0.5;\n        if (c.distance < radius) {\n          p.x += c.nx * (radius - c.distance);\n          p.y += c.ny * (radius - c.distance);\n          const normal = (p.vx - box.vx) * c.nx + (p.vy - box.vy) * c.ny;\n          if (normal < 0) {\n            p.vx -= normal * c.nx;\n            p.vy -= normal * c.ny;\n          }\n          p.vx += (box.vx - p.vx) * stickiness * 0.4;\n          p.vy += (box.vy - p.vy) * stickiness * 0.4;\n        }\n        if (c.distance < dx * 0.65 && stickiness > 0.02) p.attachment = { body: box.id };\n      }\n      if (p.x < this.bounds.left || p.x > this.bounds.right) {\n        p.x = clamp(p.x, this.bounds.left, this.bounds.right);\n        p.vx = 0;\n        p.c00 = p.c01 = p.c10 = p.c11 = 0;\n      }\n      if (p.y < this.bounds.bottom) {\n        p.y = this.bounds.bottom;\n        p.vy = 0;\n        p.vx *= 0.85;\n        p.c00 = p.c01 = p.c10 = p.c11 = 0;\n      }\n      if (p.y > this.bounds.top) {\n        p.y = this.bounds.top;\n        p.vy = Math.min(0, p.vy);\n      }\n    }\n    if (++this.adaptStep % 4 === 0) this._adaptParticles(solids, grab);\n  }\n  _adaptParticles(solids, grab) {\n    // Refine the material quadrature, not its topology. A stretched sample\n    // becomes two half-mass samples before their grid support can separate.\n    const threshold = this.mass * 1.7 ** 2,\n      initialCount = this.particles.length;\n    if (initialCount > this.maxParticles * 0.9) this._mergeSettled(grab);\n    const count = this.particles.length;\n    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {\n      const p = this.particles[i];\n      if (\n        p.mass <= this.mass / 16 ||\n        p.attachment ||\n        grab?.weights.has(p.id) ||\n        (p.y < this.bounds.bottom + this.dx * 3 && Math.hypot(p.vx, p.vy) < 0.15)\n      )\n        continue;\n      const gap = Math.hypot(p.d00 - p.d11, 2 * p.d01),\n        eigenvalue = (p.d00 + p.d11 + gap) * 0.5;\n      if (eigenvalue < threshold) continue;\n      const angle = 0.5 * Math.atan2(2 * p.d01, p.d00 - p.d11),\n        nx = Math.cos(angle),\n        ny = Math.sin(angle),\n        offset = Math.sqrt(eigenvalue) * 0.25;\n      const ox = nx * offset,\n        oy = ny * offset,\n        x = p.x,\n        y = p.y;\n      const clear = (px, py) =>\n        px > this.bounds.left &&\n        px < this.bounds.right &&\n        py > this.bounds.bottom &&\n        py < this.bounds.top &&\n        (!this.obstacle ||\n          this.obstacle.drape ||\n          this.sampleObstacle(px, py).distance > this.spacing * 0.5) &&\n        !solids.some((box) => this.contact(px, py, box).distance < this.spacing * 0.5);\n      if (!clear(x - ox, y - oy) || !clear(x + ox, y + oy)) continue;\n      const vx = p.vx,\n        vy = p.vy,\n        dvx = p.c00 * ox + p.c01 * oy,\n        dvy = p.c10 * ox + p.c11 * oy;\n      p.mass *= 0.5;\n      p.d00 -= eigenvalue * 0.75 * nx * nx;\n      p.d01 -= eigenvalue * 0.75 * nx * ny;\n      p.d11 -= eigenvalue * 0.75 * ny * ny;\n      const child = { ...p, id: this.nextId++, weights: new Float64Array(6) };\n      p.x = x - ox;\n      p.y = y - oy;\n      p.vx = vx - dvx;\n      p.vy = vy - dvy;\n      child.x = x + ox;\n      child.y = y + oy;\n      child.vx = vx + dvx;\n      child.vy = vy + dvy;\n      this.particles.push(child);\n      this.splits++;\n    }\n  }\n  _mergeSettled(grab) {\n    // Coarsen only quiet floor deposits. Weighted centroids preserve mass and\n    // linear momentum; the material-domain moment includes the pair separation.\n    const cells = new Map(),\n      removed = new Set(),\n      cell = this.spacing * 1.15;\n    for (const p of this.particles) {\n      if (\n        p.y > this.bounds.bottom + this.dx * 3 ||\n        p.attachment ||\n        Math.hypot(p.vx, p.vy) > 0.15 ||\n        grab?.weights.has(p.id) ||\n        p.mass >= this.mass * 2\n      )\n        continue;\n      const key = Math.floor((p.x + 8) / cell) + ',' + Math.floor((p.y + 4.4) / cell),\n        other = cells.get(key);\n      if (!other || other.mass + p.mass > this.mass * 2) {\n        cells.set(key, p);\n        continue;\n      }\n      const total = other.mass + p.mass,\n        wa = other.mass / total,\n        wb = p.mass / total,\n        ox = p.x - other.x,\n        oy = p.y - other.y;\n      for (const name of [\n        'x',\n        'y',\n        'materialX',\n        'materialY',\n        'vx',\n        'vy',\n        'c00',\n        'c01',\n        'c10',\n        'c11',\n        'q00',\n        'q01',\n        'q11',\n        'density',\n      ])\n        other[name] = other[name] * wa + p[name] * wb;\n      other.d00 = other.d00 * wa + p.d00 * wb + 12 * wa * wb * ox * ox;\n      other.d01 = other.d01 * wa + p.d01 * wb + 12 * wa * wb * ox * oy;\n      other.d11 = other.d11 * wa + p.d11 * wb + 12 * wa * wb * oy * oy;\n      other.mass = total;\n      removed.add(p.id);\n      this.merges++;\n      cells.delete(key);\n    }\n    if (removed.size) this.particles = this.particles.filter((p) => !removed.has(p.id));\n  }\n}\n";
//#endregion
//#region src/liquid-thread.js
function _(e, t, n) {
	let r = g.replace("export class ViscousFluid", "class ViscousFluid") + "\n(" + v.toString() + ")();", i = URL.createObjectURL(new Blob([r], { type: "text/javascript" })), a;
	try {
		a = new Worker(i, { name: "slimey-fluid" });
	} finally {
		URL.revokeObjectURL(i);
	}
	return a.onmessage = (e) => {
		e.data.error ? n(Error(e.data.error)) : t(e.data);
	}, a.onerror = (e) => {
		e.preventDefault(), n(Error(e.message));
	}, a.postMessage({
		type: "init",
		options: e
	}), a;
}
function v() {
	let e, t = null, n = -1;
	self.onmessage = ({ data: r }) => {
		try {
			r.type === "init" ? (e = new ViscousFluid(r.options), r.options.seed && (e.seed(r.options.seed), r.options.seed.mode !== "text" && e.setObstacleMask(r.options.seed.mask, { drape: !0 }))) : (r.mask && e.setObstacleMask(r.mask, { drape: !0 }), r.pour && e.pour(), r.pointer ? (r.pointer.generation !== n && (t = e.grab(r.pointer.x, r.pointer.y), n = r.pointer.generation), t.x = r.pointer.x, t.y = r.pointer.y) : (t = null, n = -1), Number.isFinite(r.options.gravity) && (e.gravity = r.options.gravity), e.step(r.dt, {
				...r.options,
				grab: t
			}));
			let i = e.particles.length, a = e.maxParticles * 12 * 4, o = new Float32Array(r.buffer?.byteLength >= a ? r.buffer : new ArrayBuffer(a));
			for (let t = 0; t < i; t++) {
				let n = e.particles[t], r = t * 12;
				o[r] = n.id, o[r + 1] = n.x, o[r + 2] = n.y, o[r + 3] = n.vx, o[r + 4] = n.vy, o[r + 5] = n.mass, o[r + 6] = n.q00, o[r + 7] = n.q01, o[r + 8] = n.q11, o[r + 9] = n.materialX, o[r + 10] = n.materialY, o[r + 11] = +!!n.attachment;
			}
			self.postMessage({
				buffer: o.buffer,
				count: i,
				time: e.time
			}, [o.buffer]);
		} catch (e) {
			self.postMessage({ error: e.message });
		}
	};
}
//#endregion
//#region src/slimey-goo.js
var y = (e, t, n) => Math.max(t, Math.min(n, e)), b = (e, t, n) => {
	let r = e.getAttribute(t), i = r === null ? n : Number(r);
	return Number.isFinite(i) ? y(i, 0, 1) : n;
}, x = {
	slime: {
		color: "#ffffff",
		attenuation: "#c6cc55",
		distance: .8,
		transmission: 1,
		roughness: .11,
		thickness: .38
	},
	cheese: {
		color: "#fff0be",
		attenuation: "#efa324",
		distance: .48,
		transmission: .76,
		roughness: .19,
		thickness: .8
	},
	clear: {
		color: "#ffffff",
		attenuation: "#edf0df",
		distance: 2.5,
		transmission: 1,
		roughness: .09,
		thickness: .32
	}
};
function S(e, t, n, r, i, a) {
	e.beginPath(), e.roundRect(t, n, r, i, Math.max(0, Math.min(a, r / 2, i / 2)));
}
var C = class extends HTMLElement {
	static observedAttributes = [
		"material",
		"color",
		"mode",
		"gravity",
		"friction",
		"viscosity",
		"stickiness",
		"flow",
		"backdrop",
		"paused",
		"quality",
		"drips"
	];
	constructor() {
		super(), this.attachShadow({ mode: "open" }), this.shadowRoot.innerHTML = "<style>\n      :host{display:block;position:relative;isolation:isolate;overflow:hidden}\n      canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;filter:drop-shadow(1px 7px 7px #69712615) drop-shadow(0 2px 2px #71802912)}\n      ::slotted([data-goo-ui]){position:relative;z-index:2}\n      :host([data-dragging]){user-select:none;-webkit-user-select:none}\n      .fallback{display:none;position:absolute;inset:8% 0 10%;pointer-events:none;z-index:1;opacity:.3;background:radial-gradient(ellipse at 25% 40%,#b6c75f,transparent 65%)}\n      :host([data-fallback]) .fallback{display:block}\n      :host([data-fallback]) canvas{display:none}\n    </style><div class=\"fallback\" aria-hidden=\"true\"></div><slot></slot>", this._dirty = !0, this._visible = !0, this._reduced = matchMedia("(prefers-reduced-motion: reduce)"), this._frame = this._frame.bind(this), this._pointer = new e.Vector2(), this._colliderIds = /* @__PURE__ */ new WeakMap(), this._nextCollider = 0, this._hiddenText = /* @__PURE__ */ new Map(), this._needsSeed = !0;
	}
	connectedCallback() {
		if (this._renderer) return;
		this._abort = new AbortController();
		let t = this._abort.signal;
		try {
			this._renderer = new e.WebGLRenderer({
				alpha: !0,
				antialias: !0,
				powerPreference: "high-performance"
			}), this._renderer.setClearColor(0, 0), this._renderer.toneMapping = e.NoToneMapping, this._renderer.domElement.setAttribute("aria-hidden", "true"), this.shadowRoot.prepend(this._renderer.domElement), this._scene = new e.Scene(), this._camera = new e.OrthographicCamera(-6.4, 6.4, 4, -4, .1, 50), this._camera.position.set(0, 4, 12), this._camera.lookAt(0, 0, 0);
			let n = new u(), r = new e.PMREMGenerator(this._renderer), i = new e.Mesh(new e.PlaneGeometry(6, 9), new e.MeshBasicMaterial({
				color: "#111810",
				side: e.DoubleSide
			}));
			i.position.set(-5, 1, 2), i.lookAt(0, 0, 0), n.add(i);
			let a = new e.Mesh(new e.PlaneGeometry(6, .65), new e.MeshBasicMaterial({
				color: "#fffce8",
				side: e.DoubleSide
			}));
			a.position.set(1, 5, 3), a.lookAt(0, 0, 0), n.add(a), this._environment = r.fromScene(n, .035), this._scene.environment = this._environment.texture, this._scene.environmentIntensity = .85, n.dispose(), r.dispose();
			let o = new e.DirectionalLight("#fff7dc", 1.4);
			o.position.set(-3, 7, 6);
			let s = new e.DirectionalLight("#feffed", .7);
			s.position.set(4, 1, -1), this._scene.add(o, s, new e.AmbientLight("#eff1df", .18)), this._pageCanvas = document.createElement("canvas"), this._pageTexture = new e.CanvasTexture(this._pageCanvas), this._pageTexture.colorSpace = e.SRGBColorSpace, this._material = new e.MeshPhysicalMaterial({
				metalness: 0,
				ior: 1.39,
				transmission: 0,
				roughness: .08,
				thickness: .38,
				envMapIntensity: 1.1,
				clearcoat: .1,
				clearcoatRoughness: .07,
				side: e.FrontSide
			}), this._material.defines.USE_TRANSMISSION = "", this._transmissionUniforms = {
				transmission: { value: 1 },
				thickness: { value: this._material.thickness },
				attenuationDistance: { value: this._material.attenuationDistance },
				attenuationColor: { value: this._material.attenuationColor }
			}, this._material.onBeforeCompile = (t) => {
				Object.assign(t.uniforms, this._transmissionUniforms), t.uniforms.uPage = { value: this._pageTexture }, t.vertexShader = "attribute float gooThickness;\nattribute vec2 gooMaterialUV;\nvarying float vGooThickness;\nvarying vec2 vGooMaterialUV;\n" + t.vertexShader, t.vertexShader = t.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvGooThickness = gooThickness;\nvGooMaterialUV = gooMaterialUV;"), t.fragmentShader = "uniform sampler2D uPage;\n          varying float vGooThickness;\n          varying vec2 vGooMaterialUV;\n          float gooHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n          float gooNoise(vec2 p){\n            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);\n            return mix(mix(gooHash(i),gooHash(i+vec2(1,0)),f.x),mix(gooHash(i+vec2(0,1)),gooHash(i+vec2(1,1)),f.x),f.y);\n          }\n          float gooMicro(vec2 p){\n            vec2 q=p*18.0,cell=floor(q),local=fract(q);\n            vec2 center=.2+.6*vec2(gooHash(cell),gooHash(cell+17.0));\n            float radius=.09+.15*gooHash(cell+41.0),d=length(local-center);\n            float width=max(.035,fwidth(d)*.7);\n            float ring=exp(-pow((d-radius)/width,2.0));\n            float folds=gooNoise(p*13.0+gooNoise(p*3.0)*2.0)*.0025+gooNoise(p*31.0)*.001;\n            return folds+ring*step(.93,gooHash(cell+93.0))*.0035;\n          }\n        " + t.fragmentShader, t.fragmentShader = t.fragmentShader.replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n          float micro=gooMicro(vGooMaterialUV)*smoothstep(.05,.18,vGooThickness);\n          vec3 surfacePosition=-vViewPosition;\n          vec3 tangentX=dFdx(surfacePosition),tangentY=dFdy(surfacePosition);\n          vec3 crossX=cross(tangentY,normal),crossY=cross(normal,tangentX);\n          float determinant=dot(tangentX,crossX);\n          normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(micro)*crossX+dFdy(micro)*crossY));\n        "), t.fragmentShader = t.fragmentShader.replace("#include <transmission_pars_fragment>", e.ShaderChunk.transmission_pars_fragment.replace("return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );", "return texture2D(uPage,clamp(fragCoord.xy,vec2(0.001),vec2(0.999)));").replace("float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );", "").replace("return normalize( refractionVector ) * thickness * modelScale;", "return normalize( refractionVector ) * thickness;")), t.fragmentShader = t.fragmentShader.replace("#include <transmission_fragment>", e.ShaderChunk.transmission_fragment.replace("vec3 v = normalize( cameraPosition - pos );", "vec3 v = normalize(vec3(0.0,4.0,12.0));").replace("material.thickness = thickness;", "material.thickness = thickness * max(0.025, vGooThickness) / 0.38;"));
			}, this._configureFluid(), this._needsSeed = !0, this._sync(), this._resizeObserver = new ResizeObserver(() => this._resize()), this._resizeObserver.observe(this), this._mutationObserver = new MutationObserver(() => {
				this._dirty = !0, this._observeTargets();
			}), this._mutationObserver.observe(this, {
				subtree: !0,
				childList: !0,
				characterData: !0,
				attributes: !0,
				attributeFilter: [
					"data-goo",
					"data-goo-solid",
					"class",
					"style"
				]
			}), this._intersectionObserver = new IntersectionObserver((e) => {
				this._visible = e[0].isIntersecting;
			}), this._intersectionObserver.observe(this), this._observeTargets(), this.addEventListener("pointerdown", (e) => this._down(e), { signal: t }), this.addEventListener("pointermove", (e) => this._move(e), {
				signal: t,
				passive: !0
			}), this.addEventListener("keydown", (e) => this._keyMove(e), { signal: t }), window.addEventListener("pointermove", (e) => {
				(this._movingElement || this._fluidGrab) && this._move(e);
			}, {
				signal: t,
				passive: !0
			}), window.addEventListener("pointerup", () => this._release(), { signal: t }), window.addEventListener("pointercancel", () => this._release(), { signal: t }), window.addEventListener("scroll", () => {
				this._dirty = !0;
			}, {
				signal: t,
				passive: !0
			}), window.addEventListener("resize", () => this._resize(), { signal: t }), this._reduced.addEventListener("change", () => {
				this._release(), this._dirty = !0;
			}, { signal: t }), this._renderer.domElement.addEventListener("webglcontextlost", (e) => {
				e.preventDefault(), this._lost = !0, this.setAttribute("data-fallback", ""), this._syncTextVisibility();
			}, { signal: t }), this._renderer.domElement.addEventListener("webglcontextrestored", () => {
				this._lost = !1, this._dirty = !0, this.removeAttribute("data-fallback");
			}, { signal: t }), document.fonts?.ready.then(() => {
				this.isConnected && (this._interacted || (this._needsSeed = !0), this.refresh());
			}), document.fonts?.addEventListener("loadingdone", () => {
				this._interacted || (this._needsSeed = !0), this.refresh();
			}, { signal: t }), this._resize(), this._last = performance.now(), this._raf = requestAnimationFrame(this._frame), this._lost = !1, this.removeAttribute("data-fallback"), this.dispatchEvent(new CustomEvent("goo-ready", { bubbles: !0 }));
		} catch (e) {
			this._destroy(), this.setAttribute("data-fallback", ""), this.dispatchEvent(new CustomEvent("goo-error", {
				detail: { message: e.message },
				bubbles: !0
			}));
		}
	}
	_observeTargets() {
		let e = Array.from(this.querySelectorAll("[data-goo]")).slice(0, 24);
		for (let t of this._targets || []) e.includes(t) || this._resizeObserver?.unobserve(t);
		for (let t of e) this._resizeObserver?.observe(t);
		this._targets = e;
	}
	_sync() {
		if (!this._material) return;
		let e = x[this.getAttribute("material")] || x.slime, t = this.getAttribute("color");
		this._material.color.set(e.color), this._material.attenuationColor.set(/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(t || "") ? t : e.attenuation), this._material.attenuationDistance = e.distance, this._material.roughness = e.roughness, this._material.thickness = e.thickness, this._transmissionUniforms.transmission.value = e.transmission, this._transmissionUniforms.thickness.value = e.thickness, this._transmissionUniforms.attenuationDistance.value = e.distance, this._dirty = !0;
	}
	get mode() {
		return this.getAttribute("mode") === "text" ? "text" : "drip";
	}
	get gravity() {
		let e = this.getAttribute("gravity"), t = e === null ? 3.4 : Number(e);
		return Number.isFinite(t) ? y(t, 0, 20) : 3.4;
	}
	get friction() {
		let e = this.getAttribute("friction"), t = this.mode === "text" ? 5 : 0, n = e === null ? t : Number(e);
		return Number.isFinite(n) ? y(n, 0, 20) : t;
	}
	_effectiveGravity() {
		if (this.hasAttribute("gravity")) return this.gravity;
		if (this.mode === "text" && !this._textActivated) return 0;
		if (this._fluidGrab || this._movingElement) return this.gravity;
		if (this.mode === "text" && this._gravityStartedAt == null) return 0;
		let e = (this._fluid?.time || 0) - (this._gravityStartedAt || 0), t = y(this.mode === "text" ? e / 2 : (e - 2) / .6, 0, 1);
		return this.gravity * (1 - t * t * (3 - 2 * t));
	}
	_restartGravity() {
		this._gravityStartedAt = this._fluid?.time || 0;
	}
	attributeChangedCallback(e, t, n) {
		t !== n && (this._sync(), e === "quality" && this._resize(), e === "drips" && n !== null && this._restartGravity(), e === "mode" && (this._release(), this._needsSeed = !0, this._dirty = !0, this._interacted = !1, this._textActivated = !1, this._resize()));
	}
	_resize() {
		if (!this._renderer) return;
		let e = this.getBoundingClientRect();
		if (e.width < 1 || e.height < 1) return;
		this.mode === "text" && this._layoutWidth != null && (this._layoutWidth !== e.width || this._layoutHeight !== e.height) && (this._needsSeed = !0, this._interacted = !1), this._layoutWidth = e.width, this._layoutHeight = e.height, this._bounds = e;
		let t = e.width / e.height;
		this._scaleX = this.mode === "text" && e.width < 650 ? 1 : t / 1.6, this._camera.left = -t * 4, this._camera.right = t * 4, this._camera.updateProjectionMatrix();
		let n = Number(this.getAttribute("quality") || 1);
		this._renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5) * y(Number.isFinite(n) ? n : 1, .5, 1.5)), this._renderer.setSize(e.width, e.height, !1), this._surface.scale.x = this._scaleX, this._captureScale = Math.min(devicePixelRatio || 1, 1.5, 2200 / e.width), this._pageCanvas.width = Math.round(e.width * this._captureScale), this._pageCanvas.height = Math.round(e.height * this._captureScale), this._dirty = !0, this._lastSurface = 0;
	}
	_captureDOM() {
		this._needsSeed && this._configureFluid();
		let e = this.getBoundingClientRect(), t = this._captureScale, n = this._pageCanvas.getContext("2d");
		this._bounds = e, this._syncTextVisibility(), n.setTransform(t, 0, 0, t, 0, 0), n.fillStyle = this.getAttribute("backdrop") || "#f7f4e9", n.fillRect(0, 0, e.width, e.height), this._glyphCanvas ??= document.createElement("canvas"), this._glyphCanvas.width = this._fluid.nx, this._glyphCanvas.height = this._fluid.ny;
		let r = this._glyphCanvas.getContext("2d", { willReadFrequently: !0 }), i = this._fluid.inv, a = 8 / e.height / this._scaleX;
		r.setTransform(a * i, 0, 0, 8 / e.height * i, (8 - e.width * a / 2) * i, .4 * i), r.fillStyle = "#ffffff";
		for (let t of this._targets || []) {
			let i = t.getBoundingClientRect(), a = getComputedStyle(t);
			if (!i.width || !i.height || a.visibility === "hidden") continue;
			let o = i.left - e.left, s = i.top - e.top;
			a.backgroundColor !== "rgba(0, 0, 0, 0)" && a.backgroundColor !== "transparent" && (n.fillStyle = a.backgroundColor, S(n, o, s, i.width, i.height, parseFloat(a.borderRadius) || 0), n.fill()), parseFloat(a.borderTopWidth) > 0 && a.borderTopStyle !== "none" && (n.strokeStyle = a.borderTopColor, n.lineWidth = parseFloat(a.borderTopWidth), S(n, o + .5, s + .5, i.width - 1, i.height - 1, parseFloat(a.borderRadius) || 0), n.stroke());
			let c = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), l;
			for (; l = c.nextNode();) {
				let i = l.textContent;
				if (!i.trim()) continue;
				let a = getComputedStyle(l.parentElement);
				n.font = a.fontStyle + " " + a.fontWeight + " " + a.fontSize + " " + a.fontFamily, n.fillStyle = a.color, n.textBaseline = "alphabetic", n.letterSpacing = a.letterSpacing === "normal" ? "0px" : a.letterSpacing;
				let o = document.createRange();
				o.selectNodeContents(l);
				let s = o.getBoundingClientRect(), c = n.measureText(i), u = c.fontBoundingBoxAscent || parseFloat(a.fontSize) * .8, d = c.fontBoundingBoxDescent || parseFloat(a.fontSize) * .2;
				n.globalAlpha = t.getAttribute("data-goo-solid") === "text" ? .8 : 1, (this.mode !== "text" || t.getAttribute("data-goo-solid") !== "text") && n.fillText(i, s.left - e.left, s.top - e.top + (s.height - u - d) / 2 + u), n.globalAlpha = 1, t.getAttribute("data-goo-solid") === "text" && (r.font = n.font, r.textBaseline = n.textBaseline, r.letterSpacing = n.letterSpacing, r.fillText(i, s.left - e.left, s.top - e.top + (s.height - u - d) / 2 + u));
			}
		}
		this._pageTexture.needsUpdate = !0;
		let o = r.getImageData(0, 0, this._fluid.nx, this._fluid.ny).data, s = new Uint8Array(this._fluid.nx * this._fluid.ny);
		for (let e = 0; e < this._fluid.ny; e++) for (let t = 0; t < this._fluid.nx; t++) s[e * this._fluid.nx + t] = +(o[((this._fluid.ny - 1 - e) * this._fluid.nx + t) * 4 + 3] > 96);
		if (this._glyphMask = s, this.mode === "text" ? (this._fluid.obstacle = null, this._fluid.obstacleMask = null) : this._fluid.setObstacleMask(s, { drape: !0 }), this._threadMaskDirty = !0, this._needsSeed) {
			let e = s.some(Boolean) || this.mode === "text" ? s : this._boxSeedMask();
			this._seed = {
				mode: this.mode,
				mask: e
			}, this._fluid.seed(this._seed), this._textActivated = !1, this._gravityStartedAt = this.mode === "text" ? null : 0, this._fluid.gravity = this._effectiveGravity(), this._startThread(), this._needsSeed = !1, this._surfaceDirty = !0;
		}
	}
	_configureFluid() {
		let e = this.clientWidth < 650, t = this.mode === "text", n = t ? e ? .04 : .08 : e ? .16 : .12;
		this._fluidOptions?.cellSize !== n && (this._fluidOptions = {
			cellSize: n,
			maxParticles: e ? 1e4 : 16e3,
			initial: "empty",
			gravity: t ? 0 : this.gravity
		}, this._fluid = new p(this._fluidOptions));
		let r = e ? t ? 384 : 192 : 288;
		this._surface?.nx !== r && (this._surface && (this._scene.remove(this._surface), this._surface.geometry.dispose()), this._surface = new h(this._material, r, { closed: !1 }), this._surface.scale.set(this._scaleX || 1, Math.sqrt(160) / 12, 1), this._scene.add(this._surface)), this._surface.isolation = t ? .54 : .24, this._surface.depthScale = t ? .55 : 1;
	}
	_syncTextVisibility() {
		let e = this.mode === "text" && !this._lost && !this.hasAttribute("data-fallback") ? new Set((this._targets || []).filter((e) => e.getAttribute("data-goo-solid") === "text")) : /* @__PURE__ */ new Set();
		for (let [t, n] of this._hiddenText) e.has(t) || (t.style.opacity = n.opacity, t.style.pointerEvents = n.pointerEvents, this._hiddenText.delete(t));
		for (let t of e) this._hiddenText.has(t) || (this._hiddenText.set(t, {
			opacity: t.style.opacity,
			pointerEvents: t.style.pointerEvents
		}), t.style.opacity = "0", t.style.pointerEvents = "none");
	}
	_boxSeedMask() {
		let e = new Uint8Array(this._fluid.nx * this._fluid.ny), { nx: t, ny: n, dx: r } = this._fluid;
		for (let i of this._solidBodies()) for (let a = 1; a < n - 1; a++) for (let n = 1; n < t - 1; n++) {
			let o = n * r - 8, s = a * r - 4.4;
			o >= i.left && o <= i.right && s >= i.bottom && s <= i.top && (e[a * t + n] = 1);
		}
		return e;
	}
	_solidBodies() {
		let e = this.getBoundingClientRect(), t = 8 / e.height;
		return (this._targets || []).filter((e) => e.hasAttribute("data-goo-solid") && e.getAttribute("data-goo-solid") !== "text").map((n) => {
			let r = n.getBoundingClientRect();
			return this._colliderIds.has(n) || this._colliderIds.set(n, this._nextCollider++), {
				id: this._colliderIds.get(n),
				left: (r.left - e.left - e.width / 2) * t / this._scaleX,
				right: (r.right - e.left - e.width / 2) * t / this._scaleX,
				top: (e.height / 2 - r.top + e.top) * t,
				bottom: (e.height / 2 - r.bottom + e.top) * t,
				radius: parseFloat(getComputedStyle(n).borderRadius) * t || 0
			};
		});
	}
	_move(e) {
		let t = this.getBoundingClientRect();
		if (this._pointer.set((e.clientX - t.left - t.width / 2) * 8 / t.height / this._scaleX, (t.height / 2 - e.clientY + t.top) * 8 / t.height), this._movingElement) {
			let n = y(e.clientX - this._wordStart.x, -t.width * .4, t.width * .4), r = y(e.clientY - this._wordStart.y, -t.height * .35, t.height * .35);
			this._movingElement.style.translate = this._wordStart.tx + n + "px " + (this._wordStart.ty + r) + "px", this._dirty = !0;
		}
		this._fluidGrab && (this._fluidGrab.x = this._pointer.x, this._fluidGrab.y = this._pointer.y);
	}
	_down(e) {
		if (e.button !== 0 || e.target.closest("a,input,textarea,select,[contenteditable],button:not([data-goo-pull])")) return;
		let t = e.target.closest("[data-goo-draggable]");
		if (t) {
			this._movingElement = t;
			let n = getComputedStyle(t).translate.split(" ");
			this._wordStart = {
				x: e.clientX,
				y: e.clientY,
				tx: parseFloat(n[0]) || 0,
				ty: parseFloat(n[1]) || 0
			}, t.setPointerCapture?.(e.pointerId);
		} else {
			if (this.hasAttribute("paused") || this._reduced.matches || !this._fluid) return;
			if (this._move(e), this._fluidGrab = this._fluid.grab(this._pointer.x, this._pointer.y), !this._fluidGrab.weights.size) {
				this._fluidGrab = null;
				return;
			}
			this._fluidGrab.generation = this._grabGeneration = (this._grabGeneration || 0) + 1;
		}
		e.preventDefault(), window.getSelection()?.removeAllRanges(), this.setAttribute("data-dragging", ""), this._interacted = !0, this._fluidGrab && (this._textActivated = !0), this._restartGravity();
	}
	_release() {
		(this._movingElement || this._fluidGrab) && this._restartGravity(), this._movingElement = null, this._fluidGrab = null, this.removeAttribute("data-dragging");
	}
	_keyMove(e) {
		let t = e.target.closest("[data-goo-draggable]");
		if (!t || ![
			"ArrowLeft",
			"ArrowRight",
			"ArrowUp",
			"ArrowDown"
		].includes(e.key)) return;
		e.preventDefault();
		let n = getComputedStyle(t).translate.split(" "), r = e.shiftKey ? 20 : 5, i = parseFloat(n[0]) || 0, a = parseFloat(n[1]) || 0;
		e.key === "ArrowLeft" && (i -= r), e.key === "ArrowRight" && (i += r), e.key === "ArrowUp" && (a -= r), e.key === "ArrowDown" && (a += r), t.style.translate = i + "px " + a + "px", this._dirty = !0, this._restartGravity();
	}
	_frame(e) {
		this._raf = requestAnimationFrame(this._frame);
		let t = Math.min((e - this._last) / 1e3, .05);
		if (this._last = e, !this._visible || document.hidden || this._lost) return;
		let n = this.hasAttribute("paused") || this._reduced.matches, r = this._dirty;
		if (n && !r && !this._surfaceDirty) return;
		r && (this._captureDOM(), this._dirty = !1);
		let i = this._solidBodies();
		if (!n) {
			let e = {
				viscosity: b(this, "viscosity", .88),
				stickiness: b(this, "stickiness", .96),
				flow: b(this, "flow", .55),
				emit: this.mode !== "text" && this.hasAttribute("drips"),
				gravity: this._effectiveGravity(),
				drag: this.friction,
				solids: i
			};
			if (this._fluid.gravity = e.gravity, this._thread) {
				if (this._physicsElapsed = Math.min(.05, this._physicsElapsed + t), !this._threadBusy && this._physicsElapsed >= 1 / 90) {
					let t = this._fluidGrab ? {
						x: this._fluidGrab.x,
						y: this._fluidGrab.y,
						generation: this._fluidGrab.generation
					} : null, n = this._threadBuffer;
					this._threadBusy = !0, this._thread.postMessage({
						type: "step",
						dt: this._physicsElapsed,
						options: e,
						pointer: t,
						pour: this._pourPending,
						mask: this._threadMaskDirty ? this._fluid.obstacleMask : null,
						buffer: n
					}, n ? [n] : []), this._threadBuffer = null, this._physicsElapsed = 0, this._pourPending = !1, this._threadMaskDirty = !1;
				}
			} else this._fluid.step(t, {
				...e,
				grab: this._fluidGrab
			}), this._surfaceDirty = !0;
		}
		let a = 1e3 / 60;
		(r || !this._lastSurface || this._surfaceDirty && e - this._lastSurface >= 16.166666666666668) && (this._surface.rebuild(this._fluid.particles, i, this._fluid.spacing, this._fluid.obstacle), this._lastSurface = r || !this._lastSurface ? e : Math.max(this._lastSurface + a, e - a), this._surfaceDirty = !1, this._renderer.render(this._scene, this._camera));
	}
	_startThread() {
		let e = this._threadRevision = (this._threadRevision || 0) + 1;
		if (this._thread?.terminate(), this._thread = null, this._threadBuffer = null, this._threadBusy = !0, this._threadMaskDirty = !0, this._physicsElapsed = 0, this._pourPending = !1, typeof Worker > "u") return;
		let t = (t) => {
			e === this._threadRevision && (this._threadError = t?.message || "Worker unavailable", this._thread?.terminate(), this._thread = null, this._threadBuffer = null, this._fluid.seed(this._seed), this._dirty = !0);
		};
		try {
			this._thread = _({
				...this._fluidOptions,
				gravity: this._effectiveGravity(),
				seed: this._seed
			}, (t) => {
				if (e !== this._threadRevision) return;
				let n = new Float32Array(t.buffer), r = this._fluid.particles;
				for (; r.length < t.count;) r.push({});
				r.length = t.count;
				for (let e = 0; e < t.count; e++) {
					let t = r[e], i = e * 12;
					t.id = n[i], t.x = n[i + 1], t.y = n[i + 2], t.vx = n[i + 3], t.vy = n[i + 4], t.mass = n[i + 5], t.q00 = n[i + 6], t.q01 = n[i + 7], t.q11 = n[i + 8], t.materialX = n[i + 9], t.materialY = n[i + 10], t.attachment = n[i + 11] ? { body: "wet" } : null;
				}
				this._fluid.time = t.time, this._threadBuffer = t.buffer, this._threadBusy = !1, this._surfaceDirty = !0;
			}, t);
		} catch (e) {
			t(e);
		}
	}
	refresh() {
		this._observeTargets(), this._dirty = !0;
	}
	pause() {
		this.setAttribute("paused", ""), this._release();
	}
	play() {
		this.removeAttribute("paused");
	}
	reset() {
		this._release(), this._needsSeed = !0, this._interacted = !1, this._targets?.forEach((e) => {
			e.hasAttribute("data-goo-draggable") && (e.style.translate = "none");
		}), this._lastSurface = 0, this._dirty = !0;
	}
	pour() {
		!this._fluid || this._reduced.matches || this.hasAttribute("paused") || (this._restartGravity(), this._thread ? this._pourPending = !0 : this._fluid.pour());
	}
	setMaterial(e) {
		if (!x[e]) throw RangeError("Unknown material: " + e);
		this.setAttribute("material", e), this.dispatchEvent(new CustomEvent("goo-material-change", {
			detail: { material: e },
			bubbles: !0
		}));
	}
	_destroy() {
		this._threadRevision = (this._threadRevision || 0) + 1, this._thread?.terminate(), this._thread = null, this._threadBuffer = null, cancelAnimationFrame(this._raf), this._abort?.abort(), this._resizeObserver?.disconnect(), this._mutationObserver?.disconnect(), this._intersectionObserver?.disconnect();
		for (let [e, t] of this._hiddenText) e.style.opacity = t.opacity, e.style.pointerEvents = t.pointerEvents;
		this._hiddenText.clear(), this._surface?.geometry.dispose(), this._material?.dispose(), this._pageTexture?.dispose(), this._environment?.dispose(), this._renderer?.dispose(), this._renderer?.domElement.remove(), this._renderer = null, this._surface = null, this._material = null, this._fluid = null, this._fluidOptions = null, this._interacted = !1;
	}
	disconnectedCallback() {
		this._release(), this._destroy();
	}
};
customElements.get("slimey-goo") || customElements.define("slimey-goo", C);
//#endregion
export { C as SlimeyGoo };
