import {
	type AnyThreadChannel,
	type AttachmentBuilder,
	ChannelType,
	type Client,
} from "discord.js";
import { config } from "../../Config.js";
import { createStandardEmbed } from "../../util/embeds.js";

export const SUPPORT_THREAD_REMOVAL_CUSTOM_ID_PREFIX = "remove-support-thread";

export const SUPPORT_THREAD_REMOVAL_REASONS = [
	{
		value: "advertising",
		label: "Advertising",
		description: "The post promotes something unrelated to support.",
	},
	{
		value: "showcase",
		label: "Showcase",
		description: "This belongs in the showcase channel.",
	},
	{
		value: "spam",
		label: "Spam",
		description: "The post is spam or low-quality promotion.",
	},
	{
		value: "duplicate",
		label: "Duplicate",
		description: "A substantially similar post already exists.",
	},
	{
		value: "off_topic",
		label: "Off topic",
		description: "The post is not a support request.",
	},
	{
		value: "insufficient_details",
		label: "Insufficient details",
		description: "More information is needed to provide support.",
	},
	{
		value: "cancel",
		label: "Cancel",
		description: "Leave the post unchanged.",
	},
] as const;

export type SupportThreadRemovalReason =
	(typeof SUPPORT_THREAD_REMOVAL_REASONS)[number]["value"];

const REASON_EXPLANATIONS: Record<SupportThreadRemovalReason, string> = {
	advertising:
		"This support system is for requests for help, so promotional tickets are removed.",
	showcase: `This looks like something to share in <#${config.channels.showcase}> instead of opening a support ticket.`,
	spam: "We removed this ticket because it appears to be spam.",
	duplicate:
		"We removed this duplicate ticket so the discussion can stay in one place.",
	off_topic:
		"We removed this ticket because it is outside the scope of the support system.",
	insufficient_details:
		"We removed this ticket because it does not include enough detail to troubleshoot. Please include expected and actual behavior, any errors, and the steps you have already tried before opening another ticket.",
	cancel: "",
};

export function isSupportThreadRemovalReason(
	value: string,
): value is SupportThreadRemovalReason {
	return SUPPORT_THREAD_REMOVAL_REASONS.some(
		(reason) => reason.value === value,
	);
}

export function getSupportThreadRemovalExplanation(
	reason: Exclude<SupportThreadRemovalReason, "cancel">,
): string {
	return REASON_EXPLANATIONS[reason];
}

export function createSupportThreadRemovalCustomId(
	threadId: string,
	moderatorId: string,
): string {
	return `${SUPPORT_THREAD_REMOVAL_CUSTOM_ID_PREFIX}:${threadId}:${moderatorId}`;
}

export function parseSupportThreadRemovalCustomId(customId: string): {
	threadId: string;
	moderatorId: string;
} | null {
	const [prefix, threadId, moderatorId, extra] = customId.split(":");
	if (
		prefix !== SUPPORT_THREAD_REMOVAL_CUSTOM_ID_PREFIX ||
		threadId == null ||
		threadId.length === 0 ||
		moderatorId == null ||
		moderatorId.length === 0 ||
		extra != null
	) {
		return null;
	}
	return { threadId, moderatorId };
}

export async function getEligibleSupportThread(
	client: Client,
	threadId: string,
): Promise<AnyThreadChannel | null> {
	try {
		const channel = await client.channels.fetch(threadId);
		if (!channel?.isThread() || channel.parentId == null) {
			return null;
		}
		return (await isEligibleSupportThread(client, channel)) ? channel : null;
	} catch {
		return null;
	}
}

export async function isEligibleSupportThread(
	client: Client,
	thread: AnyThreadChannel,
): Promise<boolean> {
	if (thread.parentId !== config.modmail.channel) {
		return false;
	}
	try {
		const parent = await client.channels.fetch(thread.parentId);
		return parent?.type === ChannelType.GuildText;
	} catch {
		return false;
	}
}

export function createSupportThreadRemovalDm(
	thread: AnyThreadChannel,
	archive: AttachmentBuilder,
	reason: Exclude<SupportThreadRemovalReason, "cancel">,
) {
	const embed = createStandardEmbed()
		.setTitle("Your support ticket was marked for removal")
		.setDescription(getSupportThreadRemovalExplanation(reason))
		.addFields(
			{ name: "Ticket", value: thread.name },
			{
				name: "Conversation copy",
				value:
					"A complete HTML transcript of the ticket is attached to this message.",
			},
		);

	return {
		content:
			"Hi! A moderator reviewed your support ticket and marked it for removal. This is not a punishment; the reason and a recoverable copy of the conversation are included below.",
		allowedMentions: { parse: [] as [] },
		embeds: [embed],
		files: [archive],
	};
}
