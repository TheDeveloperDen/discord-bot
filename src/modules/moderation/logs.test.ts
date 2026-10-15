import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import {
	type APIMessageTopLevelComponent,
	type ButtonInteraction,
	type Client,
	Colors,
	ComponentType,
	type ModalSubmitInteraction,
	PermissionsBitField,
	type TextChannel,
	type User,
} from "discord.js";
import {
	clearUserCache,
	getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { Warning, WarningSeverity } from "../../store/models/Warning.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import {
	createMockTextChannel,
	createMockUser,
} from "../../tests/mocks/discord.js";
import { renderModerationLog } from "./logs.card.js";
import { logModerationAction, type ModerationLog } from "./logs.js";
import { UndoButton, UndoForm, withUndoneLine } from "./logs.undo.js";
import { pardonWarning } from "./undo.js";

type Payload = { components: APIMessageTopLevelComponent[] };

/** A user as `client.users.fetch` returns it, with what a card's header needs */
const fetchedUser = (id: string) =>
	Object.assign(createMockUser({ id }), {
		displayName: `user ${id}`,
		displayAvatarURL: () => `https://cdn/${id}.png`,
	}) as unknown as User;

const createTestContext = () => {
	const send = mock(async (payload: Payload) => payload);
	const channel = {
		...createMockTextChannel({ send }),
		isSendable: () => true,
	} as unknown as TextChannel;
	const client = {
		channels: { fetch: mock(async () => channel) },
		users: {
			fetch: mock(async (id: string) => fetchedUser(id)),
			resolveId: (target: string | { id: string }) =>
				typeof target === "string" ? target : target.id,
		},
	} as unknown as Client;
	return { client, send };
};

const moderator = createMockUser({ id: "12345" });
const target = createMockUser({ id: "67890" });

/** Sends `log` and returns the card's container, every text in it, and the custom ids of its buttons */
async function sendLog(log: ModerationLog) {
	const { client, send } = createTestContext();
	await logModerationAction(client, log);
	const payload = send.mock.calls[0]?.[0];
	if (!payload) throw new Error("nothing was sent");
	return inspect(payload.components);
}

function inspect(components: APIMessageTopLevelComponent[]) {
	const [container, row] = components;
	if (container?.type !== ComponentType.Container) {
		throw new Error("the log isn't a card");
	}
	const texts = container.components.flatMap((child) =>
		child.type === ComponentType.TextDisplay
			? [child.content]
			: child.type === ComponentType.Section
				? child.components.map((text) => text.content)
				: [],
	);
	const buttons =
		row?.type === ComponentType.ActionRow
			? row.components.flatMap((button) =>
					button.type === ComponentType.Button && "custom_id" in button
						? [{ customId: button.custom_id, disabled: !!button.disabled }]
						: [],
				)
			: [];
	return { container, text: texts.join("\n"), texts, buttons };
}

const ban: ModerationLog = {
	kind: "Ban",
	dmSent: true,
	moderator,
	target,
	deleteMessages: true,
	reason: "Breaking rules",
};

const warning = (severity: WarningSeverity): ModerationLog => ({
	kind: "Warning",
	dmSent: true,
	moderator,
	target,
	reason: "Spam",
	severity,
	warningId: 42,
	warningCount: 2,
	expiresAt: null,
});

