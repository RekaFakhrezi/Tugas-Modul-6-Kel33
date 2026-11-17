import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  DEFAULT_ALARM_SETTINGS,
  loadAlarmSettings,
  persistCustomAudioFile,
  removeAudioFile,
  saveAlarmSettings,
} from "../services/alarmStorage.js";
import { alarmAudioService } from "../services/alarmAudio.js";

const AlarmContext = createContext(null);

export function AlarmProvider({ children }) {
  const [alarmSettings, setAlarmSettings] = useState(DEFAULT_ALARM_SETTINGS);
  const [isAlarmTriggered, setIsAlarmTriggered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [picking, setPicking] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const settingsRef = useRef(alarmSettings);
  settingsRef.current = alarmSettings;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const isTriggeredRef = useRef(isAlarmTriggered);
  isTriggeredRef.current = isAlarmTriggered;

  // Load persisted settings on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await loadAlarmSettings();
      if (mounted) {
        setAlarmSettings(saved);
        alarmAudioService.setupPlayer(saved);
      }
    })();
    return () => {
      mounted = false;
      alarmAudioService.cleanup();
    };
  }, []);

  const commitSettings = useCallback(async (newSettings) => {
    setAlarmSettings(newSettings);
    await saveAlarmSettings(newSettings);
    await alarmAudioService.setupPlayer(newSettings);
  }, []);

  const toggleAlarmEnabled = useCallback(
    async (nextEnabled) => {
      const updated = {
        ...settingsRef.current,
        enabled: nextEnabled,
      };
      await commitSettings(updated);

      if (!nextEnabled) {
        alarmAudioService.stopAlarm();
        setIsPlaying(false);
      } else if (isTriggeredRef.current && !isMutedRef.current) {
        alarmAudioService.playAlarm(updated);
        setIsPlaying(true);
      }
    },
    [commitSettings]
  );

  const pickCustomSound = useCallback(async () => {
    setPicking(true);
    setFeedback(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav", "audio/x-m4a"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const oldUri = settingsRef.current.fileUri;

        // Persist picked file in document directory
        const permanentUri = await persistCustomAudioFile(asset.uri, asset.name);

        // Remove previous custom file if different
        if (oldUri && oldUri !== permanentUri) {
          await removeAudioFile(oldUri);
        }

        const updated = {
          ...settingsRef.current,
          enabled: true,
          soundType: "custom",
          fileName: asset.name || "Custom Sound.mp3",
          fileUri: permanentUri,
        };

        await commitSettings(updated);
        setFeedback({ type: "success", text: `Selected sound: ${asset.name}` });
        return true;
      }
      return false;
    } catch (err) {
      console.error("[AlarmContext] Document picker error:", err);
      setFeedback({ type: "error", text: "Failed to load audio file." });
      return false;
    } finally {
      setPicking(false);
    }
  }, [commitSettings]);

  const resetToDefaultSound = useCallback(async () => {
    const oldUri = settingsRef.current.fileUri;
    if (oldUri) {
      await removeAudioFile(oldUri);
    }
    const updated = {
      ...settingsRef.current,
      soundType: "default",
      fileName: "Alarm Beep.mp3",
      fileUri: null,
    };
    await commitSettings(updated);
    setFeedback({ type: "info", text: "Reset to default alarm sound" });
  }, [commitSettings]);

  const playPreview = useCallback(async () => {
    if (isPlaying) {
      alarmAudioService.stopAlarm();
      setIsPlaying(false);
    }
    setIsPreviewing(true);
    await alarmAudioService.playPreview(settingsRef.current, () => {
      setIsPreviewing(false);
    });
  }, [isPlaying]);

  const stopPreview = useCallback(() => {
    alarmAudioService.stopPreview();
    setIsPreviewing(false);
  }, []);

  const triggerAlarm = useCallback((shouldTrigger) => {
    setIsAlarmTriggered(shouldTrigger);

    if (!shouldTrigger) {
      setIsMuted(false);
      alarmAudioService.stopAlarm();
      setIsPlaying(false);
      return;
    }

    if (settingsRef.current.enabled && !isMutedRef.current) {
      alarmAudioService.playAlarm(settingsRef.current);
      setIsPlaying(true);
    } else {
      alarmAudioService.stopAlarm();
      setIsPlaying(false);
    }
  }, []);

  const muteCurrentAlarm = useCallback(() => {
    setIsMuted(true);
    alarmAudioService.stopAlarm();
    setIsPlaying(false);
  }, []);

  const unmuteCurrentAlarm = useCallback(() => {
    setIsMuted(false);
    if (isTriggeredRef.current && settingsRef.current.enabled) {
      alarmAudioService.playAlarm(settingsRef.current);
      setIsPlaying(true);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMutedRef.current) {
      unmuteCurrentAlarm();
    } else {
      muteCurrentAlarm();
    }
  }, [unmuteCurrentAlarm, muteCurrentAlarm]);

  return (
    <AlarmContext.Provider
      value={{
        alarmSettings,
        isAlarmTriggered,
        isPlaying,
        isPreviewing,
        isMuted,
        picking,
        feedback,
        setFeedback,
        toggleAlarmEnabled,
        pickCustomSound,
        resetToDefaultSound,
        playPreview,
        stopPreview,
        triggerAlarm,
        muteCurrentAlarm,
        unmuteCurrentAlarm,
        toggleMute,
      }}
    >
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarm() {
  const ctx = useContext(AlarmContext);
  if (!ctx) {
    throw new Error("useAlarm must be used within an AlarmProvider");
  }
  return ctx;
}

