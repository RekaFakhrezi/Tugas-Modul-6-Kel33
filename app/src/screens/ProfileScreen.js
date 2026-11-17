import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { group } from "../data/group.js";
import { tokens } from "../theme/tokens.js";

const { color, space, radius } = tokens;

export function ProfileScreen() {
  const [linkError, setLinkError] = useState(null);

  async function openRepository() {
    setLinkError(null);
    try {
      await Linking.openURL(group.repository);
    } catch {
      setLinkError(`Tidak dapat membuka browser. Buka ${group.repository}`);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people-outline" size={40} color={color.primary} />
        <Text style={styles.title}>{group.name}</Text>
        <Text style={styles.description}>{group.course}</Text>
        <Text style={styles.description}>{group.module}</Text>
      </View>
      <Text style={styles.sectionTitle}>Anggota kelompok</Text>
      <View style={styles.members}>
        {group.members.map((member) => (
          <View key={member.nim} style={styles.member}>
            <Ionicons name="person-circle-outline" size={32} color={color.primary} />
            <View style={styles.identity}>
              <Text style={styles.name}>{member.name}</Text>
              <Text selectable style={styles.nim}>NIM {member.nim}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.sectionTitle}>Tentang LiveTemp</Text>
      <Text style={styles.description}>
        Aplikasi monitoring suhu berbasis React Native dan Expo. Data sensor
        diterima melalui MQTT, sedangkan riwayat suhu dan pengaturan batas suhu
        disimpan melalui REST API Node.js dan PostgreSQL Neon.
      </Text>
      <Pressable
        onPress={openRepository}
        accessibilityRole="link"
        accessibilityLabel="Buka repository GitHub Kelompok 33"
        style={({ pressed }) => [styles.repository, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="logo-github" size={22} color={color.onPrimary} />
        <Text style={styles.repositoryText}>Repository GitHub</Text>
      </Pressable>
      {linkError ? <Text accessibilityRole="alert" style={styles.error}>{linkError}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: space.xl, gap: space.lg, backgroundColor: color.bg },
  header: { alignItems: "center", gap: space.sm, paddingVertical: space.xl },
  title: { fontSize: 28, fontWeight: "800", color: color.text },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: color.text },
  description: { fontSize: 14, lineHeight: 22, color: color.text2 },
  members: { backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.border },
  member: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  identity: { flex: 1, gap: 6 },
  name: { fontSize: 14, fontWeight: "700", lineHeight: 21, color: color.text },
  nim: { fontSize: 13, color: color.text2 },
  repository: { minHeight: tokens.hit, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, backgroundColor: color.primary, borderRadius: radius.cta, padding: space.md },
  repositoryText: { fontSize: 15, fontWeight: "600", color: color.onPrimary },
  error: { color: color.dangerText, fontSize: 14 },
});
