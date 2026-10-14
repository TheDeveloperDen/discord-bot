import {
	AttachmentBuilder,
	ButtonStyle,
	type GuildMember,
	type Message,
	type User,
} from "discord.js";
import {
	ActionRow,
	Button,
	MediaGallery,
	MediaGalleryItem,
	renderDiscordMessage,
	Message as V2Message,
} from "disjsx";
import { Card, memberAuthor, quoteText } from "../../ui/index.js";
import { excerpt } from "../../util/strings.js";
import {
	buildStarboardScore,
	type StarboardContentRenderOptions,
} from "./starboard.content.js";
import { getColorForStars, getImageOrGifEmbed } from "./starboard.js";

// together with the header and footer, comfortably inside Discord's 4000 characters of text per message
const MAX_CONTENT_LENGTH = 3000;
// the reply is only context, so it's kept short enough not to push the starred message down
const MAX_REPLY_LENGTH = 250;
const MAX_REPLY_LINES = 4;

/**
 * Renders the board post for `message` as a Components V2 message, displaying:
 * - a card with the author
 * - the message being replied to
 * - the text, and any image or video
 * - then a link to the original.
 * Discord's "GIFs" (Tenor, Klipy) are really mp4 videos, which a gallery shows with a play button, so they're
 * converted to real GIFs, which autoplay. They're returned as `files`, which the post must be sent or edited with.
 */
export async function renderStarboardPost(
	message: Message<true>,
	/** The author's member, or their user if they've left the server */
	author: GuildMember | User,
	stars: number,
	settings: StarboardContentRenderOptions,
	contentStars = stars,
) {
	const files: AttachmentBuilder[] = [];
	/** The URL to show `quoted`'s image at, converting a video to a GIF uploaded as `gifName` */
	const mediaUrl = async (quoted: Message, gifName: string) => {
		const found = await getImageOrGifEmbed(quoted);
		if (!found) return undefined;
		if ("gifBuffer" in found) {
			files.push(new AttachmentBuilder(found.gifBuffer, { name: gifName }));
			return `attachment://${gifName}`;
		}
		return found.url;
	};

	const referenced = message.reference
		? await message.fetchReference().catch(() => null)
		: null;
	const reply =
		referenced?.inGuild() && referenced.guildId === message.guildId
			? referenced
			: undefined;

	const media = [
		await mediaUrl(message, "starboard.gif"),
		reply ? await mediaUrl(reply, "starboard-reply.gif") : undefined,
	].filter((url) => url !== undefined);

	// shown beside the author's avatar: the message being replied to, then the message
	const description = [
		reply &&
			quoteText({
				author: `<@${reply.author.id}>`,
				children:
					excerpt(reply.content, {
						maxLength: MAX_REPLY_LENGTH,
						maxLines: MAX_REPLY_LINES,
					}) || "*(no text)*",
			}),
		excerpt(message.content, { maxLength: MAX_CONTENT_LENGTH }),
	].filter((block): block is string => !!block) as [string] | [string, string];

	const payload = renderDiscordMessage(
		<V2Message isV2>
			<Card
				accent={getColorForStars(stars, settings.threshold, settings.color)}
				author={memberAuthor(author)}
				title={buildStarboardScore(message, contentStars, settings)}
				timestamp={message.editedTimestamp ?? message.createdTimestamp}
				description={description}
			>
				{media.length > 0 && (
					<MediaGallery>
						{media.map((url) => (
							<MediaGalleryItem key={url} url={url} />
						))}
					</MediaGallery>
				)}
			</Card>
			<ActionRow>
				<Button style={ButtonStyle.Link} url={message.url}>
					Jump to message
				</Button>
			</ActionRow>
		</V2Message>,
	);
	return { ...payload, files: files.length > 0 ? files : undefined };
}
