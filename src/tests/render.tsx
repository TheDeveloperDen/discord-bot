import { ComponentType } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import type { ReactElement } from "react";

/** The parts of a rendered component the tests look at */
export interface RenderedComponent {
	type: number;
	content?: string;
	custom_id?: string;
	disabled?: boolean;
	items?: { media: { url: string } }[];
	media?: { url: string };
	accent_color?: number;
	components?: RenderedComponent[];
	accessory?: RenderedComponent;
}

export interface RenderedMessage {
	components?: RenderedComponent[];
	flags?: number;
}

/** Renders JSX as a Components V2 message */
export const renderV2 = (element: ReactElement): RenderedMessage =>
	renderDiscordMessage(<Message isV2>{element}</Message>) as RenderedMessage;

/** Every component in the message, depth first */
export function flatten(message: RenderedMessage): RenderedComponent[] {
	const walk = (components: RenderedComponent[]): RenderedComponent[] =>
		components.flatMap((c) => [c, ...walk(c.components ?? [])]);
	return walk(message.components ?? []);
}

/** The text displays' contents, in order */
export const texts = (message: RenderedMessage) =>
	flatten(message).flatMap((c) => (c.content ? [c.content] : []));

export const buttons = (message: RenderedMessage) =>
	flatten(message).filter((c) => c.type === ComponentType.Button);
