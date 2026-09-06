import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker as NodeWorker } from 'node:worker_threads';
import { ViscousFluid } from '../src/liquid-solver.js';

// Exercise the actual embedded program in a separate thread. This small
// adapter provides browser message events around Node's worker transport.
class BrowserWorker {
  constructor(url) {
    this.ready = fetch(url)
      .then((r) => r.text())
      .then((source) => {
        const worker = new NodeWorker(
          `const {parentPort}=require('node:worker_threads');
        global.self={postMessage:(value,transfer)=>parentPort.postMessage(value,transfer)};
        parentPort.on('message',data=>self.onmessage({data}));\n${source}`,
          { eval: true },
        );
        worker.on('message', (data) => this.onmessage?.({ data }));
        worker.on('error', (error) =>
          this.onerror?.({ message: error.message, preventDefault() {} }),
        );
        return worker;
      });
  }
  postMessage(data, transfer) {
    this.ready.then((worker) => worker.postMessage(data, transfer));
  }
  terminate() {
    return this.ready.then((worker) => worker.terminate());
  }
}

test(
  'embedded worker preserves solver behavior and recycles transferred snapshots',
  { timeout: 15000 },
  async () => {
    const solver = await readFile(new URL('../src/liquid-solver.js', import.meta.url), 'utf8');
    const source = (
      await readFile(new URL('../src/liquid-thread.js', import.meta.url), 'utf8')
    ).replace(
      /^import solverSource.*\r?\n/,
      'const solverSource=' + JSON.stringify(solver) + ';\n',
    );
    const { createFluidThread } = await import(
      'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
    );
    const previous = globalThis.Worker;
    globalThis.Worker = BrowserWorker;
    let pending, worker;
    const next = () =>
      new Promise((resolve, reject) => {
        pending = { resolve, reject };
      });
    try {
      const config = { cellSize: 0.16, maxParticles: 8000 },
        reference = new ViscousFluid(config);
      const initial = next();
      worker = createFluidThread(
        config,
        (data) => pending.resolve(data),
        (error) => pending.reject(error),
      );
      let state = await initial;
      assert.equal(state.count, reference.particles.length);
      const options = { viscosity: 0.88, stickiness: 0.85, flow: 0.55, emit: false, solids: [] };
      const grab = reference.grab(0.8, -1.3);
      for (let step = 0; step < 12; step++) {
        const pointer = step < 8 ? { x: 0.8 + step * 0.08, y: -1.3, generation: 1 } : null;
        if (pointer) {
          grab.x = pointer.x;
          grab.y = pointer.y;
        }
        reference.step(1 / 30, { ...options, grab: pointer ? grab : null });
        const response = next(),
          buffer = state.buffer;
        worker.postMessage({ type: 'step', dt: 1 / 30, options, pointer, buffer }, [buffer]);
        state = await response;
        assert.equal(buffer.byteLength, 0, 'sent snapshot ownership is transferred back');
        assert.equal(state.count, reference.particles.length);
        assert.equal(state.time, reference.time);
        const values = new Float32Array(state.buffer);
        for (let i = 0; i < state.count; i++) {
          const p = reference.particles[i],
            j = i * 12;
          assert.equal(values[j], p.id);
          assert.equal(values[j + 1], Math.fround(p.x));
          assert.equal(values[j + 2], Math.fround(p.y));
          assert.equal(values[j + 5], Math.fround(p.mass));
          assert.equal(values[j + 6], Math.fround(p.q00));
        }
      }
    } finally {
      await worker?.terminate();
      if (previous === undefined) delete globalThis.Worker;
      else globalThis.Worker = previous;
    }
  },
);
