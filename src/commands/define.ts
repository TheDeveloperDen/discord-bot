import {
	type APIApplicationCommandBasicOption,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type AutocompleteInteraction,
	type CacheType,
	type ChatInputCommandInteraction,
	type GuildMember,
	type MessageContextMenuCommandInteraction,
	MessageFlags,
	type RepliableInteraction,
	type UserContextMenuCommandInteraction,
} from "discord.js";
import { respondWithChoices } from "./autocomplete.js";
import type {
	Command,
	ExecutableSubcommand,
	ExecutableSubcommandGroup,
} from "./command.js";
import {
	type CommandOptions,
	isResolvedKind,
	type ParsedOptions,
} from "./options.js";

const GUILD_ONLY_MESSAGE = "This command can only be used in the server.";
const MEMBER_LEFT_MESSAGE = "That user isn't in this server.";

type CacheFor<G extends boolean> = G extends false ? CacheType : "cached";

type Handler<O extends CommandOptions, C extends CacheType> = (
	interaction: ChatInputCommandInteraction<C>,
	options: ParsedOptions<O, C>,
) => unknown;

interface BaseDefinition {
	name: string;
	description: string;
	/** Permissions a member needs by default, e.g. `PermissionFlagsBits.BanMembers`. `0n` means admins only */
	default_member_permissions?: bigint;
}

interface FlatDefinition<O extends CommandOptions, G extends boolean>
	extends BaseDefinition {
	/** Defaults to true. Guild-only commands only run in cached guilds, so their handlers get `<"cached">` types */
	guildOnly?: G;
	/** Keyed by option name, in the order Discord shows them. Required options must come first */
	options?: O;
	handle: Handler<O, CacheFor<G>>;
	subcommands?: never;
	groups?: never;
}

/** A subcommand declared with {@link subcommand}. Subcommands are always guild-only */
export interface Subcommand {
	description: string;
	options: CommandOptions;
	handle: Handler<CommandOptions, "cached">;
}

interface SubcommandDefinition extends BaseDefinition {
	subcommands?: Record<string, Subcommand>;
	groups?: Record<
		string,
		{ description: string; subcommands: Record<string, Subcommand> }
	>;
	options?: never;
	handle?: never;
	guildOnly?: never;
}

/** Declares a subcommand of a {@link defineCommand} command, keyed by its name there */
export function subcommand<
	O extends CommandOptions = Record<never, never>,
>(definition: {
	description: string;
	options?: O;
	handle: Handler<O, "cached">;
}): Subcommand {
	// the handler only ever receives options parsed from its own declarations
	return { options: {}, ...definition } as unknown as Subcommand;
}

/**
 * Declares a slash command. `handle` receives the options parsed and typed from their declarations.
 * Pass `subcommands` (and/or `groups`) instead of `options` and `handle` for a command with subcommands.
 */
export function defineCommand<
	O extends CommandOptions = Record<never, never>,
	G extends boolean = true,
>(definition: FlatDefinition<O, G>): Command<ApplicationCommandType.ChatInput>;
export function defineCommand(
	definition: SubcommandDefinition,
): Command<ApplicationCommandType.ChatInput>;
export function defineCommand(
	definition: FlatDefinition<CommandOptions, boolean> | SubcommandDefinition,
): Command<ApplicationCommandType.ChatInput> {
	const base = {
		type: ApplicationCommandType.ChatInput as const,
		name: definition.name,
		description: definition.description,
		default_member_permissions: definition.default_member_permissions,
	};
	if (definition.handle) {
		const options = definition.options ?? {};
		return {
			...base,
			options: rawOptions(definition.name, options),
			handle: compileHandler(
				options,
				definition.guildOnly ?? true,
				definition.handle as Handler<CommandOptions, CacheType>,
			),
			autocomplete: compileAutocomplete(options),
		};
	}
	const groups = Object.entries(definition.groups ?? {}).map(
		([name, group]): ExecutableSubcommandGroup => ({
			type: ApplicationCommandOptionType.SubcommandGroup,
			name,
			description: group.description,
			options: compileSubcommands(group.subcommands),
		}),
	);
	return {
		...base,
		options: [...compileSubcommands(definition.subcommands ?? {}), ...groups],
		handle() {},
	};
}

