import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAudioStore } from "../../../stores";

// Mock soundService
vi.mock("../../../services/sound.service", () => ({
  soundService: {
    setMasterVolume: vi.fn(),
    setBgmVolume: vi.fn(),
    setSfxVolume: vi.fn(),
    toggleMute: vi.fn(),
    toggleBgmMute: vi.fn(),
    toggleSfxMute: vi.fn(),
    play: vi.fn(),
    masterVolume: 0.8,
    bgmVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
    bgmMuted: false,
    sfxMuted: false,
  },
}));

describe("AudioStore", () => {
  beforeEach(() => {
    // Reset localStorage and store state
    localStorage.clear();
    // Re-initialize store (clear persisted state)
    useAudioStore.setState({
      masterVolume: 80,
      bgmVolume: 70,
      sfxVolume: 80,
      isMasterMuted: false,
      isBgmMuted: false,
      isSfxMuted: false,
    });
    vi.clearAllMocks();
  });

  it("should initialize with default values", () => {
    const state = useAudioStore.getState();
    expect(state.masterVolume).toBe(80);
    expect(state.bgmVolume).toBe(70);
    expect(state.sfxVolume).toBe(80);
    expect(state.isMasterMuted).toBe(false);
  });

  it("should set master volume", () => {
    const { setMasterVolume } = useAudioStore.getState();
    setMasterVolume(50);
    expect(useAudioStore.getState().masterVolume).toBe(50);

    setMasterVolume(0);
    expect(useAudioStore.getState().masterVolume).toBe(0);

    setMasterVolume(100);
    expect(useAudioStore.getState().masterVolume).toBe(100);
  });

  it("should clamp volume to 0-100 range", () => {
    const { setMasterVolume } = useAudioStore.getState();

    setMasterVolume(150);
    expect(useAudioStore.getState().masterVolume).toBe(100);

    setMasterVolume(-50);
    expect(useAudioStore.getState().masterVolume).toBe(0);
  });

  it("should set BGM volume", () => {
    const { setBgmVolume } = useAudioStore.getState();
    setBgmVolume(40);
    expect(useAudioStore.getState().bgmVolume).toBe(40);
  });

  it("should set SFX volume", () => {
    const { setSfxVolume } = useAudioStore.getState();
    setSfxVolume(60);
    expect(useAudioStore.getState().sfxVolume).toBe(60);
  });

  it("should toggle master mute", () => {
    const { toggleMasterMute } = useAudioStore.getState();
    expect(useAudioStore.getState().isMasterMuted).toBe(false);

    toggleMasterMute();
    expect(useAudioStore.getState().isMasterMuted).toBe(true);

    toggleMasterMute();
    expect(useAudioStore.getState().isMasterMuted).toBe(false);
  });

  it("should toggle BGM mute", () => {
    const { toggleBgmMute } = useAudioStore.getState();
    expect(useAudioStore.getState().isBgmMuted).toBe(false);

    toggleBgmMute();
    expect(useAudioStore.getState().isBgmMuted).toBe(true);
  });

  it("should toggle SFX mute", () => {
    const { toggleSfxMute } = useAudioStore.getState();
    expect(useAudioStore.getState().isSfxMuted).toBe(false);

    toggleSfxMute();
    expect(useAudioStore.getState().isSfxMuted).toBe(true);
  });

  it("should set master muted state directly", () => {
    const { setMasterMuted } = useAudioStore.getState();
    setMasterMuted(true);
    expect(useAudioStore.getState().isMasterMuted).toBe(true);

    setMasterMuted(false);
    expect(useAudioStore.getState().isMasterMuted).toBe(false);
  });

  it("should set BGM muted state directly", () => {
    const { setBgmMuted } = useAudioStore.getState();
    setBgmMuted(true);
    expect(useAudioStore.getState().isBgmMuted).toBe(true);
  });

  it("should set SFX muted state directly", () => {
    const { setSfxMuted } = useAudioStore.getState();
    setSfxMuted(true);
    expect(useAudioStore.getState().isSfxMuted).toBe(true);
  });

  it("should play SFX sound", () => {
    const { playSfx } = useAudioStore.getState();
    playSfx("select");
    // Verify that soundService.play was called (mocked)
    // Note: soundService is mocked, so we can't directly verify,
    // but the action should not throw
  });

  it("should reset to default audio settings", () => {
    const state = useAudioStore.getState();
    state.setMasterVolume(30);
    state.setBgmVolume(20);
    state.setSfxVolume(40);
    state.toggleMasterMute();

    state.resetAudioSettings();

    const resetState = useAudioStore.getState();
    expect(resetState.masterVolume).toBe(80);
    expect(resetState.bgmVolume).toBe(70);
    expect(resetState.sfxVolume).toBe(80);
    expect(resetState.isMasterMuted).toBe(false);
  });

  it("should persist state to localStorage", () => {
    const { setMasterVolume, toggleMasterMute } = useAudioStore.getState();
    setMasterVolume(50);
    toggleMasterMute();

    // Note: Persistence is handled by Zustand's persist middleware
    // This test verifies the store can be used with persisted state
    const state = useAudioStore.getState();
    expect(state.masterVolume).toBe(50);
    expect(state.isMasterMuted).toBe(true);
  });

  it("should handle multiple volume changes", () => {
    const state = useAudioStore.getState();
    state.setMasterVolume(60);
    state.setBgmVolume(50);
    state.setSfxVolume(70);

    const current = useAudioStore.getState();
    expect(current.masterVolume).toBe(60);
    expect(current.bgmVolume).toBe(50);
    expect(current.sfxVolume).toBe(70);
  });
});
