import { describe, expect, mock, test } from "bun:test";
import { Buffer } from "node:buffer";
import {
	AttachmentBuilder,
	ChannelType,
	type Client,
	Collection,
	type GuildMember,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import { config } from "../../Config.js";
import {
	ModMailTicket,
	ModMailTicketCategory,
	ModMailTicketStatus,
} from "../../store/models/ModMailTicket.js";
import {
	closeModMailTicketByModMail,
	sendArchiveToServer,
} from "../modmail/modmail.js";
import {
	isModMailThreadSealedForRemoval,
	withModMailThreadLock,
} from "../modmail/modmailThreadLock.js";
import type { EventListener } from "../module.js";
import { RemoveSupportThreadCommand } from "./supportThreadRemoval.command.js";
import {
	createSupportThreadRemovalListener,
	type SupportThreadRemovalDependencies,
} from "./supportThreadRemoval.listener.js";

const supportParentId = config.modmail.channel;
const moderatorId = "100000000000000001";
const creatorId = "100000000000000002";
const threadId = "100000000000000003";

interface TestParent {
	id: string | null;
	type: ChannelType;
}

interface TestThread {
	id: string;
	name: string;
	guildId: string;
	parentId: string | null;
	manageable: boolean;
	archived: boolean;
	locked: boolean;
	isThread(): boolean;
	permissionsFor(member: GuildMember | { id: string }): {
		has(permission: bigint): boolean;
	};
	messages: {
		fetch(options: {
			limit: number;
		}): Promise<Collection<string, { id: string }>>;
	};
	setArchived(archived: boolean, reason?: string): Promise<unknown>;
	setLocked(locked: boolean, reason?: string): Promise<unknown>;
	delete(reason?: string): Promise<unknown>;
}

interface TestThreadBundle {
	parent: TestParent;
	thread: TestThread;
}

interface TestThreadOverrides {
	parentId?: string | null;
	parentType?: ChannelType;
	manageable?: boolean;
	archived?: boolean;
	locked?: boolean;
	effectiveCanManageThreads?: boolean;
	effectiveCanReadMessageHistory?: boolean;
	getLatestMessageId?: () => string | null;
	setArchived?: (archived: boolean, reason?: string) => Promise<unknown>;
	setLocked?: (locked: boolean, reason?: string) => Promise<unknown>;
	deleteThread?: (reason?: string) => Promise<unknown>;
}

interface SelectInteractionOverrides {
	value?: string;
	customId?: string;
	canManageThreads?: boolean;
	fetchThread?: unknown;
	creatorSend?: (payload: unknown) => Promise<unknown>;
}

interface DependencyOverrides {
	getActiveModMailByChannel?: SupportThreadRemovalDependencies["getActiveModMailByChannel"];
	createArchiveAttachment?: SupportThreadRemovalDependencies["createArchiveAttachment"];
	closeModMailTicketByModMail?: SupportThreadRemovalDependencies["closeModMailTicketByModMail"];
	sendArchiveToServer?: SupportThreadRemovalDependencies["sendArchiveToServer"];
}

function createMember(canManageThreads: boolean): GuildMember {
	return {
		permissions: {
			has: (permission: bigint) =>
				permission === PermissionFlagsBits.ManageThreads && canManageThreads,
		},
	} as unknown as GuildMember;
}

function createThread(overrides?: TestThreadOverrides): TestThreadBundle {
	const parentId = overrides?.parentId ?? supportParentId;
	const parent = {
		id: parentId,
		type: overrides?.parentType ?? ChannelType.GuildText,
	};
	const thread: TestThread = {
		id: threadId,
		name: "QUESTION - support request",
		guildId: "guild-1",
		parentId,
		manageable: overrides?.manageable ?? true,
		archived: overrides?.archived ?? false,
		locked: overrides?.locked ?? false,
		isThread: () => true,
		permissionsFor: () => ({
			has: (permission: bigint) => {
				if (permission === PermissionFlagsBits.ManageThreads) {
					return overrides?.effectiveCanManageThreads ?? true;
				}
				if (permission === PermissionFlagsBits.ReadMessageHistory) {
					return overrides?.effectiveCanReadMessageHistory ?? true;
				}
				return false;
			},
		}),
		messages: {
			fetch: mock(async () => {
				const latestMessageId = overrides?.getLatestMessageId
					? overrides.getLatestMessageId()
					: "latest-message";
				return latestMessageId == null
					? new Collection<string, { id: string }>()
					: new Collection<string, { id: string }>([
							[latestMessageId, { id: latestMessageId }],
						]);
			}),
		},
		setArchived: mock(async (archived: boolean, reason?: string) => {
			await overrides?.setArchived?.(archived, reason);
			thread.archived = archived;
			return thread;
		}),
		setLocked: mock(async (locked: boolean, reason?: string) => {
			await overrides?.setLocked?.(locked, reason);
			thread.locked = locked;
			return thread;
		}),
		delete: mock(overrides?.deleteThread ?? (async () => {})),
	};
	return { parent, thread };
}

function createTicket(): ModMailTicket {
	return ModMailTicket.build({
		creatorId: BigInt(creatorId),
		threadId: BigInt(threadId),
		category: ModMailTicketCategory.QUESTION,
		status: ModMailTicketStatus.OPEN,
	});
}

function createDependencies(overrides?: DependencyOverrides) {
	const ticket = createTicket();
	const archive = new AttachmentBuilder(Buffer.from("ticket transcript"), {
		name: "ticket.html",
	});
	const getActiveModMailByChannel = mock(
		overrides?.getActiveModMailByChannel ?? (async () => ticket),
	);
	const createArchiveAttachment = mock(
		overrides?.createArchiveAttachment ??
			(async () => ({
				success: true,
				attachment: archive,
				messageCount: 2,
				latestMessageId: "latest-message",
			})),
	);
	const closeModMailTicketByModMail = mock(
		overrides?.closeModMailTicketByModMail ??
			(async (modMail: ModMailTicket) => modMail),
	);
	const sendArchiveToServer = mock(
		overrides?.sendArchiveToServer ?? (async () => {}),
	);
	const dependencies: SupportThreadRemovalDependencies = {
		getActiveModMailByChannel,
		createArchiveAttachment,
		closeModMailTicketByModMail,
		sendArchiveToServer,
	};
	return {
		archive,
		closeModMailTicketByModMail,
		createArchiveAttachment,
		getActiveModMailByChannel,
		listener: createSupportThreadRemovalListener(dependencies),
		sendArchiveToServer,
		ticket,
	};
}

function createCommandInteraction(
	thread: TestThread,
	parent: TestParent,
	canManageThreads = true,
) {
	const reply = mock(async (_payload: unknown) => {});
	return {
		interaction: {
			inGuild: () => true,
			member: createMember(canManageThreads),
			user: { id: moderatorId },
			targetMessage: { channel: thread },
			client: { channels: { fetch: mock(async () => parent) } },
			reply,
		},
		reply,
	};
}

function createSelectInteraction(
	thread: TestThread,
	parent: TestParent,
	overrides?: SelectInteractionOverrides,
) {
	const deferUpdate = mock(async () => {});
	const editReply = mock(async (_payload: unknown) => {});
	const creatorSend = mock(overrides?.creatorSend ?? (async () => {}));
	const fetchUser = mock(async (id: string) => {
		if (id !== creatorId) throw new Error(`Unexpected user ${id}`);
		return { send: creatorSend };
	});
	return {
		interaction: {
			isStringSelectMenu: () => true,
			customId:
				overrides?.customId ??
				`remove-support-thread:${thread.id}:${moderatorId}`,
			values: [overrides?.value ?? "advertising"],
			inGuild: () => true,
			guild: { id: "guild-1" },
			member: createMember(overrides?.canManageThreads ?? true),
			user: { id: moderatorId, tag: "moderator#0001" },
			client: {
				channels: {
					fetch: mock(async (id: string) =>
						id === thread.id ? (overrides?.fetchThread ?? thread) : parent,
					),
				},
				users: { fetch: fetchUser },
				user: { id: "bot-user" },
			},
			deferUpdate,
			editReply,
		},
		creatorSend,
		deferUpdate,
		editReply,
		fetchUser,
	};
}

async function invokeListener(listener: EventListener, interaction: unknown) {
	await listener.interactionCreate?.({} as never, interaction as never);
}

describe("RemoveSupportThreadCommand", () => {
	test("shows the reason menu for a ModMail public thread", async () => {
		const { parent, thread } = createThread();
		const { interaction, reply } = createCommandInteraction(thread, parent);

		await RemoveSupportThreadCommand.handle(interaction as never);

		const response = reply.mock.calls[0]?.[0] as {
			flags: MessageFlags;
			components: Array<{ components: Array<{ data: { custom_id: string } }> }>;
		};
		expect(response.flags).toBe(MessageFlags.Ephemeral);
		expect(response.components[0]?.components[0]?.data.custom_id).toBe(
			`remove-support-thread:${threadId}:${moderatorId}`,
		);
	});

	test("rejects threads outside the configured ModMail text channel", async () => {
		const wrongParent = createThread({ parentId: "100000000000000099" });
		const forumParent = createThread({ parentType: ChannelType.GuildForum });
		const wrongParentInteraction = createCommandInteraction(
			wrongParent.thread,
			wrongParent.parent,
		);
		const forumInteraction = createCommandInteraction(
			forumParent.thread,
			forumParent.parent,
		);

		await RemoveSupportThreadCommand.handle(
			wrongParentInteraction.interaction as never,
		);
		await RemoveSupportThreadCommand.handle(
			forumInteraction.interaction as never,
		);

		expect(wrongParentInteraction.reply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining("ModMail") }),
		);
		expect(forumInteraction.reply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining("ModMail") }),
		);
	});

	test("honors parent-channel permission overwrites", async () => {
		const denied = createThread({ effectiveCanManageThreads: false });
		const granted = createThread({ effectiveCanManageThreads: true });
		const deniedInteraction = createCommandInteraction(
			denied.thread,
			denied.parent,
			true,
		);
		const grantedInteraction = createCommandInteraction(
			granted.thread,
			granted.parent,
			false,
		);

		await RemoveSupportThreadCommand.handle(
			deniedInteraction.interaction as never,
		);
		await RemoveSupportThreadCommand.handle(
			grantedInteraction.interaction as never,
		);

		expect(deniedInteraction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("Manage Threads"),
			}),
		);
		expect(grantedInteraction.reply.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({ components: expect.any(Array) }),
		);
	});
});

