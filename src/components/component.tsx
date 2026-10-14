import type {
	ButtonInteraction,
	ModalSubmitInteraction,
	StringSelectMenuInteraction,
} from "discord.js";
import {
	Button,
	type InteractiveButtonProps,
	Modal,
	type ModalProps,
	StringSelect,
	type StringSelectProps,
} from "disjsx";
import type { ReactElement } from "react";

export type ComponentInteractionFor = {
	button: ButtonInteraction;
	stringSelect: StringSelectMenuInteraction;
	modal: ModalSubmitInteraction;
};
export type ComponentKind = keyof ComponentInteractionFor;

/** The JSX props each kind takes, apart from the customId (built from the args) and disjsx's numeric `id` */
type ElementPropsFor = {
	button: Omit<InteractiveButtonProps, "customId" | "id">;
	stringSelect: Omit<StringSelectProps, "customId" | "id">;
	modal: Omit<ModalProps, "customId">;
};

/** Turns declared arg names into their values, e.g. `["ticketId"]` -> `{ ticketId: string }` */
export type ComponentArgs<A extends readonly string[]> = {
	[K in A[number]]: string;
};

export interface ComponentDefinition<
	K extends ComponentKind = ComponentKind,
	A extends readonly string[] = readonly string[],
> {
	/** e.g. `"faq:edit"`. The customId is this followed by `:`-separated args */
	id: string;
	kind: K;
	/** Names of the values stored in the customId, in order. Only the last may contain `:` */
	args?: A;
	handle(
		interaction: ComponentInteractionFor[K],
		args: ComponentArgs<A>,
	): unknown;
}

/** A router component that is also its own JSX element, e.g. `<FaqButton name="ask" style={...}>Ask</FaqButton>` */
export type Component<
	K extends ComponentKind,
	A extends readonly string[],
> = ComponentDefinition<K, A> &
	((props: ElementPropsFor[K] & ComponentArgs<A>) => ReactElement);

/** Arg names would collide with the element's own props, so they're rejected at compile time */
type ArgNameClash<
	K extends ComponentKind,
	A extends readonly string[],
> = Extract<A[number], keyof ElementPropsFor[K] | "id" | "key">;

export const SEPARATOR = ":";
const MAX_CUSTOM_ID_LENGTH = 100;

const elementFor = { button: Button, stringSelect: StringSelect, modal: Modal };

/** Declares a component, how the router handles it, and the JSX element that sends it */
export function defineComponent<
	K extends ComponentKind,
	const A extends readonly string[] = readonly [],
>(
	definition: ComponentDefinition<K, A> &
		(ArgNameClash<K, A> extends never
			? unknown
			: {
					args: `"${ArgNameClash<K, A>}" is a ${K} prop, so it can't be an arg name`;
				}),
): Component<K, A> {
	const names: readonly string[] = definition.args ?? [];
	// each kind's element takes that kind's props, which the types above already guarantee
	const Element = elementFor[definition.kind] as unknown as (
		props: Record<string, unknown>,
	) => ReactElement;

	const render = (props: Record<string, unknown>) => {
		const args: Record<string, string> = {};
		const elementProps: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(props)) {
			if (names.includes(key)) args[key] = value as string;
			else elementProps[key] = value;
		}
		return (
			<Element {...elementProps} customId={buildCustomId(definition, args)} />
		);
	};
	return Object.assign(render, definition) as unknown as Component<K, A>;
}

function buildCustomId(
	{ id, args: names = [] }: ComponentDefinition,
	args: Record<string, string>,
): string {
	const values = names.map((name, i) => {
		const value = args[name];
		if (value === undefined) {
			throw new Error(`Component ${id} is missing its "${name}" arg`);
		}
		const isLast = i === names.length - 1;
		if (!isLast && value.includes(SEPARATOR)) {
			throw new Error(
				`Arg "${name}" of component ${id} can't contain "${SEPARATOR}" because it isn't the last arg`,
			);
		}
		return value;
	});
	const customId = [id, ...values].join(SEPARATOR);
	if (customId.length > MAX_CUSTOM_ID_LENGTH) {
		throw new Error(
			`customId "${customId}" is over Discord's ${MAX_CUSTOM_ID_LENGTH} character limit`,
		);
	}
	return customId;
}

/** Returns the args encoded in `customId` if it belongs to `component`, otherwise undefined */
export function parseCustomId(
	component: ComponentDefinition,
	customId: string,
): Record<string, string> | undefined {
	const names = component.args ?? [];
	if (customId === component.id) return names.length === 0 ? {} : undefined;
	if (names.length === 0 || !customId.startsWith(component.id + SEPARATOR)) {
		return undefined;
	}
	const parts = customId
		.slice(component.id.length + SEPARATOR.length)
		.split(SEPARATOR);
	if (parts.length < names.length) return undefined;
	// the last arg takes whatever is left, so it may contain the separator
	const last = parts.slice(names.length - 1).join(SEPARATOR);
	const values = [...parts.slice(0, names.length - 1), last];
	return Object.fromEntries(
		names.map((name, i) => [name, values[i] as string]),
	);
}
