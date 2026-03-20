import { Howl, Howler } from "howler";

export type SfxName =
  | "select"
  | "confirm"
  | "cancel"
  | "openBooster"
  | "rarityCommon"
  | "rarityRare"
  | "rarityEpic"
  | "rarityLegendary";

const SFX_PATHS: Record<SfxName, string> = {
  select: "/sounds/sfx/select.mp3",
  confirm: "/sounds/sfx/confirm.mp3",
  cancel: "/sounds/sfx/cancel.mp3",
  openBooster: "/sounds/sfx/open-booster.mp3",
  rarityCommon: "/sounds/sfx/rarity-common.mp3",
  rarityRare: "/sounds/sfx/rarity-rare.mp3",
  rarityEpic: "/sounds/sfx/rarity-epic.mp3",
  rarityLegendary: "/sounds/sfx/rarity-legendary.mp3",
};

const BGM_PATH = "/sounds/bgm/main-theme.mp3";

const LS_VOLUME_MASTER = "pipou_volume_master";
const LS_VOLUME_BGM = "pipou_volume_bgm";
const LS_VOLUME_SFX = "pipou_volume_sfx";
const LS_MUTED = "pipou_muted";
const LS_BGM_MUTED = "pipou_bgm_muted";
const LS_SFX_MUTED = "pipou_sfx_muted";

class SoundService {
  private bgm: Howl | null = null;
  private sfxCache: Partial<Record<SfxName, Howl>> = {};

  private _masterVolume: number;
  private _bgmVolume: number;
  private _sfxVolume: number;
  private _muted: boolean;
  private _bgmMuted: boolean;
  private _sfxMuted: boolean;
  private _bgmStarted = false;

  constructor() {
    this._masterVolume = parseFloat(
      localStorage.getItem(LS_VOLUME_MASTER) ?? "0.8",
    );
    this._bgmVolume = parseFloat(localStorage.getItem(LS_VOLUME_BGM) ?? "0.5");
    this._sfxVolume = parseFloat(localStorage.getItem(LS_VOLUME_SFX) ?? "0.8");
    this._muted = localStorage.getItem(LS_MUTED) === "true";
    this._bgmMuted = localStorage.getItem(LS_BGM_MUTED) === "true";
    this._sfxMuted = localStorage.getItem(LS_SFX_MUTED) === "true";

    this._initBgm();
    this._listenForFirstInteraction();
  }

  private _initBgm() {
    this.bgm = new Howl({
      src: [BGM_PATH],
      loop: true,
      volume: this._bgmEffectiveVolume(),
      html5: true,
    });
  }

  private _listenForFirstInteraction() {
    const start = () => {
      if (!this._bgmStarted) {
        this._bgmStarted = true;
        this.bgm?.play();
      }
      window.removeEventListener("click", start);
      window.removeEventListener("keydown", start);
      window.removeEventListener("touchstart", start);
    };
    window.addEventListener("click", start);
    window.addEventListener("keydown", start);
    window.addEventListener("touchstart", start);
  }

  private _bgmEffectiveVolume(): number {
    if (this._muted || this._bgmMuted) return 0;
    return this._masterVolume * this._bgmVolume;
  }

  private _sfxEffectiveVolume(): number {
    if (this._muted || this._sfxMuted) return 0;
    return this._masterVolume * this._sfxVolume;
  }

  private _getSfx(name: SfxName): Howl {
    if (!this.sfxCache[name]) {
      this.sfxCache[name] = new Howl({
        src: [SFX_PATHS[name]],
        volume: this._sfxEffectiveVolume(),
      });
    }
    return this.sfxCache[name]!;
  }

  play(name: SfxName) {
    if (this._muted || this._sfxMuted) return;
    this._getSfx(name).play();
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  get masterVolume() {
    return this._masterVolume;
  }
  get bgmVolume() {
    return this._bgmVolume;
  }
  get sfxVolume() {
    return this._sfxVolume;
  }
  get muted() {
    return this._muted;
  }
  get bgmMuted() {
    return this._bgmMuted;
  }
  get sfxMuted() {
    return this._sfxMuted;
  }

  // ── Setters volume ────────────────────────────────────────────────────────
  setMasterVolume(v: number) {
    this._masterVolume = v;
    localStorage.setItem(LS_VOLUME_MASTER, String(v));
    this._applyVolumes();
  }

  setBgmVolume(v: number) {
    this._bgmVolume = v;
    localStorage.setItem(LS_VOLUME_BGM, String(v));
    this._applyVolumes();
  }

  setSfxVolume(v: number) {
    this._sfxVolume = v;
    localStorage.setItem(LS_VOLUME_SFX, String(v));
    this._applyVolumes();
  }

  // ── Toggles mute ──────────────────────────────────────────────────────────
  toggleMute() {
    this._muted = !this._muted;
    localStorage.setItem(LS_MUTED, String(this._muted));
    this._applyVolumes();
  }

  toggleBgmMute() {
    this._bgmMuted = !this._bgmMuted;
    localStorage.setItem(LS_BGM_MUTED, String(this._bgmMuted));
    this._applyVolumes();
  }

  toggleSfxMute() {
    this._sfxMuted = !this._sfxMuted;
    localStorage.setItem(LS_SFX_MUTED, String(this._sfxMuted));
    this._applyVolumes();
  }

  private _applyVolumes() {
    this.bgm?.volume(this._bgmEffectiveVolume());
    Howler.volume(this._muted ? 0 : this._masterVolume);
    Object.values(this.sfxCache).forEach((sfx) =>
      sfx?.volume(this._sfxEffectiveVolume()),
    );
  }
}

export const soundService = new SoundService();
