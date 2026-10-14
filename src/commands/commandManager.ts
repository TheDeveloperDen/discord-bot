import {
	type APIApplicationCommand,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type AutocompleteInteraction,
	type Client,
	type CommandInteraction,
	type Interaction,
	type RESTGetAPIApplicationCommandsResult,
	type RESTPutAPIApplicationCommandsJSONBody,
	Routes,
	type Snowflake,
} from "discord.js";
import { runObserved } from "../observe.js";
import {
	type Command,
	type ExecutableSubcommand,
	isChatInputCommand,
	isSubcommandRoot,
} from "./command.js";

type ResolvedCommand = {
	name: string;
	handle: (interaction: never) => unknown;
	autocomplete?: (interaction: AutocompleteInteraction) => unknown;
};

function primaryEntryPointPayload(
	command: APIApplicationCommand,
): RESTPutAPIApplicationCommandsJSONBody[number] {
	return {
		type: ApplicationCommandType.PrimaryEntryPoint,
		name: command.name,
		description: command.description,
		default_member_permissions: command.default_member_permissions,
		...(command.name_localizations
			? { name_localizations: command.name_localizations }
			: {}),
		...(command.description_localizations
			? { description_localizations: command.description_localizations }
			: {}),
		...(command.integration_types
			? { integration_types: command.integration_types }
			: {}),
		...(command.contexts ? { contexts: command.contexts } : {}),
		...(command.handler !== undefined ? { handler: command.handler } : {}),
		nsfw: command.nsfw,
	};
}

export class CommandManager {
	constructor(
		private readonly commands: Command<ApplicationCommandType>[],
		private readonly client: Client,
	) {
		client.on("interactionCreate", (interaction) => {
			void this.dispatch(interaction);
		});
	}

	private async register(
		route: `/${string}`,
		preservePrimaryEntryPoint = false,
	) {
		const body = this.commands.map((cmd) => ({
			...cmd,
			default_member_permissions: cmd.default_member_permissions?.toString(), // bigint but discord uses string
		})) as unknown as RESTPutAPIApplicationCommandsJSONBody;

		if (preservePrimaryEntryPoint) {
			const commands = (await this.client.rest.get(
				route,
			)) as RESTGetAPIApplicationCommandsResult;
			const entryPoint = commands.find(
				(command) => command.type === ApplicationCommandType.PrimaryEntryPoint,
			);
			if (entryPoint) body.push(primaryEntryPointPayload(entryPoint));
		}

		await this.client.rest.put(route, { body });
	}

	async setupGlobally(clientId: Snowflake) {
		await this.register(Routes.applicationCommands(clientId), true);
	}

	async setupForGuild(clientId: Snowflake, guildId: Snowflake) {
		await this.register(Routes.applicationGuildCommands(clientId, guildId));
	}

	/** Finds the command or subcommand that should handle this interaction */
	private resolve(
		interaction: CommandInteraction | AutocompleteInteraction,
	): ResolvedCommand | undefined {
		const command = this.commands.find(
			(cmd) => cmd.name === interaction.commandName,
		);
		if (!command || command.type !== interaction.commandType) return undefined;

		if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
			if (!isChatInputCommand(command) || !isSubcommandRoot(command)) {
				return { ...command, name: command.name };
			}
			const group = interaction.options.getSubcommandGroup(false);
			const subName = interaction.options.getSubcommand(true);
			const siblings = (
				group
					? command.options.find(
							(opt) =>
								opt.type === ApplicationCommandOptionType.SubcommandGroup &&
								opt.name === group,
						)?.options
					: command.options
			) as ExecutableSubcommand[] | undefined;
			const sub = siblings?.find((opt) => opt.name === subName);
			if (!sub) return undefined;
			return {
				...sub,
				name: [command.name, group, sub.name].filter(Boolean).join(" "),
			};
		}
		return { ...command, name: command.name };
	}

	private async dispatch(interaction: Interaction) {
		if (interaction.isAutocomplete()) {
			const target = this.resolve(interaction);
			if (!target?.autocomplete) return;
			await runObserved(
				{ op: "command", name: `${target.name} (autocomplete)`, interaction },
				async () => {
					try {
						await target.autocomplete?.(interaction);
					} catch (error) {
						// Autocomplete can't show an error message, so end the request with no choices
						await interaction.respond([]).catch(() => {});
						throw error;
					}
				},
			);
		} else if (interaction.isCommand()) {
			const target = this.resolve(interaction);
			if (!target) return;
			await runObserved({ op: "command", name: target.name, interaction }, () =>
				target.handle(interaction as never),
			);
		}
	}
}
