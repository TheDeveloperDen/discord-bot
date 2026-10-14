import { type ColorResolvable, resolveColor } from "discord.js";
import { Container, Section, TextDisplay, Thumbnail } from "disjsx";
import type { ReactNode } from "react";
import { branding } from "../util/branding.js";

export interface CardAuthor {
	name: string;
	/** Shown to the right of the name */
	iconUrl?: string;
	/** Makes the name a link */
	url?: string;
}

export interface CardProps {
	/** The bar down the left. Defaults to the branding colour */
	accent?: ColorResolvable;
	author?: CardAuthor;
	/** Extra footer text, after the branding name */
	footer?: string;
	/** Shown in the footer as a relative time, but should be provided with a fixed time. */
	timestamp?: Date | number;
	children?: ReactNode;
}

/**
 * The bot's standard message card, replacing `createStandardEmbed` for Components V2 messages:
 * an accented container with an optional author header, the children, and a branding footer.
 */
export function Card({
	accent,
	author,
	footer,
	timestamp,
	children,
}: CardProps) {
	return (
		<Container
			accentColor={resolveColor(accent ?? (branding.color as ColorResolvable))}
		>
			{author && <CardHeader author={author} />}
			{children}
			<TextDisplay>{footerText(footer, timestamp)}</TextDisplay>
		</Container>
	);
}

function CardHeader({ author }: { author: CardAuthor }) {
	const name = author.url
		? `**[${author.name}](${author.url})**`
		: `**${author.name}**`;
	// a section must have an accessory, so a header without an icon is plain text
	if (!author.iconUrl) return <TextDisplay>{name}</TextDisplay>;
	return (
		<Section>
			<TextDisplay>{name}</TextDisplay>
			<Thumbnail url={author.iconUrl} />
		</Section>
	);
}

function footerText(footer?: string, timestamp?: Date | number) {
	const parts = [branding.name];
	if (footer) parts.push(footer);
	if (timestamp !== undefined) {
		parts.push(`<t:${Math.floor(new Date(timestamp).getTime() / 1000)}:R>`);
	}
	return `-# ${parts.join(" · ")}`;
}
