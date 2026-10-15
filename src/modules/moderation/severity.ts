import type { Colors } from "discord.js";
import { WarningSeverity } from "../../store/models/Warning.js";

export const SEVERITY_LABELS: Record<WarningSeverity, string> = {
	[WarningSeverity.MINOR]: "Minor",
	[WarningSeverity.MODERATE]: "Moderate",
	[WarningSeverity.SEVERE]: "Severe",
};

export const SEVERITY_EMOJI: Record<WarningSeverity, string> = {
	[WarningSeverity.MINOR]: "🟡",
	[WarningSeverity.MODERATE]: "🟠",
	[WarningSeverity.SEVERE]: "🔴",
};

export const SEVERITY_ACCENTS: Record<WarningSeverity, keyof typeof Colors> = {
	[WarningSeverity.MINOR]: "Gold",
	[WarningSeverity.MODERATE]: "Orange",
	[WarningSeverity.SEVERE]: "Red",
};
