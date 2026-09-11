// ─────────────────────────────────────────────────────────────────────────────
// WORKOUTS — plucked-string synth
// ─────────────────────────────────────────────────────────────────────────────
//
// Plays the tab back so a member can hear the piece while the metronome runs.
// Karplus-Strong on the metronome's own AudioContext, so every note is
// scheduled on the same clock as the click and lands exactly on it. No samples,
// no network: a short burst of noise fed through a one-period delay with a
// two-point average is what a plucked string sounds like, and it is cheap
// enough to render a fresh buffer per note at schedule time.
//
//   pluck(ctx, midi, when, seconds, volume)
//   strum(ctx, midis, when, seconds, volume)   // chord, tiny stagger per note
// ─────────────────────────────────────────────────────────────────────────────

const RELEASE_SEC = 0.35;     // tail after the written length
const MAX_SEC = 3.5;
const LOOP_DECAY = 0.994;     // per period; high notes die sooner in time, like strings do

const cache = new Map();      // `${midi}:${seconds}` -> AudioBuffer
let busCtx = null;
let bus = null;
let masterVolume = 1;
export function setOriginalVolume(value) {
  masterVolume=value;
  if(bus && busCtx)bus.gain.setTargetAtTime(1.2*value,busCtx.currentTime,0.015);
}

function getBus(ctx) {
  if (busCtx !== ctx) {
    bus = ctx.createGain();
    bus.gain.value = 1.2 * masterVolume;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 5200;
    tone.Q.value = 0.5;
    bus.connect(tone).connect(ctx.destination);
    busCtx = ctx;
  }
  return bus;
}

function midiToHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

function render(ctx, midi, seconds) {
  const key = ctx.sampleRate + ":" + midi + ":" + seconds.toFixed(3);
  const hit = cache.get(key);
  if (hit) return hit;

  const sr = ctx.sampleRate;
  const period = Math.max(2, Math.round(sr / midiToHz(midi)));
  const length = Math.ceil(sr * seconds);
  const buffer = ctx.createBuffer(1, length, sr);
  const out = buffer.getChannelData(0);

  // Excitation: white noise, softened once so the attack is a pick, not a click.
  const ring = new Float32Array(period);
  let last = 0;
  for (let i = 0; i < period; i++) {
    const r = Math.random() * 2 - 1;
    ring[i] = (r + last) * 0.5;
    last = r;
  }

  let prev = 0;
  const fadeStart = Math.max(0, length - Math.round(sr * 0.04));
  for (let n = 0; n < length; n++) {
    const slot = n % period;
    const cur = ring[slot];
    const y = LOOP_DECAY * 0.5 * (cur + prev);
    ring[slot] = y;
    prev = cur;
    out[n] = n >= fadeStart ? y * (length - n) / (length - fadeStart) : y;
  }

  if (cache.size > 400) cache.clear();
  cache.set(key, buffer);
  return buffer;
}

export function pluck(ctx, midi, when, seconds, volume = 0.5, options = {}) {
  if (!ctx) return;
  const total = Math.min(MAX_SEC, options.tight ? Math.max(.004,seconds)+.01 : Math.max(0.15, seconds) + RELEASE_SEC);
  const src = ctx.createBufferSource();
  src.buffer = render(ctx, midi, total);
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(getBus(ctx));
  src.onended = () => {src.disconnect();gain.disconnect();};
  src.start(when);
  return src;
}

export function strum(ctx, midis, when, seconds, volume = 0.5) {
  midis.forEach((m, i) => pluck(ctx, m, when + i * 0.012, seconds, volume));
}
