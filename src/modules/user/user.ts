import * as fs from "node:fs";
import Canvas, { createCanvas, Image } from "@napi-rs/canvas";
import type { GuildMember } from "discord.js";
import sharp from "sharp";
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

const svgContent = fs.readFileSync("./devden_logo_short.svg", "utf8");
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
	const xpForCurrentLevel = xpForLevel(ddUser.level);

	const relativeXp = xp - xpForCurrentLevel;
	const relativeXpForNextLevel = xpForNextLevel - xpForCurrentLevel;

	const xpProgress = Math.min(
		Number(relativeXp) / Number(relativeXpForNextLevel),
		1,
	);

	// Draw XP bar background
	canvas.fillStyle = "#444444";
	canvas.fillRect(barX, barY, barWidth, barHeight);
	let userRoleColor = user.roles.highest.hexColor;
	if (userRoleColor === "#000000" || userRoleColor === "#444444") {
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

const githubIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

async function drawGitHubBadge(
	ctx: Canvas.SKRSContext2D,
	username: string,
	x: number,
	y: number,
) {
	const fontSize = 14;
	const iconSize = 16;
	const paddingH = 8;
	const paddingV = 4;
	const iconTextGap = 5;
	const radius = 6;

	setFont(ctx, fontSize, profileFont, false);
	const textMetrics = getTextSize(ctx, username);

	const badgeWidth =
		paddingH + iconSize + iconTextGap + textMetrics.width + paddingH;
	const badgeHeight =
		paddingV + Math.max(iconSize, textMetrics.height) + paddingV;

	// Draw rounded rectangle background
	ctx.beginPath();
	ctx.roundRect(x, y, badgeWidth, badgeHeight, radius);
	ctx.fillStyle = "#2d333b";
	ctx.fill();
	ctx.strokeStyle = "#444c56";
	ctx.lineWidth = 1;
	ctx.stroke();

	// Draw GitHub icon
	const iconY = y + (badgeHeight - iconSize) / 2;
	const pngBuffer = await sharp(Buffer.from(githubIconSvg))
		.resize(iconSize * 2, iconSize * 2)
		.png()
		.toBuffer();
	await loadAndDrawImage(
		ctx,
		pngBuffer,
		x + paddingH,
		iconY,
		iconSize,
		iconSize,
	);

	// Draw username text
	ctx.fillStyle = "#e6edf3";
	ctx.textAlign = "left";
	setFont(ctx, fontSize, profileFont, false);
	ctx.fillText(
		username,
		x + paddingH + iconSize + iconTextGap,
		y + paddingV + textMetrics.height,
	);
}

export async function generateUserProfileImage(
	user: GuildMember,
	ddUser: DDUser,
	githubUsername?: string | null,
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

	// Draw GitHub badge if available
	if (githubUsername) {
		const badgeX =
			displayNameX + displayNameSize.width + 8 + (roleIcon ? 40 : 0);
		const badgeY = displayNameY - displayNameSize.height - 2;
		await drawGitHubBadge(ctx, githubUsername, badgeX, badgeY);
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
	try {
		// Read SVG file

		// Import canvg
		const pngBuffer = await sharp(Buffer.from(svgContent))
			.resize(size, size)
			.png()
			.toBuffer();

		await loadAndDrawImage(ctx, pngBuffer, x, y, size, size);
	} catch (error) {
		console.error("Error drawing SVG:", error);
	}
}

export async function getProfileEmbed(user: GuildMember) {
	const ddUser = await getOrCreateUserById(BigInt(user.id));
	const image = await generateUserProfileImage(
		user,
		ddUser,
		ddUser.githubUsername,
	);

	return {
		image,
		githubUsername: ddUser.githubUsername,
	};
}
