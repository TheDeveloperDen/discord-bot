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

		const block = match.groups?.content;
		// a code block counts if it isn't empty, anything else only if it looks like code
		const isCode =
			block !== undefined ? block.trim() !== "" : /[{}<>()=]+/.test(match[0]);
		// long text that isn't code stays in the message as it was
		out.push(
			isCode
				? { content: block ?? match[0], language: match.groups?.lang }
				: { text: match[0] },
		);
	}

	return out;
}

export const PASTING_FAILED = "Pasting failed";

/** Uploads the component and returns its link, or null if the paste service refused it */
async function tryUpload(
	component: SplitMessageComponent,
): Promise<string | null> {
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
		return null;
	}

	const id = ((await response.json()) as { id: string }).id;

	if (!id) {
		logger.warn("Id was missing from pastebin response");
		return null;
	}

	return `${config.devbin.url}/paste/${id}`;
}

/** Tries to upload and returns a friendly string result:
 * The link to the paste, or `PASTING_FAILED` in its place */
export async function upload(
	component: SplitMessageComponent,
): Promise<string> {
	return (await tryUpload(component)) ?? PASTING_FAILED;
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

/**
 * Replaces a message's code with links to pastes of it, deleting the message and returning a card
 * to send in its place.
 * @param message the message to pastify
 * @param threshold how many lines a block needs before it's uploaded to the pastebin
 * @return the card, or null if there's nothing to paste or a paste failed (the message is then left alone)
 */
export async function pastify(
	message: Message,
	threshold?: number,
): Promise<ReturnType<typeof renderPastified> | null> {
	const split = splitMessage(message.content, threshold);

	// nothing to paste: no code, or an empty message (e.g. just an image)
	if (!split.some((part) => "content" in part)) return null;

	let lines: (string | null)[];
	try {
		lines = await Promise.all(split.map(tryUpload));
	} catch (error) {
		logger.error("Failed to upload a message to the pastebin:", error);
		return null;
	}
	// deleting the message would lose the code, so don't do anything
	if (lines.some((line) => line === null)) return null;

	pastifiedMessages.add(BigInt(message.id));

	await message.delete();
	return renderPastified(message, lines as string[]);
}

const pastifiedMessages = new Set<bigint>();

export function isPastified(messageId: bigint): boolean {
	return pastifiedMessages.has(messageId);
}
