import {
	ButtonStyle,
	type Client,
	type GuildMember,
	MessageFlags,
	resolvePartialEmoji,
	SnowflakeUtil,
} from "discord.js";
import { ActionRow, Button, Message, renderDiscordMessage } from "disjsx";
import { config } from "../../Config.js";
import type { Suggestion } from "../../store/models/Suggestion.js";
import { SuggestionStatus } from "../../store/models/Suggestion.js";
import type { SuggestionVote } from "../../store/models/SuggestionVote.js";
import {
	Card,
	type CardAuthor,
	Field,
	memberAuthor,
	withoutPings,
} from "../../ui/index.js";
import { excerpt } from "../../util/strings.js";
import { actualMentionById } from "../../util/users.js";
import {
	SUGGESTION_ID_FIELD_NAME,
	SUGGESTION_NO_ID,
	SUGGESTION_VIEW_VOTES_ID,
	SUGGESTION_YES_ID,
} from "./suggest.constants.js";

// together with the rest of the card, comfortably inside Discord's 4000 characters of text per message
const MAX_TEXT_LENGTH = 2500;
const MAX_REASON_LENGTH = 1000;

/** What a suggestion's message shows */
export interface SuggestionView {
	id: string;
	submitterId: string;
	text: string;
	status: SuggestionStatus;
	moderatorId?: string;
	reason?: string | null;
	threadUrl?: string | null;
	upvotes: number;
	downvotes: number;
}

/** What `suggestion`'s message shows */
export const suggestionView = (suggestion: Suggestion): SuggestionView => ({
	id: suggestion.id.toString(),
	submitterId: suggestion.memberId.toString(),
	text: suggestion.suggestionText,
	status: suggestion.status,
	moderatorId: suggestion.moderatorId?.toString(),
	reason: suggestion.reason,
	threadUrl: suggestion.threadUrl,
	upvotes: suggestion.votes?.filter((vote) => vote.vote === 1).length ?? 0,
	downvotes: suggestion.votes?.filter((vote) => vote.vote === -1).length ?? 0,
});

/**
 * Renders a suggestion's message as a Components V2 card, including
 * - the submitter with the suggestion and its status beside them
 * - the votes
 * - the moderator's reason and discussion thread once decided
 * - buttons to vote and view votes
 */
export async function renderSuggestion(
	client: Client,
	suggestion: SuggestionView,
) {
	const { id, upvotes, downvotes } = suggestion;
	const pending = suggestion.status === SuggestionStatus.PENDING;

	return renderDiscordMessage(
		<Message isV2>
			<Card
				accent={accentFor(suggestion.status)}
				author={await submitterAuthor(client, suggestion.submitterId)}
				description={[
					excerpt(suggestion.text, { maxLength: MAX_TEXT_LENGTH }),
					statusLine(suggestion),
				]}
				footer={`${SUGGESTION_ID_FIELD_NAME}: ${id}`}
				// the id is the snowflake of the /suggest interaction, so it's when the suggestion was made
				timestamp={SnowflakeUtil.timestampFrom(id)}
			>
				<Field label={pending ? "Votes" : "Results"}>
					{`:white_check_mark: **${upvotes}** · :x: **${downvotes}**`}
				</Field>
				{suggestion.reason && (
					<Field label="Reason">
						{excerpt(suggestion.reason, { maxLength: MAX_REASON_LENGTH })}
					</Field>
				)}
				{suggestion.threadUrl && (
					<Field label="Discussion">
						{`[View the discussion thread](${suggestion.threadUrl})`}
					</Field>
				)}
			</Card>
			<ActionRow>
				{pending && (
					<Button
						style={ButtonStyle.Success}
						customId={SUGGESTION_YES_ID}
						emoji={resolvePartialEmoji(config.suggest.yesEmojiId) ?? undefined}
					/>
				)}
				{pending && (
					<Button
						style={ButtonStyle.Danger}
						customId={SUGGESTION_NO_ID}
						emoji={resolvePartialEmoji(config.suggest.noEmojiId) ?? undefined}
					/>
				)}
				<Button
					style={ButtonStyle.Secondary}
					customId={SUGGESTION_VIEW_VOTES_ID}
					emoji={{ name: "👁" }}
				>
					View Votes
				</Button>
			</ActionRow>
		</Message>,
	);
}

const MAX_VOTERS_LENGTH = 1500;

/** Who voted which way, shown only to the member who asked */
export function renderVotes(
	member: GuildMember,
	upvotes: SuggestionVote[],
	downvotes: SuggestionVote[],
) {
	const voters = (votes: SuggestionVote[]) =>
		excerpt(
			votes
				.map((vote) =>
					vote.memberId ? actualMentionById(vote.memberId) : "Unknown Voter",
				)
				.join("\n") || "Nobody yet",
			{ maxLength: MAX_VOTERS_LENGTH },
		);
	return withoutPings(
		renderDiscordMessage(
			<Message isV2 flags={MessageFlags.Ephemeral}>
				<Card accent={memberAuthor(member).color} title="Suggestion Votes">
					<Field label={`${config.suggest.yesEmojiId} Upvotes`}>
						{voters(upvotes)}
					</Field>
					<Field label={`${config.suggest.noEmojiId} Downvotes`}>
						{voters(downvotes)}
					</Field>
				</Card>
			</Message>,
		),
	);
}

/** An edit that replaces the whole message, so one from before Components V2 is converted in place */
export const suggestionEdit = (
	payload: Awaited<ReturnType<typeof renderSuggestion>>,
) => ({ ...payload, content: null, embeds: [] });

const accentFor = (status: SuggestionStatus) =>
	status === SuggestionStatus.APPROVED
		? "Green"
		: status === SuggestionStatus.REJECTED
			? "Red"
			: undefined;

function statusLine(suggestion: SuggestionView) {
	if (suggestion.status === SuggestionStatus.PENDING) return "**Pending**";
	const decision =
		suggestion.status === SuggestionStatus.APPROVED ? "Approved" : "Rejected";
	return suggestion.moderatorId
		? `**${decision}** by <@${suggestion.moderatorId}>`
		: `**${decision}**`;
}

/** The submitter as they appear in the server if they're still in it, otherwise their account */
async function submitterAuthor(
	client: Client,
	id: string,
): Promise<CardAuthor> {
	const guild = client.guilds?.cache.get(config.guildId);
	const member = await guild?.members.fetch(id).catch(() => null);
	if (member) return memberAuthor(member);
	const user = await client.users.fetch(id).catch(() => null);
	return {
		name: user?.username ?? "Unknown user",
		iconUrl: user?.displayAvatarURL(),
		userId: id,
	};
}
