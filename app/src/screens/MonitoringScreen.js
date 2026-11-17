import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
	StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
	FadeIn,
	FadeInDown,
	useReducedMotion,
} from "react-native-reanimated";
import { useMqttSensor } from "../hooks/useMqttSensor.js";
import { useAlarm } from "../context/AlarmContext.js";
import { Api } from "../services/api.js";
import { DataTable } from "../components/DataTable.js";
import { TempOrb } from "../components/TempOrb.js";
import { tokens } from "../theme/tokens.js";

const { color, space, radius, shadow } = tokens;
const PAGE_SIZE = 5;

function StatusChip({ connectionState, hasError, onRetry }) {
	const config = useMemo(() => {
		if (
			hasError ||
			connectionState === "error" ||
			connectionState === "disconnected"
		) {
			return {
				bg: color.dangerBg,
				border: color.dangerBorder,
				text: color.dangerText,
				dot: color.dangerText,
				label: "Offline",
				actionable: true,
			};
		}
		if (connectionState === "reconnecting") {
			return {
				bg: color.warnBg,
				border: color.warnBorder,
				text: color.warnText,
				dot: color.warnText,
				label: "Reconnecting…",
				actionable: false,
			};
		}
		return {
			bg: color.successBg,
			border: color.successBorder,
			text: color.successText,
			dot: color.successText,
			label: "Connected",
			actionable: false,
		};
	}, [connectionState, hasError]);

	const chip = (
		<View
			style={[
				styles.chip,
				{ backgroundColor: config.bg, borderColor: config.border },
			]}
			accessible
			accessibilityLabel={`Sensor feed ${config.label}`}
			accessibilityRole="text"
		>
			<View style={[styles.dot, { backgroundColor: config.dot }]} />
			<Text style={[styles.chipText, { color: config.text }]}>
				{config.label}
			</Text>
			{config.actionable ? (
				<Ionicons name="refresh" size={14} color={config.text} />
			) : null}
		</View>
	);

	if (config.actionable && onRetry) {
		return (
			<Pressable
				onPress={onRetry}
				accessibilityLabel="Retry sensor feed"
				accessibilityRole="button"
				accessibilityHint="Attempts to reload sensor history"
				hitSlop={8}
				style={({ pressed }) => [pressed && styles.pressed]}
			>
				{chip}
			</Pressable>
		);
	}
	return chip;
}

