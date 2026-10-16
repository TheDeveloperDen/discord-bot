import { ButtonStyle, type Client } from "discord.js";
import { Button, Section, Separator, TextDisplay, Thumbnail } from "disjsx";
import { Fragment } from "react";
import { logger } from "../../logging.js";
import { Card } from "../../ui/index.js";
import { getEmoji, stringifyEmoji } from "../../util/emojis.js";
import { EMOJI_FILE, squareEmoji } from "./emojiImage.js";
import type { LearningResource, Resource } from "./learningResource.model.js";

export const CONTRIBUTE_LINK =
	"[**Contribute to our resource collection!**](https://github.com/TheDeveloperDen/LearningResources)";

/** The set's name, with its emoji in front if it has one that can be found */
export function resourceTitle(client: Client, resourceSet: LearningResource) {
	if (!resourceSet.emoji) return resourceSet.name;
	const emoji = getEmoji(client, resourceSet.emoji);
	if (!emoji) {
		logger.warn(
			`Could not find emoji ${resourceSet.emoji} for resource ${resourceSet.name}`,
		);
		return resourceSet.name;
	}
	return `${stringifyEmoji(emoji)} ${resourceSet.name}`;
}

/** The set's custom emoji id, if it has one: only those have an image to show */
export const customEmojiId = (resourceSet: LearningResource) =>
	resourceSet.emoji && /^\d+$/.test(resourceSet.emoji)
		? resourceSet.emoji
		: undefined;

/** A resource's name, price, description, pros and cons, in one text display to save components */
function resourceText(res: Resource) {
	return [
		`### ${res.name}\n🏷️ **${res.price ? res.price : "Free"}**`,
		res.description,
		...res.pros.map((p) => `✅ ${p}`),
		...res.cons.map((c) => `⚠️ ${c}`),
	]
		.filter(Boolean)
		.join("\n");
}

/**
 * One page of a learning resource set: its header (with the emoji as a thumbnail when
 * `emojiImage` has prepared it) and some of its resources, each with a link button.
 */
export function ResourceCard({
	client,
	resourceSet,
	resources,
	footer,
}: {
	client: Client;
	resourceSet: LearningResource;
	resources: Resource[];
	footer?: string;
}) {
	const id = customEmojiId(resourceSet);
	const hasImage = id !== undefined && squareEmoji(id) !== null;
	// the emoji is the thumbnail, so it isn't repeated in the title
	const title = hasImage
		? resourceSet.name
		: resourceTitle(client, resourceSet);
	const header = [
		<TextDisplay key="title">{`## ${title}`}</TextDisplay>,
		<TextDisplay key="description">{resourceSet.description}</TextDisplay>,
	];
	return (
		<Card footer={footer}>
			{hasImage ? (
				<Section>
					{header}
					<Thumbnail
						url={`attachment://${EMOJI_FILE}`}
						description={resourceSet.name}
					/>
				</Section>
			) : (
				header
			)}
			{resources.map((res) => (
				<Fragment key={res.url}>
					<Separator />
					<Section>
						<TextDisplay>{resourceText(res)}</TextDisplay>
						<Button style={ButtonStyle.Link} url={res.url}>
							Open ↗
						</Button>
					</Section>
				</Fragment>
			))}
			<Separator />
			<TextDisplay>{CONTRIBUTE_LINK}</TextDisplay>
		</Card>
	);
}