describe("SupportThreadRemovalListener", () => {
	test("cancels and rejects stale selections without side effects", async () => {
		const { parent, thread } = createThread();
		const dependencies = createDependencies();
		const canceled = createSelectInteraction(thread, parent, {
			value: "cancel",
		});
		const stale = createSelectInteraction(thread, parent, {
			customId: `remove-support-thread:${threadId}:another-moderator`,
		});

		await invokeListener(dependencies.listener, canceled.interaction);
		await invokeListener(dependencies.listener, stale.interaction);

		expect(dependencies.getActiveModMailByChannel).not.toHaveBeenCalled();
		expect(canceled.creatorSend).not.toHaveBeenCalled();
		expect(thread.delete).not.toHaveBeenCalled();
		expect(canceled.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("cancelled"),
			}),
		);
		expect(stale.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("no longer valid"),
			}),
		);
	});

	test("archives the conversation, DMs the ticket creator, closes, then deletes", async () => {
		const sequence: string[] = [];
		const { parent, thread } = createThread({
			deleteThread: async () => {
				sequence.push("delete");
			},
		});
		const ticket = createTicket();
		const dependencies = createDependencies({
			createArchiveAttachment: async () => {
				sequence.push("archive");
				return {
					success: true,
					attachment: new AttachmentBuilder(Buffer.from("full conversation"), {
						name: "ticket.html",
					}),
					messageCount: 4,
					latestMessageId: "latest-message",
				};
			},
			getActiveModMailByChannel: async () => ticket,
			closeModMailTicketByModMail: async (modMail) => {
				sequence.push("close");
				return modMail;
			},
			sendArchiveToServer: async () => {
				sequence.push("server");
			},
		});
		const selected = createSelectInteraction(thread, parent, {
			creatorSend: async () => {
				sequence.push("dm");
			},
		});

		await invokeListener(dependencies.listener, selected.interaction);

		expect(sequence).toEqual(["archive", "dm", "server", "close", "delete"]);
		expect(dependencies.getActiveModMailByChannel).toHaveBeenCalledWith(
			BigInt(threadId),
		);
		expect(dependencies.createArchiveAttachment).toHaveBeenCalledWith(
			thread,
			ticket,
		);
		expect(dependencies.sendArchiveToServer).toHaveBeenCalledWith(
			selected.interaction.client,
			ticket,
			expect.any(AttachmentBuilder),
			thread.name,
		);
		expect(selected.fetchUser).toHaveBeenCalledWith(creatorId);
		const dmPayload = selected.creatorSend.mock.calls[0]?.[0] as {
			content: string;
			files: AttachmentBuilder[];
			embeds: Array<{ data: { description: string } }>;
		};
		expect(dmPayload.content).toContain("recoverable copy of the conversation");
		expect(dmPayload.files).toHaveLength(1);
		expect(dmPayload.embeds[0]?.data.description).toContain(
			"promotional tickets",
		);
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining("removed") }),
		);
		expect(thread.archived).toBe(true);
		expect(thread.setArchived).toHaveBeenCalledWith(true, expect.any(String));
		expect(thread.locked).toBe(true);
		expect(thread.setLocked).toHaveBeenCalledWith(true, expect.any(String));
	});

	test("rechecks effective Manage Threads permission before doing work", async () => {
		const { parent, thread } = createThread({
			effectiveCanManageThreads: false,
		});
		const dependencies = createDependencies();
		const selected = createSelectInteraction(thread, parent, {
			canManageThreads: true,
		});

		await invokeListener(dependencies.listener, selected.interaction);

		expect(dependencies.getActiveModMailByChannel).not.toHaveBeenCalled();
		expect(selected.creatorSend).not.toHaveBeenCalled();
		expect(thread.delete).not.toHaveBeenCalled();
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("Manage Threads"),
			}),
		);
	});

	test("refuses removal without effective Read Message History permission", async () => {
		const { parent, thread } = createThread({
			effectiveCanReadMessageHistory: false,
		});
		const dependencies = createDependencies();
		const selected = createSelectInteraction(thread, parent);

		await invokeListener(dependencies.listener, selected.interaction);

		expect(dependencies.getActiveModMailByChannel).not.toHaveBeenCalled();
		expect(dependencies.createArchiveAttachment).not.toHaveBeenCalled();
		expect(selected.creatorSend).not.toHaveBeenCalled();
		expect(thread.delete).not.toHaveBeenCalled();
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("complete message history"),
			}),
		);
	});

	test("rejects an inactive ticket without preservation or deletion", async () => {
		const { parent, thread } = createThread();
		const dependencies = createDependencies({
			getActiveModMailByChannel: async () => null,
		});
		const selected = createSelectInteraction(thread, parent);

		await invokeListener(dependencies.listener, selected.interaction);

		expect(dependencies.createArchiveAttachment).not.toHaveBeenCalled();
		expect(selected.creatorSend).not.toHaveBeenCalled();
		expect(dependencies.closeModMailTicketByModMail).not.toHaveBeenCalled();
		expect(thread.delete).not.toHaveBeenCalled();
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("not an active"),
			}),
		);
	});

	test("leaves the ticket open when transcript creation fails", async () => {
		const { parent, thread } = createThread();
		const dependencies = createDependencies({
			createArchiveAttachment: async () => ({
				success: false,
				error: "history unavailable",
			}),
		});
		const selected = createSelectInteraction(thread, parent);

		await invokeListener(dependencies.listener, selected.interaction);

		expect(selected.creatorSend).not.toHaveBeenCalled();
		expect(dependencies.closeModMailTicketByModMail).not.toHaveBeenCalled();
		expect(thread.delete).not.toHaveBeenCalled();
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("recoverable copy"),
			}),
		);
		expect(thread.archived).toBe(false);
		expect(thread.locked).toBe(false);
		expect(thread.setLocked).toHaveBeenNthCalledWith(
			1,
			true,
			expect.any(String),
		);
		expect(thread.setLocked).toHaveBeenNthCalledWith(
			2,
			false,
			expect.any(String),
		);
		expect(thread.setArchived).toHaveBeenNthCalledWith(
			1,
			true,
			expect.any(String),
		);
		expect(thread.setArchived).toHaveBeenNthCalledWith(
			2,
			false,
			expect.any(String),
		);
	});

	test("leaves the ticket open when the creator cannot receive the archive", async () => {
		const { parent, thread } = createThread();
		const dependencies = createDependencies();
		const selected = createSelectInteraction(thread, parent, {
			creatorSend: async () => {
				throw new Error("DMs disabled");
			},
		});

		await invokeListener(dependencies.listener, selected.interaction);

		expect(dependencies.closeModMailTicketByModMail).not.toHaveBeenCalled();
		expect(thread.delete).not.toHaveBeenCalled();
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("still open"),
			}),
		);
	});

	test("keeps the ticket open when the server archive cannot be delivered", async () => {
		const { parent, thread } = createThread();
		const dependencies = createDependencies({
			sendArchiveToServer: async () => {
				throw new Error("archive channel unavailable");
			},
		});
		const selected = createSelectInteraction(thread, parent);

		await invokeListener(dependencies.listener, selected.interaction);

		expect(selected.creatorSend).toHaveBeenCalledTimes(1);
		expect(dependencies.sendArchiveToServer).toHaveBeenCalledTimes(1);
		expect(dependencies.closeModMailTicketByModMail).not.toHaveBeenCalled();
		expect(thread.delete).not.toHaveBeenCalled();
		expect(thread.archived).toBe(false);
		expect(thread.locked).toBe(false);
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("server archive"),
			}),
		);
	});

	test("keeps an active ticket when its thread changes during archive delivery", async () => {
		let latestMessageId = "latest-message";
		const { parent, thread } = createThread({
			getLatestMessageId: () => latestMessageId,
		});
		const dependencies = createDependencies();
		const selected = createSelectInteraction(thread, parent, {
			creatorSend: async () => {
				latestMessageId = "new-message";
			},
		});

		await invokeListener(dependencies.listener, selected.interaction);

		expect(selected.creatorSend).toHaveBeenCalledTimes(1);
		expect(dependencies.closeModMailTicketByModMail).not.toHaveBeenCalled();
		expect(thread.delete).not.toHaveBeenCalled();
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("changed"),
			}),
		);
	});

	test("does not delete after a database close failure", async () => {
		const { parent, thread } = createThread();
		const dependencies = createDependencies({
			closeModMailTicketByModMail: async () => {
				throw new Error("database unavailable");
			},
		});
		const selected = createSelectInteraction(thread, parent);

		await invokeListener(dependencies.listener, selected.interaction);

		expect(selected.creatorSend).toHaveBeenCalledTimes(1);
		expect(thread.delete).not.toHaveBeenCalled();
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("could not close"),
			}),
		);
	});

	test("seals the ticket against new relays during the close/delete commit", async () => {
		let announceClose: (() => void) | undefined;
		let releaseClose: (() => void) | undefined;
		const closeStarted = new Promise<void>((resolve) => {
			announceClose = resolve;
		});
		const closeCanFinish = new Promise<void>((resolve) => {
			releaseClose = resolve;
		});
		const { parent, thread } = createThread();
		const dependencies = createDependencies({
			closeModMailTicketByModMail: async (modMail) => {
				announceClose?.();
				await closeCanFinish;
				return modMail;
			},
		});
		const selected = createSelectInteraction(thread, parent);

		const removal = invokeListener(dependencies.listener, selected.interaction);
		await closeStarted;

		expect(isModMailThreadSealedForRemoval(threadId)).toBe(true);
		expect(thread.archived).toBe(true);

		releaseClose?.();
		await removal;

		expect(isModMailThreadSealedForRemoval(threadId)).toBe(false);
		expect(thread.delete).toHaveBeenCalledTimes(1);
	});

	test("reports a closed ticket with retained thread when deletion fails", async () => {
		const { parent, thread } = createThread({
			deleteThread: async () => {
				throw new Error("missing permission");
			},
		});
		const dependencies = createDependencies();
		const selected = createSelectInteraction(thread, parent);

		await invokeListener(dependencies.listener, selected.interaction);

		expect(selected.creatorSend).toHaveBeenCalledTimes(1);
		expect(dependencies.closeModMailTicketByModMail).toHaveBeenCalledTimes(1);
		expect(thread.delete).toHaveBeenCalledTimes(1);
		expect(selected.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("ticket was closed"),
			}),
		);
	});

	test("prevents an overlapping removal while ticket lookup is pending", async () => {
		const { parent, thread } = createThread();
		const ticket = createTicket();
		let announceLookup: (() => void) | undefined;
		let releaseLookup: ((ticket: ModMailTicket) => void) | undefined;
		const lookupStarted = new Promise<void>((resolve) => {
			announceLookup = resolve;
		});
		const pendingTicket = new Promise<ModMailTicket>((resolve) => {
			releaseLookup = resolve;
		});
		const dependencies = createDependencies({
			getActiveModMailByChannel: async () => {
				announceLookup?.();
				return pendingTicket;
			},
		});
		const first = createSelectInteraction(thread, parent);
		const overlapping = createSelectInteraction(thread, parent);

		const firstRemoval = invokeListener(
			dependencies.listener,
			first.interaction,
		);
		await lookupStarted;
		await invokeListener(dependencies.listener, overlapping.interaction);
		releaseLookup?.(ticket);
		await firstRemoval;

		expect(overlapping.editReply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("already in progress"),
			}),
		);
		expect(first.creatorSend).toHaveBeenCalledTimes(1);
		expect(dependencies.closeModMailTicketByModMail).toHaveBeenCalledTimes(1);
		expect(thread.delete).toHaveBeenCalledTimes(1);
	});

	test("keeps the ticket open when another relay queues during removal", async () => {
		const sequence: string[] = [];
		let releaseArchive: (() => void) | undefined;
		let announceArchive: (() => void) | undefined;
		const archiveStarted = new Promise<void>((resolve) => {
			announceArchive = resolve;
		});
		const archiveCanFinish = new Promise<void>((resolve) => {
			releaseArchive = resolve;
		});
		const { parent, thread } = createThread({
			deleteThread: async () => {
				sequence.push("delete");
			},
		});
		const dependencies = createDependencies({
			createArchiveAttachment: async () => {
				sequence.push("archive-start");
				announceArchive?.();
				await archiveCanFinish;
				sequence.push("archive-end");
				return {
					success: true,
					attachment: new AttachmentBuilder(Buffer.from("conversation"), {
						name: "ticket.html",
					}),
					messageCount: 2,
					latestMessageId: "latest-message",
				};
			},
			closeModMailTicketByModMail: async (modMail) => {
				sequence.push("close");
				return modMail;
			},
		});
		const selected = createSelectInteraction(thread, parent, {
			creatorSend: async () => {
				sequence.push("dm");
			},
		});

		const removal = invokeListener(dependencies.listener, selected.interaction);
		await archiveStarted;
		expect(selected.deferUpdate).toHaveBeenCalledTimes(1);
		const relay = withModMailThreadLock(threadId, async () => {
			sequence.push("relay");
		});
		await Promise.resolve();

		expect(sequence).toEqual(["archive-start"]);

		releaseArchive?.();
		await Promise.all([removal, relay]);

		expect(sequence).toEqual(["archive-start", "archive-end", "dm", "relay"]);
		expect(dependencies.closeModMailTicketByModMail).not.toHaveBeenCalled();
		expect(thread.delete).not.toHaveBeenCalled();
		expect(thread.archived).toBe(false);
	});
});

