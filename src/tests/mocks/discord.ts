import { mock } from "bun:test";
import type {
	Client,
	Collection,
	Guild,
	GuildMember,
	Message,
	PartialTextBasedChannelFields,
	Role,
	TextChannel,
	User,
} from "discord.js";

export function createMockUser(
	overrides?: Partial<{
		id: string;
		bot: boolean;
		username: string;
		tag: string;
		discriminator: string;
	}>,
): User {
	const userId = overrides?.id ?? "123456789";
	const mockUser = {
		id: userId,
		bot: overrides?.bot ?? false,
		username: overrides?.username ?? "testuser",
		tag: overrides?.tag ?? "testuser#0000",
		discriminator: overrides?.discriminator ?? "0",
		toString: () => `<@${userId}>`,
		// Add roles cache for cases where the user is treated as a GuildMember-like object
		roles: {
			cache: {
				has: () => false,
			},
		},
		user: undefined as unknown, // Will be set below
	};
	// Self-reference for when used as GuildMember.user
	mockUser.user = mockUser;
	return mockUser as unknown as User;
}

export function createMockRole(
	overrides?: Partial<{
		id: string;
		name: string;
		position: number;
	}>,
): Role {
	return {
		id: overrides?.id ?? "role-123",
		name: overrides?.name ?? "Test Role",
		position: overrides?.position ?? 1,
		toString: () => `<@&${overrides?.id ?? "role-123"}>`,
	} as unknown as Role;
}

export function createMockRolesCache(
	roles: Map<string, Role>,
): Collection<string, Role> {
	return {
		clone: () => createMockRolesCache(new Map(roles)),
		delete: (key: string) => roles.delete(key),
		set: (key: string, value: Role) => roles.set(key, value),
		get: (key: string) => roles.get(key),
		has: (key: string) => roles.has(key),
		some: (fn: (role: Role) => boolean) => Array.from(roles.values()).some(fn),
		values: () => roles.values(),
		keys: () => roles.keys(),
		entries: () => roles.entries(),
		forEach: (fn: (value: Role, key: string) => void) => roles.forEach(fn),
		size: roles.size,
		[Symbol.iterator]: () => roles.entries(),
	} as unknown as Collection<string, Role>;
}

export function createMockGuild(
	overrides?: Partial<{
		id: string;
		roles: Map<string, Role>;
		members: Map<string, GuildMember>;
	}>,
): Guild {
	const roles = overrides?.roles ?? new Map();
	const members = overrides?.members ?? new Map();

	return {
		id: overrides?.id ?? "guild-123",
		roles: {
			cache: createMockRolesCache(roles),
			fetch: mock(async (id: string) => roles.get(id) ?? null),
		},
		members: {
			cache: members,
			fetch: mock(async (id: string) => members.get(id) ?? null),
		},
		bans: {
			remove: mock(async () => {}),
		},
	} as unknown as Guild;
}

export function createMockGuildMember(
	overrides?: Partial<{
		id: string;
		user: User;
		nickname: string | null;
		roles: string[];
		premiumSince: Date | null;
		client: Client;
		guild: Guild;
	}>,
): GuildMember {
	const user = overrides?.user ?? createMockUser({ id: overrides?.id });
	const roleIds = overrides?.roles ?? [];

	return {
		id: overrides?.id ?? user.id,
		user,
		nickname: overrides?.nickname ?? null,
		premiumSince: overrides?.premiumSince ?? null,
		client: overrides?.client ?? createMockClient(),
		guild: overrides?.guild ?? createMockGuild(),
		roles: {
			cache: {
				has: (roleId: string) => roleIds.includes(roleId),
				some: (fn: (role: Role) => boolean) =>
					roleIds.some((id) => fn(createMockRole({ id }))),
			},
		},
		toString: () => `<@${overrides?.id ?? user.id}>`,
	} as unknown as GuildMember;
}

export function createMockTextChannel(
	overrides?: Partial<{
		id: string;
		send: (content: unknown) => Promise<Message>;
		isSendable: () => boolean;
	}>,
): TextChannel & PartialTextBasedChannelFields {
	return {
		id: overrides?.id ?? "channel-123",
		send: overrides?.send ?? mock(async (_content: unknown) => ({}) as Message),
		isSendable: overrides?.isSendable ?? (() => true),
		type: 0, // GuildText
	} as unknown as TextChannel & PartialTextBasedChannelFields;
}

export function createMockClient(
	overrides?: Partial<{
		channels: Map<string, TextChannel>;
		guilds: Map<string, Guild>;
		users: Map<string, User>;
	}>,
): Client {
	const channels = overrides?.channels ?? new Map();
	const guilds = overrides?.guilds ?? new Map();
	const users = overrides?.users ?? new Map();

	return {
		channels: {
			cache: channels,
			fetch: mock(async (id: string) => channels.get(id) ?? null),
		},
		guilds: {
			cache: guilds,
			fetch: mock(async (id: string) => {
				const guild = guilds.get(id);
				if (guild) return guild;
				// Return a default mock guild if not found
				return createMockGuild({ id });
			}),
		},
		users: {
			cache: users,
			fetch: mock(async (id: string) => {
				const user = users.get(id);
				if (user) return user;
				return createMockUser({ id });
			}),
		},
	} as unknown as Client;
}

export function createMockMessage(
	overrides?: Partial<{
		id: string;
		content: string;
		author: User;
		channel: TextChannel & PartialTextBasedChannelFields;
		react: () => Promise<void>;
		interaction: { commandName: string; user: User } | null;
		interactionMetadata: { user: User; type: number } | null;
	}>,
): Message & { channel: PartialTextBasedChannelFields } {
	const author = overrides?.author ?? createMockUser();
	const channel = overrides?.channel ?? createMockTextChannel();

	return {
		id: overrides?.id ?? "message-123",
		content: overrides?.content ?? "",
		author,
		channel,
		react: overrides?.react ?? mock(async () => {}),
		interaction: overrides?.interaction ?? null,
		interactionMetadata: overrides?.interactionMetadata ?? null,
		inGuild: () => true,
		delete: mock(async () => {}),
		createdTimestamp: Date.now(),
	} as unknown as Message & { channel: PartialTextBasedChannelFields };
}
