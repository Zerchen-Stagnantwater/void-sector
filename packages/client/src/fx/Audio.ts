// ============================================
//   Audio.ts
//   Procedural sound via Web Audio API.
//   Zero audio files — all synthesized.
// ============================================

import { load, set } from '../core/save.js';

let ctx:        AudioContext | null = null;
let masterGain: GainNode    | null = null;
let sfxGain:    GainNode    | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx        = new AudioContext();
    masterGain = ctx.createGain();
    sfxGain    = ctx.createGain();
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    const save          = load();
    masterGain.gain.value = save.masterVolume;
    sfxGain.gain.value    = save.sfxVolume;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// ---------- Synth helpers ----------

interface OscOpts {
  type?:     OscillatorType;
  freq?:     number;
  endFreq?:  number;
  duration?: number;
  volume?:   number;
  delay?:    number;
}

function osc({
  type = 'square', freq = 440, endFreq,
  duration = 0.1, volume = 0.3, delay = 0,
}: OscOpts = {}): void {
  const c   = getCtx();
  const now = c.currentTime + delay;

  const o = c.createOscillator();
  const g = c.createGain();

  o.type = type;
  o.frequency.setValueAtTime(freq, now);
  if (endFreq != null) {
    o.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  }

  g.gain.setValueAtTime(volume, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  o.connect(g);
  g.connect(sfxGain!);
  o.start(now);
  o.stop(now + duration + 0.01);
}

interface NoiseOpts {
  duration?: number;
  volume?:   number;
  delay?:    number;
}

function noise({ duration = 0.15, volume = 0.4, delay = 0 }: NoiseOpts = {}): void {
  const c          = getCtx();
  const now        = c.currentTime + delay;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer     = c.createBuffer(1, bufferSize, c.sampleRate);
  const data       = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = c.createBufferSource();
  source.buffer = buffer;

  const g = c.createGain();
  g.gain.setValueAtTime(volume, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const filter = c.createBiquadFilter();
  filter.type            = 'highpass';
  filter.frequency.value = 800;

  source.connect(filter);
  filter.connect(g);
  g.connect(sfxGain!);
  source.start(now);
}

// ---------- Sound definitions ----------

type SoundName = keyof typeof SOUNDS;

const SOUNDS = {
  shoot()       { osc({ type:'square', freq:880, endFreq:440, duration:0.06, volume:0.18 }); },
  shootSpread() {
    osc({ type:'square', freq:660, endFreq:330, duration:0.07, volume:0.14, delay:0.00 });
    osc({ type:'square', freq:880, endFreq:440, duration:0.07, volume:0.14, delay:0.02 });
    osc({ type:'square', freq:550, endFreq:275, duration:0.07, volume:0.14, delay:0.04 });
  },
  enemyHit()    { osc({ type:'square', freq:200, endFreq:100, duration:0.08, volume:0.22 }); },
  enemyDie()    { noise({ duration:0.12, volume:0.30 }); osc({ type:'sawtooth', freq:150, endFreq:50, duration:0.15, volume:0.20 }); },
  playerHit()   { noise({ duration:0.20, volume:0.50 }); osc({ type:'sawtooth', freq:120, endFreq:40, duration:0.25, volume:0.35 }); },
  playerDie()   {
    noise({ duration:0.5, volume:0.6 });
    osc({ type:'sawtooth', freq:200, endFreq:30, duration:0.6, volume:0.4 });
    osc({ type:'square',   freq:100, endFreq:20, duration:0.8, volume:0.3, delay:0.1 });
  },
  pickup()      {
    osc({ type:'sine', freq:660,  duration:0.08, volume:0.25 });
    osc({ type:'sine', freq:880,  duration:0.08, volume:0.25, delay:0.08 });
    osc({ type:'sine', freq:1100, duration:0.12, volume:0.25, delay:0.16 });
  },
  shieldHit()   { osc({ type:'sine', freq:440, endFreq:880, duration:0.15, volume:0.30 }); noise({ duration:0.08, volume:0.15 }); },
  roll()        { osc({ type:'sine', freq:300, endFreq:600, duration:0.12, volume:0.20 }); },
  waveStart()   {
    osc({ type:'square', freq:220, duration:0.10, volume:0.25, delay:0.00 });
    osc({ type:'square', freq:330, duration:0.10, volume:0.25, delay:0.12 });
    osc({ type:'square', freq:440, duration:0.15, volume:0.30, delay:0.24 });
  },
  waveClear()   {
    osc({ type:'sine', freq:440, duration:0.10, volume:0.28, delay:0.00 });
    osc({ type:'sine', freq:550, duration:0.10, volume:0.28, delay:0.10 });
    osc({ type:'sine', freq:660, duration:0.10, volume:0.28, delay:0.20 });
    osc({ type:'sine', freq:880, duration:0.20, volume:0.35, delay:0.30 });
  },
  menuMove()    { osc({ type:'square', freq:440, duration:0.05, volume:0.15 }); },
  menuConfirm() {
    osc({ type:'square', freq:660, duration:0.08, volume:0.22 });
    osc({ type:'square', freq:880, duration:0.10, volume:0.22, delay:0.08 });
  },
  bomb()        { noise({ duration:0.6, volume:0.7 }); osc({ type:'sawtooth', freq:80, endFreq:20, duration:0.8, volume:0.5 }); },
  highScore()   { [440,550,660,770,880,1100].forEach((f,i) => osc({ type:'sine', freq:f, duration:0.12, volume:0.28, delay:i*0.10 })); },
  shopBuy()     {
    osc({ type:'sine', freq:550, duration:0.08, volume:0.22 });
    osc({ type:'sine', freq:770, duration:0.12, volume:0.28, delay:0.08 });
  },
  shopDeny()    {
    osc({ type:'square', freq:180, duration:0.15, volume:0.22 });
    osc({ type:'square', freq:120, duration:0.15, volume:0.22, delay:0.10 });
  },
} as const;

// ---------- Public ----------

export function play(name: SoundName): void {
  try { SOUNDS[name](); } catch (e) { console.warn('[Audio]', e); }
}

export function unlock(): void { getCtx(); }

export function setMasterVolume(v: number): void {
  getCtx();
  masterGain!.gain.value = Math.max(0, Math.min(1, v));
  set('masterVolume', masterGain!.gain.value);
}

export function setSfxVolume(v: number): void {
  getCtx();
  sfxGain!.gain.value = Math.max(0, Math.min(1, v));
  set('sfxVolume', sfxGain!.gain.value);
}
