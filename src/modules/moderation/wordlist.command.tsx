import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import { defineCommand, option, subcommand } from "../../commands/index.js";
import { logger } from "../../logging.js";
import {
	addBlockedWord,
	BlockedWordCategory,
	getAllBlockedWords,
	getBlockedWordsByCategory,
	removeBlockedWord,
} from "../../store/models/BlockedWord.js";
import { Card, type DetailItem, Details, Field } from "../../ui/index.js";
import { excerpt } from "../../util/strings.js";
import {
	invalidateBlockedWordsCache,
	testForToxicContent,
} from "../threatDetection/detectors/toxicContentDetector.js";

const CATEGORY_LABELS: Record<BlockedWordCategory, string> = {
	[BlockedWordCategory.SLUR]: "Slur",
	[BlockedWordCategory.HARASSMENT]: "Harassment",
	[BlockedWordCategory.NSFW]: "NSFW",
	[BlockedWordCategory.SPAM]: "Spam",
	[BlockedWordCategory.OTHER]: "Other",
};

const categoryChoices = Object.entries(CATEGORY_LABELS).map(
	([value, name]) => ({
		name,
		value,
	}),
);

const AddSubcommand = subcommand({
	description: "Add a word to the blocklist",
	options: {
		word: option.string({
			description: "The word to block",
			required: true,
		}),
		category: option.string({
			description: "Category for the blocked word",
			choices: categoryChoices,
		}),
	},
	async handle(interaction, { word, category: rawCategory }) {
		const member = interaction.member;
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to manage the wordlist.",
			});
		}

		const category =
			(rawCategory as BlockedWordCategory) || BlockedWordCategory.OTHER;

		try {
			const blockedWord = await addBlockedWord(
				word,
				category,
				BigInt(interaction.user.id),
			);
			invalidateBlockedWordsCache();

			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: `Added "${blockedWord.word}" to the blocklist under category **${CATEGORY_LABELS[category]}**.`,
			});
		} catch (error) {
			logger.error("Failed to add blocked word:", error);
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Failed to add word to blocklist.",
			});
		}
	},
});

const RemoveSubcommand = subcommand({
	description: "Remove a word from the blocklist",
	options: {
		word: option.string({
			description: "The word to remove",
			required: true,
		}),
	},
	async handle(interaction, { word }) {
		const member = interaction.member;
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to manage the wordlist.",
			});
		}

		try {
			const deleted = await removeBlockedWord(word);
			invalidateBlockedWordsCache();

			if (deleted) {
				return await interaction.reply({
					flags: MessageFlags.Ephemeral,
					content: `Removed "${word.toLowerCase()}" from the blocklist.`,
				});
			}
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: `Word "${word.toLowerCase()}" was not found in the blocklist.`,
			});
		} catch (error) {
			logger.error("Failed to remove blocked word:", error);
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Failed to remove word from blocklist.",
			});
		}
	},
});

const ListSubcommand = subcommand({
	description: "View the current blocklist",
	options: {
		category: option.string({
			description: "Filter by category",
			choices: categoryChoices,
		}),
	},
	async handle(interaction, { category: rawCategory }) {
		const member = interaction.member;
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to view the wordlist.",
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const category = rawCategory as BlockedWordCategory | undefined;

		try {
			const words = category
				? await getBlockedWordsByCategory(category)
				: await getAllBlockedWords();

			if (words.length === 0) {
				return await interaction.editReply({
					content: category
						? `No blocked words in category **${CATEGORY_LABELS[category]}**.`
						: "The blocklist is empty.",
				});
			}

			// Group by category
			const grouped = new Map<BlockedWordCategory, string[]>();
			for (const word of words) {
				const existing = grouped.get(word.category) || [];
				existing.push(word.word);
				grouped.set(word.category, existing);
			}

			// about 3000 characters of words across the categories, within a message's 4000
			const maxPerCategory = Math.floor(3000 / grouped.size);
			return await interaction.editReply(
				renderDiscordMessage(
					<Message isV2>
						<Card
							accent="Red"
							title="Blocked Words"
							footer={`Total: ${words.length} words`}
							timestamp={Date.now()}
						>
							{[...grouped].map(([cat, wordList]) => {
								return (
									<Field
										key={cat}
										label={`${CATEGORY_LABELS[cat]} (${wordList.length})`}
									>
										{spoilerList(wordList, maxPerCategory)}
									</Field>
								);
							})}
						</Card>
					</Message>,
				),
			);
		} catch (error) {
			logger.error("Failed to list blocked words:", error);
			return await interaction.editReply({
				content: "Failed to fetch blocklist.",
			});
		}
	},
});

/** The words spoilered for safety, as many whole words as fit in `maxLength`, then how many more there are */
export function spoilerList(words: string[], maxLength: number): string {
	const shown: string[] = [];
	let length = 0;
	for (const word of words) {
		const item = `||${word}||`;
		// leaves room for the separator and the "and N more"
		if (length + item.length + 2 > maxLength - 20) break;
		shown.push(item);
		length += item.length + 2;
	}
	const hidden = words.length - shown.length;
	return shown.join(", ") + (hidden > 0 ? ` and ${hidden} more` : "");
}

const WordListTestSubcommand = subcommand({
	description: "Test if text would trigger the filter",
	options: {
		text: option.string({
			description: "The text to test",
			required: true,
		}),
		detect_bypasses: option.boolean({
			description: "Whether to detect bypass attempts (default: true)",
		}),
	},
	async handle(interaction, { text, detect_bypasses: detectBypasses = true }) {
		const member = interaction.member;
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to test the wordlist.",
			});
		}

		try {
			const result = await testForToxicContent(text, detectBypasses);

			const details: DetailItem[] = [
				["Detected", result.detected ? "Yes" : "No"],
				["Bypass detection", detectBypasses ? "Enabled" : "Disabled"],
			];
			if (result.detected) {
				details.push(
					["Matched word", `||${result.matchedWord}||`],
					[
						"Category",
						result.category ? CATEGORY_LABELS[result.category] : "Unknown",
					],
				);
				if (result.bypassAttempted) {
					details.push([
						"Bypass attempted",
						"Yes (text was normalized to detect)",
					]);
				}
			}

			return await interaction.reply(
				renderDiscordMessage(
					<Message isV2 flags={MessageFlags.Ephemeral}>
						<Card
							accent={result.detected ? "Red" : "Green"}
							title="Wordlist Test Result"
							timestamp={Date.now()}
						>
							<Field label="Input">{`||${excerpt(text, { maxLength: 1500 })}||`}</Field>
							<Details items={details} />
						</Card>
					</Message>,
				),
			);
		} catch (error) {
			logger.error("Failed to test text:", error);
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Failed to test text against blocklist.",
			});
		}
	},
});

export const WordlistCommand = defineCommand({
	name: "wordlist",
	description: "Manage the blocked words list",
	default_member_permissions: PermissionFlagsBits.ManageMessages,
	subcommands: {
		add: AddSubcommand,
		remove: RemoveSubcommand,
		list: ListSubcommand,
		test: WordListTestSubcommand,
	},
});
