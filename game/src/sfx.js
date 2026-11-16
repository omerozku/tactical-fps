export function createSfx() {
  let ctx = null;
  let master = null;
  let noise = null;
  let muted = false;

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.42;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 16;
      comp.ratio.value = 8;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseBuffer() {
    if (noise) return noise;
    const c = ensure();
    if (!c) return null;
    const length = Math.floor(c.sampleRate * 1.6);
    noise = c.createBuffer(1, length, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  }

  function panner(pan) {
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      return p;
    }
    return ctx.createGain();
  }

  function burst(duration, cutoff, volume, pan, q = 1) {
    const c = ensure();
    if (!c) return;
    const buffer = noiseBuffer();
    if (!buffer) return;
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = q;
    const gain = c.createGain();
    const now = c.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    const route = panner(pan);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(route);
    route.connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  function tone(frequency, duration, volume, type = 'sine', pan = 0, slideTo = 0) {
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    const now = c.currentTime;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    const route = panner(pan);
    osc.connect(gain);
    gain.connect(route);
    route.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function fire(kind, volume = 1, pan = 0) {
    ensure();
    if (!ctx) return;
    if (kind === 'sniper') {
      burst(0.3, 900, 0.74 * volume, pan, 0.7);
      tone(95, 0.28, 0.5 * volume, 'triangle', pan, 42);
    } else if (kind === 'shotgun') {
      burst(0.28, 700, 0.85 * volume, pan, 0.5);
      tone(70, 0.24, 0.55 * volume, 'square', pan, 36);
    } else if (kind === 'pistol') {
      burst(0.14, 1500, 0.5 * volume, pan, 1.1);
      tone(150, 0.11, 0.26 * volume, 'triangle', pan, 70);
    } else {
      burst(0.12, 1900, 0.48 * volume, pan, 0.9);
      tone(120, 0.1, 0.22 * volume, 'square', pan, 60);
    }
  }

  function empty() {
    tone(640, 0.035, 0.12, 'square', 0, 260);
  }

  function reload() {
    tone(380, 0.035, 0.1, 'square');
    setTimeout(() => tone(520, 0.045, 0.09, 'square'), 130);
    setTimeout(() => tone(300, 0.04, 0.08, 'square'), 260);
  }

  function hit(head) {
    tone(head ? 1180 : 760, head ? 0.09 : 0.05, head ? 0.2 : 0.12, 'sine', 0, head ? 1540 : 620);
  }

  function damage() {
    burst(0.16, 420, 0.22, 0, 0.6);
    tone(90, 0.16, 0.24, 'sine', 0, 55);
  }

  function beep(frequency = 880, volume = 0.13, duration = 0.07) {
    tone(frequency, duration, volume, 'square');
  }

  function explosion() {
    burst(0.65, 280, 0.9, 0, 0.4);
    tone(65, 0.6, 0.65, 'sine', 0, 24);
    setTimeout(() => burst(0.32, 700, 0.34, 0, 0.5), 60);
  }

  function roundEnd(win) {
    ensure();
    if (!ctx) return;
    const base = win ? 392 : 220;
    tone(base, 0.28, 0.16, 'triangle');
    setTimeout(() => tone(win ? 523 : 196, 0.3, 0.14, 'triangle'), 120);
    setTimeout(() => tone(win ? 659 : 164, 0.42, 0.13, 'triangle'), 240);
  }

  function grenadeBounce(volume = 0.08) {
    tone(320, 0.045, volume, 'square', 0, 240);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.42;
    return muted;
  }

  return { unlock: ensure, fire, empty, reload, hit, damage, beep, explosion, roundEnd, grenadeBounce, toggleMute };
}
