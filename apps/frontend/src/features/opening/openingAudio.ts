import { soundService, type SfxName } from "../../services/sound.service";

const STEP_FREQS = [262, 330, 392, 523, 659, 784] as const;

let ctx: AudioContext | null = null;

/** Crée le contexte au premier appel (jamais à l'import). Null si indisponible. */
function getContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof AudioContext === "undefined") return null;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  return ctx;
}

function playTone(
  type: OscillatorType,
  freq: number,
  peak: number,
  duration: number,
) {
  const volume = soundService.sfxVolume01();
  if (volume <= 0) return;
  const c = getContext();
  if (!c) return;
  void c.resume?.();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(peak * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + duration);
}

export const openingAudio = {
  /** Bruit filtré bref ; speed entre 0 et 1. */
  tear(speed: number) {
    const volume = soundService.sfxVolume01();
    if (volume <= 0) return;
    const c = getContext();
    if (!c) return;
    void c.resume?.();
    const s = Math.min(1, Math.max(0, speed));
    const duration = 0.05;
    const t = c.currentTime;
    const length = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2200 + s * 2500;
    const gain = c.createGain();
    gain.gain.setValueAtTime((0.12 + s * 0.25) * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(t);
    src.stop(t + duration);
  },

  /** Note de palier ; step entre 0 et 5. */
  stepNote(step: number) {
    const i = Math.min(STEP_FREQS.length - 1, Math.max(0, Math.round(step)));
    playTone("triangle", STEP_FREQS[i], 0.2, 0.35);
  },

  rumble() {
    playTone("sawtooth", 45, 0.25, 0.8);
  },

  bass() {
    playTone("sine", 58, 0.5, 0.7);
  },

  dispose() {
    const c = ctx;
    ctx = null;
    if (c) void c.close?.();
  },
};

const RARITY_SOUND: Record<string, SfxName> = {
  common: "rarityCommon",
  uncommon: "rarityCommon",
  rare: "rarityRare",
  epic: "rarityEpic",
  legendary: "rarityLegendary",
  secret: "rarityLegendary",
};

export function playRaritySound(rarity: string) {
  soundService.play(RARITY_SOUND[rarity.toLowerCase()] ?? "rarityCommon");
}