function compileSubcommands(
	subcommands: Record<string, Subcommand>,
): ExecutableSubcommand[] {
	return Object.entries(subcommands).map(([name, sub]) => ({
		type: ApplicationCommandOptionType.Subcommand,
		name,
		description: sub.description,
		options: rawOptions(name, sub.options),
		handle: compileHandler(
			sub.options,
			true,
			sub.handle as Handler<CommandOptions, CacheType>,
		),
		autocomplete: compileAutocomplete(sub.options),
	}));
}

/** Convert a {@link CommandOptions} into the format Discord expects */
function rawOptions(
	commandName: string,
	options: CommandOptions,
): APIApplicationCommandBasicOption[] {
	let seenOptional = false;
	return Object.entries(options).map(([name, option]) => {
		if (option.required && seenOptional) {
			throw new Error(
				`Option "${name}" of ${commandName} is required, so it must come before the optional options`,
			);
		}
		seenOptional ||= !option.required;
		return { ...option.raw, name } as APIApplicationCommandBasicOption;
	});
}

function compileHandler(
	options: CommandOptions,
	guildOnly: boolean,
	handle: Handler<CommandOptions, CacheType>,
) {
	return async (interaction: ChatInputCommandInteraction) => {
		if (guildOnly && !interaction.inCachedGuild()) {
			return await replyEphemeral(interaction, GUILD_ONLY_MESSAGE);
		}
		const parsed: Record<string, unknown> = {};
		for (const [name, option] of Object.entries(options)) {
			const value = interaction.options.get(name);
			if (value == null) continue;
			if (option.kind === "member" && value.member == null) {
				return await replyEphemeral(interaction, MEMBER_LEFT_MESSAGE);
			}
			parsed[name] = isResolvedKind(option.kind)
				? value[option.kind]
				: value.value;
		}
		return await handle(interaction, parsed);
	};
}

/** Answers autocomplete for whichever option is focused, using that option's own `autocomplete` */
function compileAutocomplete(options: CommandOptions) {
	if (!Object.values(options).some((option) => option.autocomplete)) {
		return undefined;
	}
	return async (interaction: AutocompleteInteraction) => {
		const focused = interaction.options.getFocused(true);
		const choices = options[focused.name]?.autocomplete;
		if (!choices || !interaction.inCachedGuild()) {
			// autocomplete can't show an error message, so a refusal is just no choices
			return await interaction.respond([]);
		}
		await respondWithChoices(
			interaction,
			await choices(String(focused.value), interaction),
		);
	};
}

async function replyEphemeral(
	interaction: RepliableInteraction,
	content: string,
) {
	await interaction.reply({ flags: MessageFlags.Ephemeral, content });
}

type ContextMenuBase = Omit<BaseDefinition, "description">;

const contextMenuType = {
	user: ApplicationCommandType.User,
	message: ApplicationCommandType.Message,
} as const;

/** Declares a right-click command on a user, whose handler receives the target as a member of the guild */
export function defineContextMenu(
	definition: ContextMenuBase & {
		type: "user";
		handle(
			interaction: UserContextMenuCommandInteraction<"cached">,
			target: GuildMember,
		): unknown;
	},
): Command<ApplicationCommandType.User>;

/** Declares a right-click command on a message */
export function defineContextMenu(
	definition: ContextMenuBase & {
		type: "message";
		handle(
			interaction: MessageContextMenuCommandInteraction<"cached">,
		): unknown;
	},
): Command<ApplicationCommandType.Message>;

export function defineContextMenu(
	definition: ContextMenuBase & {
		type: "user" | "message";
		handle(interaction: never, target?: GuildMember): unknown;
	},
): Command<ApplicationCommandType.User | ApplicationCommandType.Message> {
	return {
		name: definition.name,
		default_member_permissions: definition.default_member_permissions,
		type: contextMenuType[definition.type],
		async handle(
			interaction:
				| UserContextMenuCommandInteraction
				| MessageContextMenuCommandInteraction,
		) {
			if (!interaction.inCachedGuild()) {
				return await replyEphemeral(interaction, GUILD_ONLY_MESSAGE);
			}
			if (!interaction.isUserContextMenuCommand()) {
				return await definition.handle(interaction as never);
			}
			if (interaction.targetMember == null) {
				return await replyEphemeral(interaction, MEMBER_LEFT_MESSAGE);
			}
			return await definition.handle(
				interaction as never,
				interaction.targetMember,
			);
		},
	};
}