describe("ModMail server archive", () => {
	test("sends the preserved transcript and ticket context to the archive channel", async () => {
		const send = mock(async (_payload: unknown) => {});
		const channelFetch = mock(async () => ({
			isTextBased: () => true,
			isSendable: () => true,
			send,
		}));
		const guildFetch = mock(async () => ({
			channels: { fetch: channelFetch },
		}));
		const client = {
			guilds: { fetch: guildFetch },
		} as unknown as Client;
		const ticket = {
			id: 42,
			creatorId: BigInt(creatorId),
		} as ModMailTicket;
		const attachment = new AttachmentBuilder(
			Buffer.from("<html>archive</html>"),
			{
				name: "ticket.html",
			},
		);

		await sendArchiveToServer(client, ticket, attachment, "support-thread");

		expect(guildFetch).toHaveBeenCalledWith(config.guildId);
		expect(channelFetch).toHaveBeenCalledWith(config.modmail.archiveChannel);
		expect(send).toHaveBeenCalledTimes(1);
		const payload = send.mock.calls[0]?.[0] as {
			content: string;
			files: AttachmentBuilder[];
			components: { toJSON(): { components: { custom_id?: string }[] } }[];
		};
		expect(payload.content).toContain("support-thread");
		expect(payload.content).toContain("Ticket ID: 42");
		expect(payload.content).toContain(`<@${creatorId}>`);
		expect(payload.files[0]?.name).toBe("ticket.html");
		expect(payload.files[0]?.attachment).toEqual(
			Buffer.from("<html>archive</html>"),
		);
		expect(payload.components[0]?.toJSON().components[0]?.custom_id).toBe(
			"modmail-list-notes-archived-42",
		);
	});
});

describe("ModMail ticket closure", () => {
	test("persists the archived status before a removal can delete the thread", async () => {
		const ticket = await ModMailTicket.create({
			creatorId: BigInt("100000000000000011"),
			threadId: BigInt("100000000000000012"),
			category: ModMailTicketCategory.QUESTION,
			status: ModMailTicketStatus.OPEN,
		});
		const client = {
			guilds: {
				fetch: async () => ({ channels: { fetch: async () => null } }),
			},
		} as unknown as Client;

		try {
			await closeModMailTicketByModMail(ticket, client);
			await ticket.reload();

			expect(ticket.status).toBe(ModMailTicketStatus.ARCHIVED);
		} finally {
			await ticket.destroy({ force: true });
		}
	});
});
