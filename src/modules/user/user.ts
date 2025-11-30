import Canvas from "@napi-rs/canvas";
import type { GuildMember } from "discord.js";
import { getBumpStreak } from "../../store/models/bumps.js";
import { type DDUser, getOrCreateUserById } from "../../store/models/DDUser.js";
import { branding } from "../../util/branding.js";
import {
	createCanvasContext,
	getTextSize,
	loadAndDrawImage,
	setFont,
} from "../../util/canvas.js";
import { xpForLevel } from "../xp/xpForMessage.util.js";

export const profileFont = "Cascadia Code";
Canvas.GlobalFonts.registerFromPath(branding.font, profileFont);
export function getDDColorGradient(
	ctx: Canvas.SKRSContext2D,
	startX: number,
	width: number,
) {
	// Create a linear gradient for the divider
	const gradient = ctx.createLinearGradient(startX, 0, startX + width, 0);
	gradient.addColorStop(0, "#00AFC3FF"); // Red at start
	gradient.addColorStop(0.5, "#8099FFFF"); // Green in middle
	gradient.addColorStop(1, "#FF52F9FF"); // Blue at end
	return gradient;
}

export function createLevelAndXPField(
	canvas: Canvas.SKRSContext2D,
	user: GuildMember,
	ddUser: DDUser,
	x: number,
	y: number,
	barWidth: number = 300,
	barHeight: number = 20,
) {
	const { xp, level } = ddUser;

	// XP bar configuration
	const barX = x; // After avatar and padding
	const barY = y; // Slightly above name

	const xpForNextLevel = xpForLevel(ddUser.level + 1);
	const xpProgress = Math.min(Number(xp) / Number(xpForNextLevel), 1);

	// Draw XP bar background
	canvas.fillStyle = "#444444";
	canvas.fillRect(barX, barY, barWidth, barHeight);
	let userRoleColor = user.roles.highest.hexColor;
	if (userRoleColor === "#000000" || userRoleColor === "#444444") {
		// green
		userRoleColor = "#FF52F9FF";
	}
	// Draw XP bar progress
	canvas.fillStyle = userRoleColor;
	canvas.fillRect(barX, barY, barWidth * xpProgress, barHeight);

	// Draw XP text
	setFont(canvas, 16);
	canvas.fillStyle = "#ffffff";
	canvas.textAlign = "left";
	canvas.fillText(
		`Level: ${level} | XP: ${xp}/${xpForNextLevel}`,
		barX,
		barY - 5,
	);
}

export async function createUserBumpFields(
	canvas: Canvas.SKRSContext2D,
	ddUser: DDUser,
	x: number,
	y: number,
) {
	const bumps = await ddUser.countBumps();
	const bumpStreak = await getBumpStreak(ddUser);
	const currentDailyStreak = ddUser.currentDailyStreak;
	const highestDailyStreak = ddUser.highestDailyStreak;

	// Set font for bump fields
	setFont(canvas, 16);
	canvas.fillStyle = "#ffffff";
	canvas.textAlign = "left";

	// Draw bump statistics
	let currentY = y;

	// Total bumps
	canvas.fillText(
		`Total Bumps: ${bumps} | Current Bump Streak: ${bumpStreak.current} | Highest Bump Streak: ${bumpStreak.highest}`,
		x,
		currentY,
	);
	currentY += 20;

	// Daily streaks
	canvas.fillText(
		`Current Daily Streak: ${currentDailyStreak} | Highest Daily Streak: ${highestDailyStreak}`,
		x,
		currentY,
	);
}
export function drawDivider(
	ctx: Canvas.SKRSContext2D,
	x: number,
	y: number,
	length: number,
	orientation: "horizontal" | "vertical" = "horizontal",
	color: string | CanvasGradient = "#444444",
	thickness: number = 1,
) {
	ctx.save();

	// Set drawing properties
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;

	if (orientation === "horizontal") {
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + length, y);
		ctx.stroke();
	} else {
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x, y + length);
		ctx.stroke();
	}

	ctx.restore();
}

export async function generateUserProfileImage(
	user: GuildMember,
	ddUser: DDUser,
): Promise<string> {
	const w = 1048;
	const h = 162;

	const padding = 12;

	// Create canvas with context
	const ctx = createCanvasContext(w, h);

	// Background gradient
	ctx.fillStyle = "#171834";
	ctx.fillRect(0, 0, w, h);

	// Draw user's name

	const displayNameX = 128 + 4 + padding;
	const displayNameY = 52;

	setFont(ctx, 32);
	ctx.fillStyle = "#ffffff";
	ctx.textAlign = "left";
	ctx.fillText(user.displayName, displayNameX, displayNameY);

	const displayNameSize = getTextSize(ctx, user.displayName);

	//const debugImage =
	//	"https://external-content.duckduckgo.com/iu/?u=http%3A%2F%2Fwww.quickmeme.com%2Fimg%2F46%2F468394fc32d72c2bdc04abd04834782a2de7fee5834b5df2fa3b9295262db4cb.jpg&f=1&nofb=1&ipt=be4cd3afa2da068f2bb6b0639cb2ada1402241214afa20a08be89b7c7ee71485";
	const roleIcon = user.roles.highest.iconURL({
		size: 256,
		extension: "png",
		forceStatic: true,
	});
	if (roleIcon) {
		// Draw user's role icon
		const roleIconSize = 32;
		await loadAndDrawImage(
			ctx,
			roleIcon,
			displayNameX + displayNameSize.width + 8,
			displayNameY - displayNameSize.height - 4,
			roleIconSize,
			roleIconSize,
		);
	}

	// Draw user's avatar (scaled)
	const avatarUrl = user.displayAvatarURL({ size: 256 });
	await loadAndDrawImage(ctx, avatarUrl, padding, padding, 128, 128);

	createLevelAndXPField(ctx, user, ddUser, 128 + 6 + padding, 52 + 25);

	await createUserBumpFields(ctx, ddUser, 128 + 6 + padding, 52 + 25 + 40);

	const dividerWidth = w;

	drawDivider(
		ctx,
		0,
		h - 5,
		dividerWidth,
		"horizontal",
		getDDColorGradient(ctx, padding, dividerWidth),
		2,
	);
	await drawDeveloperDenText(ctx, w - 124, -8, 124);
	return ctx.canvas.toDataURL("image/png");
}
export async function drawDeveloperDenText(
	ctx: Canvas.SKRSContext2D,
	x: number,
	y: number,
	size: number,
) {
	await loadAndDrawImage(ctx, "devden_logo_short.svg", x, y, size, size);
}

export async function getProfileEmbed(user: GuildMember) {
	const ddUser = await getOrCreateUserById(BigInt(user.id));
	const image = await generateUserProfileImage(user, ddUser);

	return {
		image: image,
	};
}
