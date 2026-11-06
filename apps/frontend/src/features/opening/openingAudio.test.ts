import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sfxVolume01 = vi.fn((): number => 0);
const play = vi.fn();

vi.mock("../../services/sound.service", () => ({
  soundService: {
    sfxVolume01: () => sfxVolume01(),
    play: (name: string) => play(name),
  },
}));

import { openingAudio, playRaritySound } from "./openingAudio";

interface FakeGain {
  gain: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
}

let created: { oscillators: number; sources: number; gains: FakeGain[] };
let contextCount: number;
let closeSpy: ReturnType<typeof vi.fn>;

function makeParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function installFakeAudioContext() {
  class FakeAudioContext {
    currentTime = 0;
    sampleRate = 44100;
    state = "running";
    destination = {};
    constructor() {
      contextCount += 1;
    }
    resume = vi.fn();
    close = closeSpy;
    createOscillator() {
      created.oscillators += 1;
      return {
        type: "sine",
        frequency: makeParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }
    createGain(): FakeGain {
      const g = { gain: makeParam(), connect: vi.fn() };
      created.gains.push(g);
      return g;
    }
    createBiquadFilter() {
      return { type: "bandpass", frequency: makeParam(), Q: makeParam(), connect: vi.fn() };
    }
    createBuffer(_c: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      created.sources += 1;
      return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
}

beforeEach(() => {
  created = { oscillators: 0, sources: 0, gains: [] };
  contextCount = 0;
  closeSpy = vi.fn();
  sfxVolume01.mockReturnValue(0.5);
  play.mockClear();
  installFakeAudioContext();
});

afterEach(() => {
  openingAudio.dispose();
  vi.unstubAllGlobals();
});

describe("openingAudio", () => {
  it("ne crée aucune source quand le volume est 0", () => {
    sfxVolume01.mockReturnValue(0);
    openingAudio.tear(0.5);
    openingAudio.stepNote(2);
    openingAudio.rumble();
    openingAudio.bass();
    expect(created.oscillators).toBe(0);
    expect(created.sources).toBe(0);
  });

  it("crée une source de bruit pour la déchirure", () => {
    openingAudio.tear(0.5);
    expect(created.sources).toBe(1);
  });

  it("crée un oscillateur par note, grondement et basse", () => {
    openingAudio.stepNote(0);
    openingAudio.rumble();
    openingAudio.bass();
    expect(created.oscillators).toBe(3);
  });

  it("multiplie le gain par le volume", () => {
    openingAudio.tear(1);
    const peak = created.gains[0].gain.setValueAtTime.mock.calls[0][0] as number;
    expect(peak).toBeCloseTo((0.12 + 0.25) * 0.5);
  });

  it("réutilise un seul AudioContext, créé paresseusement", () => {
    expect(contextCount).toBe(0);
    openingAudio.stepNote(1);
    openingAudio.stepNote(2);
    expect(contextCount).toBe(1);
  });

  it("dispose ferme le contexte", () => {
    openingAudio.stepNote(1);
    openingAudio.dispose();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("ne lève pas sans AudioContext", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => {
      openingAudio.tear(0.3);
      openingAudio.stepNote(0);
      openingAudio.rumble();
      openingAudio.bass();
      openingAudio.dispose();
    }).not.toThrow();
  });
});

describe("playRaritySound", () => {
  it.each([
    ["common", "rarityCommon"],
    ["uncommon", "rarityCommon"],
    ["rare", "rarityRare"],
    ["epic", "rarityEpic"],
    ["legendary", "rarityLegendary"],
    ["secret", "rarityLegendary"],
  ])("%s joue %s", (rarity, sound) => {
    playRaritySound(rarity);
    expect(play).toHaveBeenCalledWith(sound);
  });
});
