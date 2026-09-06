import solverSource from './liquid-solver.js?raw';

// Embed the solver so the distributed component remains a single module.
// Only numeric snapshots cross the thread boundary; the solver keeps its
// material state and the browser keeps the DOM and WebGL renderer.
export function createFluidThread(options, onState, onError) {
  const program =
    solverSource.replace('export class ViscousFluid', 'class ViscousFluid') +
    '\n(' +
    runFluidThread.toString() +
    ')();';
  const url = URL.createObjectURL(new Blob([program], { type: 'text/javascript' }));
  let worker;
  try {
    worker = new Worker(url, { name: 'slimey-fluid' });
  } finally {
    URL.revokeObjectURL(url);
  }
  worker.onmessage = (event) => {
    if (event.data.error) onError(new Error(event.data.error));
    else onState(event.data);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    onError(new Error(event.message));
  };
  worker.postMessage({ type: 'init', options });
  return worker;
}

function runFluidThread() {
  let fluid,
    grab = null,
    generation = -1;
  const stride = 12;
  self.onmessage = ({ data }) => {
    try {
      if (data.type === 'init') {
        fluid = new ViscousFluid(data.options);
        if (data.options.seed) {
          fluid.seed(data.options.seed);
          fluid.setObstacleMask(data.options.seed.mask, { drape: true });
        }
      } else {
        if (data.mask) fluid.setObstacleMask(data.mask, { drape: true });
        if (data.pour) fluid.pour();
        if (data.pointer) {
          if (data.pointer.generation !== generation) {
            grab = fluid.grab(data.pointer.x, data.pointer.y);
            generation = data.pointer.generation;
          }
          grab.x = data.pointer.x;
          grab.y = data.pointer.y;
        } else {
          grab = null;
          generation = -1;
        }
        if (Number.isFinite(data.options.gravity)) fluid.gravity = data.options.gravity;
        fluid.step(data.dt, { ...data.options, grab });
      }
      const count = fluid.particles.length,
        bytes = fluid.maxParticles * stride * 4;
      const values = new Float32Array(
        data.buffer?.byteLength >= bytes ? data.buffer : new ArrayBuffer(bytes),
      );
      for (let i = 0; i < count; i++) {
        const p = fluid.particles[i],
          j = i * stride;
        values[j] = p.id;
        values[j + 1] = p.x;
        values[j + 2] = p.y;
        values[j + 3] = p.vx;
        values[j + 4] = p.vy;
        values[j + 5] = p.mass;
        values[j + 6] = p.q00;
        values[j + 7] = p.q01;
        values[j + 8] = p.q11;
        values[j + 9] = p.materialX;
        values[j + 10] = p.materialY;
        values[j + 11] = p.attachment ? 1 : 0;
      }
      self.postMessage({ buffer: values.buffer, count, time: fluid.time }, [values.buffer]);
    } catch (error) {
      self.postMessage({ error: error.message });
    }
  };
}
