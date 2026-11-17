import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

const DEFAULT_SOUND_ASSET = require("../../assets/alarm-beep.wav");

class AlarmAudioService {
  constructor() {
    this.player = null;
    this.isInitialized = false;
    this.statusSubscription = null;
    this.previewTimer = null;
    this.currentSource = null;
  }

  async initAudioMode() {
    if (this.isInitialized) return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
      });
      this.isInitialized = true;
    } catch (e) {
      console.warn("[AlarmAudio] setAudioModeAsync notice:", e?.message || e);
    }
  }

  resolveSource(settings) {
    if (settings?.soundType === "custom" && settings?.fileUri) {
      return { uri: settings.fileUri };
    }
    return DEFAULT_SOUND_ASSET;
  }

  async setupPlayer(settings) {
    await this.initAudioMode();
    const source = this.resolveSource(settings);
    this.currentSource = source;

    if (this.player) {
      try {
        this.player.replace(source);
        return;
      } catch (e) {
        console.warn("[AlarmAudio] replace failed, recreating player:", e?.message || e);
        try {
          this.player.remove();
        } catch {}
        this.player = null;
      }
    }

    try {
      this.player = createAudioPlayer(source);
    } catch (e) {
      console.error("[AlarmAudio] createAudioPlayer failed:", e?.message || e);
    }
  }

  async playAlarm(settings) {
    try {
      await this.initAudioMode();
      if (!this.player) {
        await this.setupPlayer(settings);
      }
      if (this.player) {
        this.player.loop = true;
        this.player.volume = 1.0;
        await this.player.seekTo(0).catch(() => {});
        this.player.play();
      }
    } catch (e) {
      console.error("[AlarmAudio] playAlarm error:", e?.message || e);
    }
  }

  async stopAlarm() {
    try {
      if (this.player) {
        this.player.pause();
        await this.player.seekTo(0).catch(() => {});
      }
    } catch (e) {
      console.warn("[AlarmAudio] stopAlarm notice:", e?.message || e);
    }
  }

  async playPreview(settings, onFinished) {
    try {
      await this.initAudioMode();
      if (!this.player) {
        await this.setupPlayer(settings);
      }
      if (!this.player) {
        if (onFinished) onFinished();
        return;
      }

      this.stopPreview();

      this.player.loop = false;
      this.player.volume = 1.0;
      await this.player.seekTo(0).catch(() => {});

      if (typeof this.player.addListener === "function") {
        this.statusSubscription = this.player.addListener(
          "playbackStatusUpdate",
          (status) => {
            if (status?.didJustFinish) {
              this.stopPreview();
              if (onFinished) onFinished();
            }
          }
        );
      }

      // Safety timeout: stop preview after 5 seconds if not already ended
      this.previewTimer = setTimeout(() => {
        this.stopPreview();
        if (onFinished) onFinished();
      }, 5000);

      this.player.play();
    } catch (e) {
      console.error("[AlarmAudio] playPreview error:", e?.message || e);
      if (onFinished) onFinished();
    }
  }

  stopPreview() {
    if (this.statusSubscription) {
      try {
        this.statusSubscription.remove();
      } catch {}
      this.statusSubscription = null;
    }
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.player) {
      try {
        this.player.pause();
        this.player.seekTo(0).catch(() => {});
      } catch {}
    }
  }

  cleanup() {
    this.stopPreview();
    if (this.player) {
      try {
        this.player.remove();
      } catch {}
      this.player = null;
    }
  }
}

export const alarmAudioService = new AlarmAudioService();

