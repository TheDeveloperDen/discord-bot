import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import type { ChatInputCommandInteraction, User } from "discord.js";
import { MessageFlags } from "discord.js";
import type { ExecutableSubcommand } from "djs-slash-helper";
import {
	clearUserCache,
	DDUser,
	getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import { createMockUser } from "../../tests/mocks/discord.js";
import { GitHubCommand } from "./github.command.js";

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

const subcommands = GitHubCommand.options as ExecutableSubcommand[];
const unlinkSubcommand = subcommands.find((option) => option.name === "unlink");
const adminUnlinkSubcommand = subcommands.find(
	(option) => option.name === "admin-unlink",
);

if (!unlinkSubcommand || !adminUnlinkSubcommand) {
	throw new Error("GitHub unlink subcommands must be registered");
}

type Reply = (response: unknown) => Promise<void>;

async function linkUser(userId: string, githubUsername: string) {
	const ddUser = await getOrCreateUserById(BigInt(userId));
	ddUser.githubId = `github-${userId}`;
	ddUser.githubUsername = githubUsername;
	await ddUser.save();
}

async function getPersistedUser(userId: string) {
	return await DDUser.findByPk(BigInt(userId));
}

function createSelfUnlinkInteraction(user: User, reply: Reply) {
	return {
		user,
		reply,
	} as unknown as ChatInputCommandInteraction;
}

function createAdminUnlinkInteraction(
	administrator: User,
	targetUser: User,
	reply: Reply,
) {
	return {
		user: administrator,
		options: {
			getUser: mock(() => targetUser),
		},
		reply,
	} as unknown as ChatInputCommandInteraction;
}

describe("GitHubCommand unlink notifications", () => {
	test("self unlink persists the removal before DMing the linked user", async () => {
		const userId = "1001";
		const send = mock(async () => {
			expect(await getPersistedUser(userId)).toMatchObject({
				githubId: null,
				githubUsername: null,
			});
			return {};
		});
		const user = { ...createMockUser({ id: userId }), send } as unknown as User;
		const reply = mock(async () => {});
		await linkUser(user.id, "octocat");

		await unlinkSubcommand.handle(createSelfUnlinkInteraction(user, reply));

		expect(await getPersistedUser(user.id)).toMatchObject({
			githubId: null,
			githubUsername: null,
		});
		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith(
			"Your GitHub account **octocat** has been unlinked from your Developer Den profile.",
		);
		expect(reply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
			content:
				"✅ Successfully unlinked GitHub account **octocat** from your profile.",
		});
	});

	test("admin unlink persists the removal and identifies administrator action to the target", async () => {
		const administrator = createMockUser({ id: "2001" });
		const send = mock(async () => ({}));
		const targetUser = {
			...createMockUser({ id: "2002" }),
			send,
		} as unknown as User;
		const reply = mock(async () => {});
		await linkUser(targetUser.id, "hubot");

		await adminUnlinkSubcommand.handle(
			createAdminUnlinkInteraction(administrator, targetUser, reply),
		);

		expect(await getPersistedUser(targetUser.id)).toMatchObject({
			githubId: null,
			githubUsername: null,
		});
		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith(
			"Your GitHub account **hubot** has been unlinked from your Developer Den profile by an administrator.",
		);
		expect(reply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
			content:
				"✅ Successfully unlinked GitHub account **hubot** from <@2002>.",
		});
	});

	test("unlinking an account with no link does not DM", async () => {
		const send = mock(async () => ({}));
		const user = { ...createMockUser({ id: "3001" }), send } as unknown as User;
		const reply = mock(async () => {});

		await unlinkSubcommand.handle(createSelfUnlinkInteraction(user, reply));

		expect(await getPersistedUser(user.id)).toMatchObject({
			githubId: null,
			githubUsername: null,
		});
		expect(send).not.toHaveBeenCalled();
		expect(reply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
			content: "❌ You don't have a GitHub account linked. Nothing to unlink.",
		});
	});

	test("a failed self-unlink DM preserves the saved removal and success reply", async () => {
		const send = mock(async () => {
			throw new Error("DMs disabled");
		});
		const user = { ...createMockUser({ id: "4001" }), send } as unknown as User;
		const reply = mock(async () => {});
		await linkUser(user.id, "dependabot");

		await unlinkSubcommand.handle(createSelfUnlinkInteraction(user, reply));

		expect(await getPersistedUser(user.id)).toMatchObject({
			githubId: null,
			githubUsername: null,
		});
		expect(send).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
			content:
				"✅ Successfully unlinked GitHub account **dependabot** from your profile.",
		});
	});

	test("a failed interaction reply still sends the saved unlink notification", async () => {
		const send = mock(async () => ({}));
		const user = { ...createMockUser({ id: "5001" }), send } as unknown as User;
		const reply = mock(async () => {
			throw new Error("Interaction expired");
		});
		await linkUser(user.id, "actions");

		let replyError: unknown;
		try {
			await unlinkSubcommand.handle(createSelfUnlinkInteraction(user, reply));
		} catch (error) {
			replyError = error;
		}
		expect(replyError).toEqual(new Error("Interaction expired"));

		expect(await getPersistedUser(user.id)).toMatchObject({
			githubId: null,
			githubUsername: null,
		});
		expect(send).toHaveBeenCalledWith(
			"Your GitHub account **actions** has been unlinked from your Developer Den profile.",
		);
	});
});
