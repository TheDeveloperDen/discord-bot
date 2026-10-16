import { fetch } from "bun";
import type { Message } from "discord.js";
import { Message as MessageComponent, renderDiscordMessage } from "disjsx";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { Card, memberAuthor, withoutPings } from "../../ui/index.js";
import { excerpt } from "../../util/strings.js";

const BYPASS_TOKEN = process.env.DDB_PASTE_BYPASS_TOKEN;

const codeBlockPattern =
	/```(?:(?<lang>[a-zA-Z]+)?\n)?(?<content>(?:.|\n)*?)```|(?:(?:.|\n)(?!```))+/g;

type SplitMessageComponent =
	| { text: string }
	| {
			content: string;
			language?: string;
	  };

export function splitMessage(
	message: string,
	threshold: number = config.devbin.threshold,
) {
	const matches = message.matchAll(codeBlockPattern);

	const out: SplitMessageComponent[] = [];

	for (const match of matches) {
		if (match[0].split("\n").length < threshold) {
			out.push({ text: match[0] });
			continue;
		}

		if (match.groups?.content ?? match[0].match(/[{}<>()=]+/g) != null) {
			out.push({
				content: match.groups?.content ?? match[0],
				language: match?.groups?.lang ?? undefined,
			});
		}
	}

	return out;
}

export async function upload(component: SplitMessageComponent) {
	if ("text" in component) {
		return component.text;
	}
	const header: { [key: string]: string } = {
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	if (BYPASS_TOKEN) {
		header.Authorization = BYPASS_TOKEN;
	}

	const response = await fetch(`${config.devbin.api_url}/pastes`, {
		method: "POST",
		headers: header,
		body: JSON.stringify({
			title: `Pasted via DevDenBot`,
			content: component.content,
			content_language: "plain_text", // Currently only accepts this
		}),
	});

	if (!response.ok) {
		logger.error(
			`Failed to upload message to pastebin: ${response.statusText}`,
		);
		return "Pasting failed";
	}

	const id = ((await response.json()) as { id: string }).id;

	if (!id) {
		logger.warn("Id was missing from pastebin response");
		return "Pasting failed";
	}

	return `${config.devbin.url}/paste/${id}`;
}

const renderPastified = (message: Message, lines: string[]) =>
	withoutPings(
		renderDiscordMessage(
			<MessageComponent isV2>
				<Card
					author={memberAuthor(message.member ?? message.author)}
					description={excerpt(lines.join("\n"), { maxLength: 3600 })}
					footer="This message was converted automatically to keep the channels clean from large code blocks."
				/>
			</MessageComponent>,
		),
	);

type PastifyReturn<T extends boolean> = T extends true
	? ReturnType<typeof renderPastified>
	: ReturnType<typeof renderPastified> | null;

/**
 * Pastifies a message.
 * @param message the message to pastify
 * @param forcePaste whether to pastify the message regardless of whether there's any code
 * @param threshold the point at which a message should be uploaded to the pastebin
 * @return a card containing a pastified message, or null if the message is empty
 */
export async function pastify<force extends boolean = false>(
	message: Message,
	forcePaste?: force,
	threshold?: number,
): Promise<PastifyReturn<force>> {
	const split = splitMessage(message.content, threshold);

	// if it's just a string, do nothing
	if (!forcePaste || !split.some((part) => "content" in part)) {
		return null as PastifyReturn<force>;
	}

	const lines = await Promise.all(split.map(upload));

	pastifiedMessages.add(BigInt(message.id));

	await message.delete();
	return renderPastified(message, lines);
}

const pastifiedMessages = new Set<bigint>();

export function isPastified(messageId: bigint): boolean {
	return pastifiedMessages.has(messageId);
}
