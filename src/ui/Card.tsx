import {
	type ColorResolvable,
	GuildMember,
	resolveColor,
	type User,
} from "discord.js";
import { Container, Section, TextDisplay, Thumbnail } from "disjsx";
import type { ReactNode } from "react";
import { branding } from "../util/branding.js";

export interface CardAuthor {
	name: string;
	/** Shown to the right of the name */
	iconUrl?: string;
	/** Makes the name a link */
	url?: string;
	/**
	 * Shows the author as a mention
	 */
	userId?: string;
	/** The card's accent when it doesn't set one, e.g. the member's role colour */
	color?: ColorResolvable;
}

export interface CardProps {
	/** The bar down the left. Defaults to the author's colour, then the branding colour */
	accent?: ColorResolvable;
	/** A large heading at the top, for what the card is mainly about (e.g. a starboard post's score) */
	title?: string;
	author?: CardAuthor;
	/**
	 * The main text, shown beside the author's avatar so the header doesn't leave a gap next to it.
	 * Up to two blocks, which are spaced apart (a section holds at most three, including the name)
	 */
	description?: string | [string] | [string, string];
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
	title,
	author,
	description,
	footer,
	timestamp,
	children,
}: CardProps) {
	return (
		<Container
			accentColor={resolveColor(
				accent ?? author?.color ?? (branding.color as ColorResolvable),
			)}
		>
			{title && <TextDisplay>{`## ${title}`}</TextDisplay>}
			{author ? (
				<CardHeader author={author} description={blocks(description)} />
			) : (
				blocks(description).map((block) => (
					<TextDisplay key={block}>{block}</TextDisplay>
				))
			)}
			{children}
			<TextDisplay>{footerText(footer, timestamp)}</TextDisplay>
		</Container>
	);
}

const blocks = (description: CardProps["description"]) =>
	(Array.isArray(description) ? description : [description]).filter(
		(block): block is string => !!block,
	);

function CardHeader({
	author,
	description,
}: {
	author: CardAuthor;
	description: string[];
}) {
	const name = author.userId
		? `<@${author.userId}>`
		: author.url
			? `**[${author.name}](${author.url})**`
			: `**${author.name}**`;
	const texts = [name, ...description].map((text) => (
		<TextDisplay key={text}>{text}</TextDisplay>
	));
	// without text beside it the avatar leaves a gap and reads as a second picture, so it's only shown with text
	if (!author.iconUrl || description.length === 0) return <>{texts}</>;
	return (
		<Section>
			{texts}
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

/**
 * A card author for a member (their server avatar and role colour), or a user who has left
 * (their account avatar), as a mention
 */
export const memberAuthor = (member: GuildMember | User): CardAuthor => ({
	name: member.displayName,
	iconUrl: member.displayAvatarURL(),
	userId: member.id,
	// 0 means no coloured role
	color:
		member instanceof GuildMember && member.displayColor !== 0
			? member.displayColor
			: undefined,
});
