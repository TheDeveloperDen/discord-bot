import type {
	APIApplicationCommandBasicOption,
	ApplicationCommandOptionChoiceData,
	Attachment,
	AutocompleteInteraction,
	CacheType,
	ChannelType,
	CommandInteractionOption,
	User,
} from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";

export type OptionKind =
	| "string"
	| "integer"
	| "number"
	| "boolean"
	| "user"
	| "member"
	| "channel"
	| "role"
	| "attachment";

/** What the user has typed so far, and the interaction it came from.*/
export type AutocompleteChoices = (
	typed: string,
	interaction: AutocompleteInteraction<"cached">,
) =>
	| ApplicationCommandOptionChoiceData<string>[]
	| Promise<ApplicationCommandOptionChoiceData<string>[]>;

/** A command option declared with one of the helpers below. */
export interface CommandOption<
	K extends OptionKind = OptionKind,
	T = unknown,
	R extends boolean = boolean,
> {
	kind: K;
	required: R;
	/** The option as Discord receives it, minus its name */
	raw: Omit<APIApplicationCommandBasicOption, "name">;
	autocomplete?: AutocompleteChoices;
	/**
	 * Never set, kept as a sort of phantom type to tie`T` (the parsed value) to the type, so options with
	 * different values aren't interchangeable and `T` isn't an unused parameter
	 */
	readonly _value?: T;
}

/** Values whose type depends on whether the guild is cached, so they're resolved when the command is defined */
type ResolvedValueFor<C extends CacheType> = {
	member: NonNullable<CommandInteractionOption<C>["member"]>;
	channel: NonNullable<CommandInteractionOption<C>["channel"]>;
	role: NonNullable<CommandInteractionOption<C>["role"]>;
};

const resolvedKinds = [
	"user",
	"member",
	"channel",
	"role",
	"attachment",
] as const;

/** Whether the parsed value is discord.js's same-named field on the option, e.g. `option.member`, rather than its `value` */
export function isResolvedKind(
	kind: OptionKind,
): kind is (typeof resolvedKinds)[number] {
	return (resolvedKinds as readonly OptionKind[]).includes(kind);
}

export type OptionValue<O, C extends CacheType> =
	O extends CommandOption<infer K, infer T>
		? K extends keyof ResolvedValueFor<C>
			? ResolvedValueFor<C>[K]
			: T
		: never;

export type CommandOptions = Record<string, CommandOption>;

/** Maps Declared options to what `handle` receives, e.g. `{ target: GuildMember; reason: string | undefined }` */
export type ParsedOptions<O extends CommandOptions, C extends CacheType> = {
	[N in keyof O]: O[N]["required"] extends true
		? OptionValue<O[N], C>
		: OptionValue<O[N], C> | undefined;
};

interface BaseConfig<R extends boolean> {
	description: string;
	required?: R;
}

type Choice<V extends string | number> = { name: string; value: V };

/** The choices' values if there are any, otherwise any `V` */
type ChoiceValue<V, C> = [C] extends [readonly { value: infer X }[]] ? X : V;

const typeFor = {
	string: ApplicationCommandOptionType.String,
	integer: ApplicationCommandOptionType.Integer,
	number: ApplicationCommandOptionType.Number,
	boolean: ApplicationCommandOptionType.Boolean,
	user: ApplicationCommandOptionType.User,
	// a member is a user option, resolved to the member when parsed
	member: ApplicationCommandOptionType.User,
	channel: ApplicationCommandOptionType.Channel,
	role: ApplicationCommandOptionType.Role,
	attachment: ApplicationCommandOptionType.Attachment,
} as const;

function option<K extends OptionKind, T, R extends boolean>(
	kind: K,
	{
		required,
		autocomplete,
		...rest
	}: BaseConfig<R> & { autocomplete?: AutocompleteChoices },
): CommandOption<K, T, R> {
	// undefined fields are dropped when the body is serialised, so the registered JSON only has what was set
	const raw = {
		type: typeFor[kind],
		...rest,
		required: required || undefined,
		// Discord only wants the flag
		autocomplete: autocomplete ? true : undefined,
	} as CommandOption["raw"];
	return { kind, required: (required ?? false) as R, raw, autocomplete };
}

export function string<
	const R extends boolean = false,
	const C extends readonly Choice<string>[] | undefined = undefined,
>(
	config: BaseConfig<R> & {
		choices?: C;
		min_length?: number;
		max_length?: number;
		autocomplete?: AutocompleteChoices;
	},
): CommandOption<"string", ChoiceValue<string, C>, R> {
	return option("string", config);
}

function numeric<K extends "integer" | "number">(kind: K) {
	return <
		const R extends boolean = false,
		const C extends readonly Choice<number>[] | undefined = undefined,
	>(
		config: BaseConfig<R> & {
			choices?: C;
			min_value?: number;
			max_value?: number;
		},
	): CommandOption<K, ChoiceValue<number, C>, R> => option(kind, config);
}

export const integer = numeric("integer");
export const number = numeric("number");

export function boolean<const R extends boolean = false>(
	config: BaseConfig<R>,
): CommandOption<"boolean", boolean, R> {
	return option("boolean", config);
}

export function user<const R extends boolean = false>(
	config: BaseConfig<R>,
): CommandOption<"user", User, R> {
	return option("user", config);
}

/** A user option that resolves to their guild member. If the chosen user has left the server, the command replies with an error instead of running */
export function member<const R extends boolean = false>(
	config: BaseConfig<R>,
): CommandOption<"member", unknown, R> {
	return option("member", config);
}

export function channel<const R extends boolean = false>(
	config: BaseConfig<R> & { channel_types?: ChannelType[] },
): CommandOption<"channel", unknown, R> {
	return option("channel", config);
}

export function role<const R extends boolean = false>(
	config: BaseConfig<R>,
): CommandOption<"role", unknown, R> {
	return option("role", config);
}

export function attachment<const R extends boolean = false>(
	config: BaseConfig<R>,
): CommandOption<"attachment", Attachment, R> {
	return option("attachment", config);
}
