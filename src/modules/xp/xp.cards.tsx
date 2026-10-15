import { Section, Separator, TextDisplay, Thumbnail } from "disjsx";
import { Card, type CardAuthor } from "../../ui/index.js";
import { formatDayCount } from "./dailyStreak.js";
import { getTierByLevel, xpForLevel } from "./levels.js";

const clamp = (fraction: number) => Math.min(1, Math.max(0, fraction));

/** e.g. `▰▰▰▰▰▰▰▱▱▱` */
function bar(fraction: number, width = 10) {
	const filled = Math.round(clamp(fraction) * width);
	return "▰".repeat(filled) + "▱".repeat(width - filled);
}

const percent = (fraction: number) => `${Math.round(clamp(fraction) * 100)}%`;

/** The tier role as a mention, which Discord draws in the role's colour, or the tier in bold */
const tierLabel = (level: number, tierRole?: string) =>
	tierRole ? `<@&${tierRole}>` : `**Tier ${getTierByLevel(level)}**`;

/** How far `level` is through its tier. Tiers are 10 levels wide; the first runs from level 0 */
function tierProgress(level: number) {
	const tier = getTierByLevel(level);
	const start = tier <= 1 ? 0 : (tier - 1) * 10;
	return { fraction: (level - start) / 10, nextTierAt: tier * 10 || 1 };
}

/** How far `xp` is through `level`, and how much more the next level needs */
function levelProgress(level: number, xp: bigint) {
	const start = xpForLevel(level);
	const next = xpForLevel(level + 1);
	return {
		next,
		fraction: Number(xp - start) / Number(next - start),
		remaining: next - xp,
	};
}

/**
 * A heading and lines beside the avatar. These cards lead with the heading next to the avatar,
 * where `<Card>` puts its title on a row of its own above the author
 */
function AvatarHeader({
	iconUrl,
	lines,
}: {
	iconUrl?: string;
	lines: [string, ...string[]];
}) {
	const texts = lines.map((line) => (
		<TextDisplay key={line}>{line}</TextDisplay>
	));
	if (!iconUrl) return <>{texts}</>;
	return (
		<Section>
			{texts}
			<Thumbnail url={iconUrl} />
		</Section>
	);
}

export function ProfileCard({
	author,
	level,
	xp,
	currentStreak,
	highestStreak,
	bumps,
	tierRole,
}: {
	author: CardAuthor;
	level: number;
	xp: bigint;
	currentStreak: number;
	highestStreak: number;
	bumps: number;
	/** Shown in the role's colour; see `tierRoleId` */
	tierRole?: string;
}) {
	const { next, fraction, remaining } = levelProgress(level, xp);
	return (
		<Card
			accent={author.color}
			footer={`${remaining.toLocaleString()} XP to level ${level + 1}`}
		>
			<AvatarHeader
				iconUrl={author.iconUrl}
				lines={[
					`## ${author.name}`,
					`**Level ${level}** | ${tierLabel(level, tierRole)}`,
					`🔥 ${formatDayCount(currentStreak)} (max ${highestStreak}) | 📣 ${bumps.toLocaleString()} ${bumps === 1 ? "bump" : "bumps"}`,
				]}
			/>
			<Separator />
			<TextDisplay>
				{`**XP** ${xp.toLocaleString()} / ${next.toLocaleString()}   ${bar(fraction)} ${percent(fraction)}`}
			</TextDisplay>
		</Card>
	);
}

/** One 🔥 at 100 days, and another for every 50 after */
const flames = (streak: number) =>
	streak >= 100 ? "🔥".repeat(Math.floor((streak - 100) / 50) + 1) : "";

export function DailyRewardCard({
	author,
	streak,
	xpGiven,
	multiplier,
}: {
	author: CardAuthor;
	streak: number;
	xpGiven: number | bigint;
	multiplier?: number | null;
}) {
	const lines = [
		`📆 Current streak: ${formatDayCount(streak)} ${flames(streak)}`.trimEnd(),
		`⭐ +${xpGiven} XP ${multiplier ? `(x${multiplier})` : ""}`.trimEnd(),
		"⏰ Come back in 24 hours for a new reward!",
	];
	return (
		<Card title="Daily Reward Claimed!" author={author}>
			<TextDisplay>{lines.join("\n")}</TextDisplay>
		</Card>
	);
}

export function LevelUpCard({
	greeting,
	author,
	level,
	previousLevel = level - 1,
	xp,
	tierRole,
}: {
	/** Above the card: a mention for members who want pings, otherwise their name */
	greeting: string;
	author: CardAuthor;
	level: number;
	/** Members can jump several levels at once, which can skip past a tier boundary */
	previousLevel?: number;
	xp: bigint;
	/** Shown in the role's colour; see `tierRoleId` */
	tierRole?: string;
}) {
	const newTier = getTierByLevel(level) !== getTierByLevel(previousLevel);
	const { remaining } = levelProgress(level, xp);
	// progress through the level is ~0 right after a level-up, so this shows the tier instead
	const { fraction, nextTierAt } = tierProgress(level);
	return (
		<>
			<TextDisplay>{greeting}</TextDisplay>
			{/* the greeting already mentions them, so the card shows their name rather than another mention */}
			<Card
				accent={author.color}
				footer={`${remaining.toLocaleString()} XP to level ${level + 1}`}
			>
				<AvatarHeader
					iconUrl={author.iconUrl}
					lines={[
						`## ⚡ Level ${level}!`,
						`**${author.name}** levelled up | ${tierLabel(level, tierRole)}`,
						...(newTier ? ["🎉 New tier unlocked!"] : []),
					]}
				/>
				<Separator />
				<TextDisplay>{`${bar(fraction)} next tier at level ${nextTierAt}`}</TextDisplay>
			</Card>
		</>
	);
}
