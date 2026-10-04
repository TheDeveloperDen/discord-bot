import type {
	APIApplicationCommandBasicOption,
	APIApplicationCommandSubcommandGroupOption,
	APIApplicationCommandSubcommandOption,
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	MessageContextMenuCommandInteraction,
	UserContextMenuCommandInteraction,
} from "discord.js";
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
} from "discord.js";

export type InteractionFor<T extends ApplicationCommandType> = {
	[ApplicationCommandType.Message]: MessageContextMenuCommandInteraction;
	[ApplicationCommandType.ChatInput]: ChatInputCommandInteraction;
	[ApplicationCommandType.User]: UserContextMenuCommandInteraction;
	[ApplicationCommandType.PrimaryEntryPoint]: never;
}[T];

interface BaseCommand<T extends ApplicationCommandType> {
	name: string;
	type: T;
	/** Permissions a member needs by default, e.g. `PermissionFlagsBits.BanMembers`. `0n` means admins only */
	default_member_permissions?: bigint;
	handle(interaction: InteractionFor<T>): unknown;
}

interface ChatInputCommand
	extends BaseCommand<ApplicationCommandType.ChatInput> {
	description: string;
	options:
		| APIApplicationCommandBasicOption[]
		| (ExecutableSubcommand | ExecutableSubcommandGroup)[];
	autocomplete?(interaction: AutocompleteInteraction): unknown;
}

interface SubcommandRoot extends ChatInputCommand {
	options: (ExecutableSubcommandGroup | ExecutableSubcommand)[];
}

export type Command<T extends ApplicationCommandType> =
	T extends ApplicationCommandType.ChatInput
		? ChatInputCommand
		: BaseCommand<T>;

export interface ExecutableSubcommandGroup
	extends APIApplicationCommandSubcommandGroupOption {
	options: ExecutableSubcommand[];
}

export interface ExecutableSubcommand
	extends APIApplicationCommandSubcommandOption {
	handle(interaction: ChatInputCommandInteraction): unknown;
	autocomplete?(interaction: AutocompleteInteraction): unknown;
}

export function isChatInputCommand(
	command: Command<ApplicationCommandType>,
): command is ChatInputCommand {
	return command.type === ApplicationCommandType.ChatInput;
}

export function isSubcommandRoot(
	command: Command<ApplicationCommandType>,
): command is SubcommandRoot {
	return (
		isChatInputCommand(command) &&
		[
			ApplicationCommandOptionType.SubcommandGroup,
			ApplicationCommandOptionType.Subcommand,
		].includes(command.options[0]?.type)
	);
}
