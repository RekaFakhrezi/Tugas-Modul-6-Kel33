import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const STORAGE_KEY = "@livetemp_alarm_settings";

export const DEFAULT_ALARM_SETTINGS = {
  enabled: true,
  soundType: "default", // 'default' | 'custom'
  fileName: "Alarm Beep.mp3",
  fileUri: null,
};

export async function loadAlarmSettings() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ALARM_SETTINGS;
    const parsed = JSON.parse(raw);

    // If custom sound is selected, check whether file still exists
    if (parsed.soundType === "custom" && parsed.fileUri && FileSystem.getInfoAsync) {
      try {
        const info = await FileSystem.getInfoAsync(parsed.fileUri);
        if (!info.exists) {
          console.warn("[AlarmStorage] Custom audio file missing, reverting to default");
          return DEFAULT_ALARM_SETTINGS;
        }
      } catch (err) {
        console.warn("[AlarmStorage] Could not check file existence:", err);
      }
    }

    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
      soundType: parsed.soundType === "custom" ? "custom" : "default",
      fileName: parsed.fileName || "Alarm Beep.mp3",
      fileUri: parsed.soundType === "custom" ? parsed.fileUri : null,
    };
  } catch (error) {
    console.error("[AlarmStorage] Failed to load settings:", error);
    return DEFAULT_ALARM_SETTINGS;
  }
}

export async function saveAlarmSettings(settings) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("[AlarmStorage] Failed to save settings:", error);
  }
}

export async function persistCustomAudioFile(sourceUri, originalName) {
  try {
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!baseDir) {
      return sourceUri;
    }
    const cleanExt =
      originalName && originalName.includes(".")
        ? originalName.substring(originalName.lastIndexOf("."))
        : ".mp3";
    const destName = `custom_alarm_${Date.now()}${cleanExt}`;
    const destUri = `${baseDir}${destName}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destUri,
    });
    return destUri;
  } catch (error) {
    console.warn("[AlarmStorage] FileSystem copy failed, using source URI directly:", error);
    return sourceUri;
  }
}

export async function removeAudioFile(fileUri) {
  if (!fileUri || !FileSystem.deleteAsync) return;
  try {
    const baseDir = FileSystem.documentDirectory;
    if (baseDir && fileUri.startsWith(baseDir)) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch (error) {
    console.warn("[AlarmStorage] Failed to delete audio file:", error);
  }
}