describe("logModerationAction", () => {
	test.each<[ModerationLog, string, number]>([
		[ban, "Member Banned", Colors.Red],
		[
			{ kind: "Unban", moderator, target, reason: "Appeal accepted" },
			"Member Unbanned",
			Colors.Green,
		],
		[
			{
				kind: "TempBan",
				dmSent: true,
				moderator,
				target,
				deleteMessages: false,
				banDuration: 86_400_000,
			},
			"Member Tempbanned",
			Colors.Orange,
		],
		[
			{ kind: "Kick", dmSent: true, moderator, target },
			"Member Kicked",
			Colors.Yellow,
		],
		[
			{
				kind: "SoftBan",
				dmSent: true,
				moderator,
				target,
				deleteMessages: true,
			},
			"Member Softbanned",
			Colors.DarkOrange,
		],
		[
			{ kind: "TimeoutRemoved", dmSent: true, moderator, target },
			"Timeout Removed",
			Colors.Green,
		],
		[
			{ kind: "TempBanEnded", target: "67890" },
			"Tempban Expired",
			Colors.DarkGreen,
		],
	])("%#: renders a %p card", async (log, title, accent) => {
		const { container, texts } = await sendLog(log);
		expect(texts[0]).toBe(`## ${title}`);
		expect(container.accent_color).toBe(accent);
	});

	test("shows the target beside the reason, then the details", async () => {
		const { text } = await sendLog(ban);
		expect(text).toContain("<@67890>");
		expect(text).toContain("Breaking rules");
		expect(text).toContain("**Moderator:** <@12345>");
		expect(text).toContain("**Deleted messages:** Yes");
		expect(text).toContain("**DM sent:** ✅");
		expect(text).toContain("User ID: 67890");
	});

	test("shows a failed DM", async () => {
		const { text } = await sendLog({ ...ban, dmSent: false });
		expect(text).toContain("**DM sent:** ❌");
	});

	test("shows each kind's own details", async () => {
		const tempBan = await sendLog({
			kind: "TempBan",
			dmSent: true,
			moderator,
			target,
			deleteMessages: false,
			banDuration: 86_400_000,
		});
		expect(tempBan.text).toContain("**Ban duration:**");

		const invite = await sendLog({
			kind: "InviteDeleted",
			target,
			messageId: "123456789",
			messageCreatedTimestamp: Date.now(),
			edited: false,
			matches: ["discord.gg/server1", "discord.gg/server2"],
		});
		expect(invite.text).toContain(
			"**Invites:** discord.gg/server1, discord.gg/server2",
		);

		const warned = await sendLog(warning(WarningSeverity.MINOR));
		expect(warned.text).toContain("**Severity:** Minor");
		expect(warned.text).toContain("**Warning ID:** #42");
		expect(warned.text).toContain("**Expires:** Never");
	});

	test("accents a warning by its severity", async () => {
		const accents = await Promise.all(
			[
				WarningSeverity.MINOR,
				WarningSeverity.MODERATE,
				WarningSeverity.SEVERE,
			].map(
				async (severity) =>
					(await sendLog(warning(severity))).container.accent_color,
			),
		);
		expect(accents).toEqual([Colors.Gold, Colors.Orange, Colors.Red]);
	});

	test("gives bans, warnings and timeouts an undo button", async () => {
		const buttonsOf = async (log: ModerationLog) =>
			(await sendLog(log)).buttons.map((button) => button.customId);

		expect(await buttonsOf(ban)).toEqual(["modlog:undo:unban:67890"]);
		expect(
			await buttonsOf({
				kind: "InviteSpamBan",
				dmSent: true,
				target,
				violationCount: 4,
				channelCount: 1,
				violationWindowMs: 10_000,
				triggerReason: "same_channel",
			}),
		).toEqual(["modlog:undo:unban:67890"]);
		expect(await buttonsOf(warning(WarningSeverity.MINOR))).toEqual([
			"modlog:undo:pardon:42",
		]);
		expect(
			await buttonsOf({
				kind: "Timeout",
				dmSent: true,
				moderator,
				target,
				duration: 60_000,
				reason: "Calm down",
			}),
		).toEqual(["modlog:undo:untimeout:67890"]);
		expect(
			await buttonsOf({ kind: "Kick", dmSent: true, moderator, target }),
		).toEqual([]);
		expect(await buttonsOf({ kind: "TempBanEnded", target: "67890" })).toEqual(
			[],
		);
	});

	test("keeps a long reason within Discord's text limit", async () => {
		const { text } = await sendLog({ ...ban, reason: "a".repeat(5000) });
		expect(text.length).toBeLessThan(4000);
	});

	test("handles a missing mod log channel gracefully", async () => {
		const client = {
			channels: { fetch: mock(async () => null) },
		} as unknown as Client;
		await expect(logModerationAction(client, ban)).resolves.toBeUndefined();
	});
});

describe("withUndoneLine", () => {
	test("adds the line above the footer and disables the button", () => {
		const card = renderModerationLog(ban, "67890", fetchedUser("67890"))
			.components as unknown as APIMessageTopLevelComponent[];

		const { texts, buttons } = inspect(
			withUndoneLine(card, "**Unbanned** by <@1>"),
		);

		expect(texts.at(-2)).toBe("**Unbanned** by <@1>");
		expect(texts.at(-1)).toContain("User ID: 67890");
		expect(buttons).toEqual([
			{ customId: "modlog:undo:unban:67890", disabled: true },
		]);
	});
});

describe("undo permissions", () => {
	const withoutPermission = () => {
		const reply = mock(async (_options: unknown) => {});
		const showModal = mock(async (_modal: unknown) => {});
		const deferReply = mock(async (_options: unknown) => {});
		const interaction = {
			memberPermissions: new PermissionsBitField(),
			inCachedGuild: () => true,
			reply,
			showModal,
			deferReply,
		};
		return { interaction, reply, showModal, deferReply };
	};

	test("the button refuses members who can't undo", async () => {
		const { interaction, reply, showModal } = withoutPermission();
		await UndoButton.handle(interaction as unknown as ButtonInteraction, {
			action: "unban",
			targetId: "67890",
		});
		expect(showModal).not.toHaveBeenCalled();
		expect(reply.mock.calls[0]?.[0]).toMatchObject({
			content: "You don't have permission to do that.",
		});
	});

	test("the form refuses members who can't undo, before doing anything", async () => {
		const { interaction, reply, deferReply } = withoutPermission();
		await UndoForm.handle(interaction as unknown as ModalSubmitInteraction, {
			action: "pardon",
			targetId: "42",
		});
		expect(deferReply).not.toHaveBeenCalled();
		expect(reply.mock.calls[0]?.[0]).toMatchObject({
			content: "You don't have permission to do that.",
		});
	});
});

describe("pardonWarning", () => {
	beforeAll(async () => {
		await initStorage();
	});
	afterEach(async () => {
		await getSequelizeInstance().destroyAll();
		clearUserCache();
	});

	test("pardons a warning once, and reports a second pardon as already done", async () => {
		await getOrCreateUserById(67890n);
		const warned = await Warning.create({
			userId: 67890n,
			moderatorId: 12345n,
			reason: "Spam",
			severity: WarningSeverity.MINOR,
			expiresAt: null,
		});
		const { client } = createTestContext();
		const guild = { name: "Dev Den", client } as unknown as Parameters<
			typeof pardonWarning
		>[0];
		// the mock users can't be DMed, like a user who blocks the bot

		const first = await pardonWarning(guild, moderator, warned.id, "Appealed");
		const second = await pardonWarning(guild, moderator, warned.id, "Again");

		expect(first.ok).toBe(true);
		expect(second).toMatchObject({ ok: false, alreadyDone: true });
		await warned.reload();
		expect(warned).toMatchObject({ pardoned: true, pardonReason: "Appealed" });
	});
});
