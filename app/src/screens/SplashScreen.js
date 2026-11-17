import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { group } from "../data/group.js";
import { tokens } from "../theme/tokens.js";

const { color, space } = tokens;

export function SplashScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <View style={styles.thermometer}>
            <View style={styles.mercury} />
            <View style={styles.bulb} />
          </View>
        </View>
        <Text style={styles.title}>LiveTemp</Text>
        <Text style={styles.subtitle}>Monitoring suhu, secara langsung.</Text>
        <ActivityIndicator
          size="small"
          color={color.primary}
          accessibilityLabel="Membuka LiveTemp"
        />
      </View>
      <View style={styles.footer}>
        <Text style={styles.group}>{group.name}</Text>
        <Text style={styles.module}>{group.module}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxl,
  },
  brand: { alignItems: "center", gap: space.xl },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: color.primary,
    backgroundColor: color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  thermometer: {
    width: 20,
    height: 54,
    borderWidth: 3,
    borderColor: color.primary,
    borderRadius: 10,
  },
  mercury: {
    position: "absolute",
    bottom: 0,
    left: 4,
    width: 6,
    height: 30,
    backgroundColor: color.primary,
  },
  bulb: {
    position: "absolute",
    bottom: -5,
    left: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.primary,
  },
  title: { fontSize: 40, fontWeight: "800", color: color.text },
  subtitle: { fontSize: 15, color: color.text2, textAlign: "center" },
  footer: { position: "absolute", bottom: 48, alignItems: "center", gap: 6 },
  group: { fontSize: 16, fontWeight: "700", color: color.primary },
  module: { fontSize: 13, color: color.text2 },
});
