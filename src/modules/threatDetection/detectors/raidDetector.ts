import type { GuildMember } from "discord.js";
import ExpiryMap from "expiry-map";
import { ThreatAction, ThreatType } from "../../../store/models/ThreatLog.js";

export interface RaidDetectionResult {
	detected: boolean;
	threatType: ThreatType;
	severity: number;
	action: ThreatAction;
	details: {
		joinCount: number;
		windowSeconds: number;
		newAccountCount: number;
		raidModeActive: boolean;
	};
}

interface JoinWindow {
	joins: Array<{
		userId: string;
		timestamp: number;
		accountCreatedAt: number;
	}>;
	raidModeActive: boolean;
	raidModeStartedAt?: number;
}

const joinWindowCache = new ExpiryMap<string, JoinWindow>(300_000);

const RAID_MODE_DURATION_MS = 5 * 60 * 1000;

function cleanOldJoins(window: JoinWindow, windowMs: number): JoinWindow {
	const now = Date.now();
	return {
		...window,
		joins: window.joins.filter((j) => now - j.timestamp < windowMs),
	};
}

function countNewAccounts(
	joins: JoinWindow["joins"],
	thresholdDays: number,
): number {
	const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
	const now = Date.now();
	return joins.filter((j) => now - j.accountCreatedAt < thresholdMs).length;
}

export function detectRaid(
	member: GuildMember,
	config: {
		maxJoinsPerWindow: number;
		windowSeconds: number;
		newAccountThreshold: number;
		action: "alert" | "lockdown" | "kick_new";
	},
): RaidDetectionResult {
	const guildId = member.guild.id;
	const windowMs = config.windowSeconds * 1000;

	let joinWindow = joinWindowCache.get(guildId) || {
		joins: [],
		raidModeActive: false,
	};
	joinWindow = cleanOldJoins(joinWindow, windowMs);

	if (
		joinWindow.raidModeActive &&
		joinWindow.raidModeStartedAt &&
		Date.now() - joinWindow.raidModeStartedAt > RAID_MODE_DURATION_MS
	) {
		joinWindow.raidModeActive = false;
		joinWindow.raidModeStartedAt = undefined;
	}

	joinWindow.joins.push({
		userId: member.id,
		timestamp: Date.now(),
		accountCreatedAt: member.user.createdTimestamp,
	});

	const joinCount = joinWindow.joins.length;
	const newAccountCount = countNewAccounts(
		joinWindow.joins,
		config.newAccountThreshold,
	);

	const raidDetected = joinCount >= config.maxJoinsPerWindow;

	if (raidDetected && !joinWindow.raidModeActive) {
		joinWindow.raidModeActive = true;
		joinWindow.raidModeStartedAt = Date.now();
	}

	joinWindowCache.set(guildId, joinWindow);

	let severity = 0;
	if (raidDetected) {
		severity = Math.min(joinCount / config.maxJoinsPerWindow, 1);
		if (newAccountCount > joinCount * 0.5) {
			severity = Math.min(severity + 0.2, 1);
		}
	}

	let action: ThreatAction = ThreatAction.FLAGGED;
	if (raidDetected) {
		switch (config.action) {
			case "kick_new":
				action = ThreatAction.KICKED;
				break;
			case "lockdown":
			case "alert":
				action = ThreatAction.FLAGGED;
				break;
		}
	}

	return {
		detected: raidDetected,
		threatType: ThreatType.RAID,
		severity,
		action,
		details: {
			joinCount,
			windowSeconds: config.windowSeconds,
			newAccountCount,
			raidModeActive: joinWindow.raidModeActive,
		},
	};
}

export function isRaidModeActive(guildId: string): boolean {
	const window = joinWindowCache.get(guildId);
	return window?.raidModeActive ?? false;
}

export function clearRaidMode(guildId: string): void {
	const window = joinWindowCache.get(guildId);
	if (window) {
		window.raidModeActive = false;
		window.raidModeStartedAt = undefined;
		joinWindowCache.set(guildId, window);
	}
}