export function MonitoringScreen() {
	const {
		temperature,
		timestamp,
		connectionState,
		error: mqttError,
	} = useMqttSensor();
	const {
		triggerAlarm,
		isPlaying: isAlarmPlaying,
		isMuted,
		muteCurrentAlarm,
		unmuteCurrentAlarm,
		toggleMute,
		alarmSettings,
	} = useAlarm();
	const [readings, setReadings] = useState([]);
	const [latestThreshold, setLatestThreshold] = useState(null);
	const [page, setPage] = useState(1);
	const [orbSize, setOrbSize] = useState(280);
	const totalPages = Math.max(1, Math.ceil(readings.length / PAGE_SIZE));
	const visibleReadings = useMemo(
		() => readings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
		[readings, page],
	);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [apiError, setApiError] = useState(null);
	const reduceMotion = useReducedMotion();

	const fetchReadings = useCallback(async () => {
		setLoading(true);
		setApiError(null);
		try {
			const [history, thresholds] = await Promise.all([
				Api.getSensorReadings(),
				Api.getThresholds().catch(() => null),
			]);
			setReadings(history ?? []);
			setPage(1);
			const latest = Array.isArray(thresholds) ? thresholds[0]?.value : null;
			setLatestThreshold(typeof latest === "number" ? latest : null);
		} catch (err) {
			setApiError(err.message || "Couldn't load history.");
		} finally {
			setLoading(false);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			fetchReadings();
		}, [fetchReadings]),
	);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchReadings();
		} finally {
			setRefreshing(false);
		}
	}, [fetchReadings]);

	const proximity = useMemo(() => {
		if (
			typeof temperature !== "number" ||
			typeof latestThreshold !== "number"
		) {
			return null;
		}
		let tone = "below threshold";
		let statusWord = "Normal";
		let statusColor = color.successText;
		if (temperature >= latestThreshold) {
			tone = "at or above threshold";
			statusWord = "Over limit";
			statusColor = color.dangerText;
		} else if (temperature >= latestThreshold - 2) {
			tone = "near threshold";
			statusWord = "Near limit";
			statusColor = color.warnText;
		}
		return { tone, statusWord, statusColor };
	}, [temperature, latestThreshold]);

	const isOverLimit = useMemo(() => {
		return (
			typeof temperature === "number" &&
			typeof latestThreshold === "number" &&
			temperature >= latestThreshold
		);
	}, [temperature, latestThreshold]);

	useEffect(() => {
		triggerAlarm(isOverLimit);
	}, [isOverLimit, triggerAlarm]);

	const freshness = useMemo(() => {
		if (!Array.isArray(readings) || readings.length === 0) {
			return "No readings yet";
		}
		const first = readings[0];
		const t = new Date(first.recorded_at ?? first.timestamp ?? Date.now());
		const s = Number.isNaN(t.getTime())
			? 0
			: Math.max(0, Math.round((Date.now() - t.getTime()) / 1000));
		const rel =
			s < 10 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
		return `Updated ${rel} · ${readings.length} ${
			readings.length === 1 ? "reading" : "readings"
		}`;
	}, [readings]);

	const tempLabel =
		typeof temperature === "number" ? `${temperature.toFixed(2)}` : "--";

	const beatKey =
		typeof timestamp === "string" && !Number.isNaN(Date.parse(timestamp))
			? Date.parse(timestamp)
			: 0;

	return (
		<View style={styles.safe}>
			<ScrollView
				contentContainerStyle={styles.container}
				contentInsetAdjustmentBehavior="automatic"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={color.primary}
					/>
				}
			>
				<Animated.View
					style={styles.card}
					entering={
						reduceMotion
							? FadeIn.duration(150)
							: FadeInDown.duration(tokens.motion.entering)
					}
				>
					<View style={styles.cardTopRow}>
						<Text style={styles.eyebrow}>Live temperature</Text>
						<StatusChip
							connectionState={connectionState}
							hasError={Boolean(mqttError)}
							onRetry={onRefresh}
						/>
					</View>

					{isOverLimit ? (
						<View
							style={[
								styles.alarmBanner,
								isAlarmPlaying && styles.alarmBannerPlaying,
								isMuted && styles.alarmBannerMuted,
							]}
							accessible
							accessibilityRole="alert"
						>
							<Ionicons
								name={
									isMuted
										? "volume-mute"
										: isAlarmPlaying
										? "volume-high"
										: "warning"
								}
								size={22}
								color={isMuted ? color.text2 : color.dangerText}
							/>
							<View style={styles.alarmBannerContent}>
								<Text style={styles.alarmBannerTitle}>
									High Temperature Alert!
								</Text>
								<Text style={styles.alarmBannerText}>
									{alarmSettings.enabled
										? isMuted
											? `Alarm sound muted (${alarmSettings.fileName})`
											: `Playing: ${alarmSettings.fileName}`
										: "Alarm sound is turned off in Settings"}
								</Text>
							</View>
							{alarmSettings.enabled ? (
								<Pressable
									style={({ pressed }) => [
										isMuted ? styles.unmuteButton : styles.muteButton,
										pressed && styles.pressed,
									]}
									onPress={toggleMute}
									accessibilityRole="button"
									accessibilityLabel={
										isMuted ? "Unmute alarm sound" : "Mute alarm sound"
									}
								>
									<Ionicons
										name={isMuted ? "volume-high" : "volume-mute"}
										size={14}
										color={isMuted ? color.primary : color.dangerText}
									/>
									<Text
										style={[
											styles.muteButtonText,
											isMuted && styles.unmuteButtonText,
										]}
									>
										{isMuted ? "Unmute" : "Mute"}
									</Text>
								</Pressable>
							) : null}
						</View>
					) : null}

					<View
						style={styles.orbStage}
						onLayout={({ nativeEvent }) =>
							setOrbSize(Math.min(320, nativeEvent.layout.width))
						}
						accessible
						accessibilityLabel={`Current temperature ${tempLabel} degrees Celsius${
							proximity ? `, ${proximity.statusWord}` : ""
						}`}
					>
						<View style={[styles.orbWrap, { width: orbSize, height: orbSize }]}>
							<TempOrb
								tint={proximity ? proximity.statusColor : color.primary}
								beatKey={beatKey}
								dimmed={
									connectionState !== "connected" &&
									connectionState !== "reconnecting"
								}
								size={orbSize}
							/>
							<View style={styles.orbNumber} pointerEvents="none">
								<View style={styles.orbNumberRow}>
									<Text
										style={[
											styles.temperatureText,
											{ color: proximity ? proximity.statusColor : color.text },
										]}
										selectable
									>
										{tempLabel}
									</Text>
									<Text
										style={[
											styles.unitText,
											{
												color: proximity ? proximity.statusColor : color.text2,
											},
										]}
									>
										°C
									</Text>
								</View>
								{proximity ? (
									<Text
										style={[
											styles.statusWord,
											{ color: proximity.statusColor },
										]}
									>
										{proximity.statusWord}
									</Text>
								) : null}
							</View>
						</View>
					</View>

					<View style={styles.metaBlock}>
						{typeof latestThreshold === "number" ? (
							<View style={styles.metaRow}>
								<Ionicons
									name="speedometer-outline"
									size={15}
									color={color.text3}
								/>
								<Text style={styles.metaText}>
									Threshold {latestThreshold.toFixed(2)}°C
								</Text>
							</View>
						) : null}
						{timestamp ? (
							<View style={styles.metaRow}>
								<Ionicons name="time-outline" size={15} color={color.text3} />
								<Text style={styles.metaText}>
									Last update {new Date(timestamp).toLocaleString()}
								</Text>
							</View>
						) : null}
						<View style={styles.metaRow}>
							<Ionicons name="refresh-outline" size={15} color={color.text3} />
							<Text style={styles.metaText}>{freshness}</Text>
						</View>
					</View>

					{mqttError ? (
						<View
							style={styles.errorBanner}
							accessible
							accessibilityLiveRegion="polite"
							accessibilityLabel={`Sensor feed offline. ${mqttError}`}
						>
							<Ionicons
								name="cloud-offline-outline"
								size={18}
								color={color.dangerText}
							/>
							<View style={styles.errorBannerTextWrap}>
								<Text style={styles.errorBannerTitle}>Sensor feed offline</Text>
								<Text style={styles.errorBannerText}>{mqttError}</Text>
							</View>
							<Pressable
								onPress={onRefresh}
								accessibilityLabel="Retry sensor feed"
								accessibilityRole="button"
								hitSlop={8}
								style={({ pressed }) => [
									styles.retryButton,
									pressed && styles.pressed,
								]}
							>
								<Text style={styles.retryText}>Retry</Text>
							</Pressable>
						</View>
					) : null}
				</Animated.View>

				{apiError && !loading ? (
					<View
						style={styles.errorBanner}
						accessible
						accessibilityLiveRegion="polite"
						accessibilityLabel={`Couldn't load history. ${apiError}`}
					>
						<Ionicons
							name="alert-circle-outline"
							size={18}
							color={color.dangerText}
						/>
						<View style={styles.errorBannerTextWrap}>
							<Text style={styles.errorBannerTitle}>Couldn't load history</Text>
							<Text style={styles.errorBannerText}>{apiError}</Text>
						</View>
						<Pressable
							onPress={fetchReadings}
							accessibilityLabel="Retry loading history"
							accessibilityRole="button"
							hitSlop={8}
							style={({ pressed }) => [
								styles.retryButton,
								pressed && styles.pressed,
							]}
						>
							<Text style={styles.retryText}>Retry</Text>
						</Pressable>
					</View>
				) : null}

				<View style={styles.sectionHeader}>
					<View style={styles.sectionTitleRow}>
						<Text style={styles.sectionTitle}>Triggered Alarm History</Text>
						{Array.isArray(readings) && readings.length > 0 ? (
							<View style={styles.countPill}>
								<Text style={styles.countText}>
									{readings.length}{" "}
									{readings.length === 1 ? "reading" : "readings"}
								</Text>
							</View>
						) : null}
					</View>
				</View>

				<DataTable
					columns={[
						{
							key: "recorded_at",
							title: "Timestamp",
							flex: 1.5,
							// ponytail: same single-line format as threshold history
							render: (value) =>
								value ? new Date(value).toLocaleString() : "--",
						},
						{
							key: "temperature",
							title: "Temp °C",
							flex: 0.9,
							numeric: true,
							render: (value) =>
								typeof value === "number" ? Number(value).toFixed(2) : "--",
						},
						{
							key: "threshold_value",
							title: "Limit °C",
							flex: 0.9,
							numeric: true,
							render: (value) =>
								typeof value === "number" ? Number(value).toFixed(2) : "--",
						},
					]}
					data={visibleReadings}
					keyExtractor={(item) => item.id}
					loading={loading && !refreshing}
					emptyTitle="No readings yet"
					emptyMessage="Triggered readings appear here. Pull to refresh."
					emptyActionLabel="Refresh"
					onEmptyAction={fetchReadings}
				/>
				<Text style={styles.metaText} accessibilityLiveRegion="polite">
					{readings.length === 0
						? "Belum ada data"
						: `Data ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, readings.length)} dari ${readings.length} riwayat terbaru`}
				</Text>
				<View style={styles.pagination}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Sebelumnya"
						disabled={page === 1 || loading || refreshing}
						onPress={() => setPage((current) => Math.max(1, current - 1))}
						style={({ pressed }) => [
							styles.pageButton,
							(page === 1 || loading || refreshing) && styles.pageDisabled,
							pressed && styles.pressed,
						]}
					>
						<Text style={styles.pageButtonText}>Sebelumnya</Text>
					</Pressable>
					<Text style={styles.pageLabel} accessibilityLiveRegion="polite">
						Halaman {page} / {totalPages}
					</Text>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Berikutnya"
						disabled={page >= totalPages || loading || refreshing}
						onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
						style={({ pressed }) => [
							styles.pageButton,
							(page >= totalPages || loading || refreshing) && styles.pageDisabled,
							pressed && styles.pressed,
						]}
					>
						<Text style={styles.pageButtonText}>Berikutnya</Text>
					</Pressable>
				</View>
				<Text style={styles.metaText}>
					Menampilkan maksimal 100 riwayat terbaru dari server. Tarik ke bawah untuk memperbarui.
				</Text>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	pagination: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
	},
	pageButton: {
		minHeight: tokens.hit,
		paddingHorizontal: space.md,
		justifyContent: "center",
		backgroundColor: color.primary,
		borderRadius: radius.input,
	},
	pageButtonText: { color: color.onPrimary, fontSize: 13, fontWeight: "600" },
	pageDisabled: { opacity: 0.4 },
	pageLabel: { color: color.text2, fontSize: 13, fontVariant: ["tabular-nums"] },
	safe: {
		flex: 1,
		backgroundColor: color.bg,
	},
	container: {
		padding: space.lg,
		paddingBottom: space.xxl,
		gap: space.lg,
		backgroundColor: color.bg,
	},
	card: {
		backgroundColor: color.surface,
		padding: space.xl,
		borderRadius: radius.card,
		borderCurve: "continuous",
		gap: space.md,
		borderWidth: 1,
		borderColor: color.border,
		boxShadow: shadow.card,
	},
	cardTopRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: space.md,
	},
	eyebrow: {
		fontSize: 12,
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: 0.8,
		color: color.text3,
	},
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: radius.chip,
		borderCurve: "continuous",
		borderWidth: 1,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	chipText: {
		fontSize: 12,
		fontWeight: "600",
	},
	orbStage: {
		alignItems: "center",
		gap: space.sm,
		minHeight: 200,
	},
	orbWrap: {
		alignSelf: "center",
		position: "relative",
	},
	orbNumber: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
	},
	orbNumberRow: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 6,
	},
	temperatureText: {
		fontSize: 30,
		fontWeight: "700",
		color: color.text,
		fontVariant: ["tabular-nums"],
	},
	unitText: {
		fontSize: 15,
		fontWeight: "600",
		color: color.text2,
	},
	statusWord: {
		fontSize: 13,
		fontWeight: "700",
	},
	metaBlock: {
		gap: space.sm,
		marginTop: space.sm,
	},
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	metaText: {
		fontSize: 13,
		color: color.text2,
		fontVariant: ["tabular-nums"],
	},
	sectionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		// ponytail: taller break above, table tucked under header
		marginTop: space.md,
		marginBottom: -space.sm,
	},
	sectionTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	sectionTitle: {
		fontSize: tokens.type.section,
		fontWeight: "700",
		color: color.text,
	},
	countPill: {
		backgroundColor: color.surface2,
		borderRadius: radius.pill,
		borderCurve: "continuous",
		paddingVertical: 4,
		paddingHorizontal: 8,
	},
	countText: {
		fontSize: 12,
		fontWeight: "600",
		color: color.text2,
		fontVariant: ["tabular-nums"],
	},
	errorBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		backgroundColor: color.dangerBg,
		borderWidth: 1,
		borderColor: color.dangerBorder,
		borderRadius: radius.input,
		borderCurve: "continuous",
		padding: space.md,
	},
	errorBannerTextWrap: {
		flex: 1,
		gap: 2,
	},
	errorBannerTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: color.dangerText,
	},
	errorBannerText: {
		fontSize: 13,
		color: color.dangerText,
	},
	retryButton: {
		minHeight: tokens.hit,
		justifyContent: "center",
		paddingHorizontal: space.md,
	},
	retryText: {
		fontSize: 14,
		fontWeight: "600",
		color: color.dangerText,
	},
	pressed: {
		opacity: 0.9,
		transform: [{ scale: 0.98 }],
	},
	alarmBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		backgroundColor: color.dangerBg,
		borderWidth: 1,
		borderColor: color.dangerBorder,
		borderRadius: radius.input,
		padding: space.md,
		marginTop: space.sm,
	},
	alarmBannerPlaying: {
		borderColor: color.dangerText,
		backgroundColor: "#FEE2E2",
	},
	alarmBannerMuted: {
		borderColor: color.border,
		backgroundColor: color.surface2,
	},
	alarmBannerContent: {
		flex: 1,
		gap: 2,
	},
	alarmBannerTitle: {
		fontSize: 14,
		fontWeight: "700",
		color: color.dangerText,
	},
	alarmBannerText: {
		fontSize: 12,
		color: color.text2,
		fontWeight: "500",
	},
	muteButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: radius.pill,
		backgroundColor: color.surface,
		borderWidth: 1,
		borderColor: color.dangerBorder,
	},
	muteButtonText: {
		fontSize: 12,
		fontWeight: "600",
		color: color.dangerText,
	},
	unmuteButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: radius.pill,
		backgroundColor: color.surface,
		borderWidth: 1,
		borderColor: color.primary,
	},
	unmuteButtonText: {
		fontSize: 12,
		fontWeight: "600",
		color: color.primary,
	},
});
