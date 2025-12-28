import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	EmbedBuilder,
	type GuildMember,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import type { Command, ExecutableSubcommand } from "djs-slash-helper";
import { logger } from "../../logging.js";
import {
	addBlockedWord,
	BlockedWordCategory,
	getAllBlockedWords,
	getBlockedWordsByCategory,
	removeBlockedWord,
} from "../../store/models/BlockedWord.js";
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

const AddSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "add",
	description: "Add a word to the blocklist",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "word",
			description: "The word to block",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "category",
			description: "Category for the blocked word",
			required: false,
			choices: categoryChoices,
		},
	],
	async handle(interaction) {
		const member = interaction.member as GuildMember | null;
		if (!member) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "This command must be used in a server.",
			});
		}
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to manage the wordlist.",
			});
		}

		const word = interaction.options.getString("word", true);
		const category =
			(interaction.options.getString("category") as BlockedWordCategory) ||
			BlockedWordCategory.OTHER;

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
};

const RemoveSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "remove",
	description: "Remove a word from the blocklist",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "word",
			description: "The word to remove",
			required: true,
		},
	],
	async handle(interaction) {
		const member = interaction.member as GuildMember | null;
		if (!member) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "This command must be used in a server.",
			});
		}
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to manage the wordlist.",
			});
		}

		const word = interaction.options.getString("word", true);

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
};

const ListSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "list",
	description: "View the current blocklist",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "category",
			description: "Filter by category",
			required: false,
			choices: categoryChoices,
		},
	],
	async handle(interaction) {
		const member = interaction.member as GuildMember | null;
		if (!member) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "This command must be used in a server.",
			});
		}
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to view the wordlist.",
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const category = interaction.options.getString(
			"category",
		) as BlockedWordCategory | null;

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

			const embed = new EmbedBuilder()
				.setTitle("Blocked Words")
				.setColor("Red")
				.setTimestamp()
				.setFooter({ text: `Total: ${words.length} words` });

			for (const [cat, wordList] of grouped) {
				// Spoiler each word for safety
				const spoilered = wordList.map((w) => `||${w}||`).join(", ");
				const truncated =
					spoilered.length > 1000 ? `${spoilered.slice(0, 997)}...` : spoilered;

				embed.addFields({
					name: `${CATEGORY_LABELS[cat]} (${wordList.length})`,
					value: truncated || "None",
				});
			}

			return await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			logger.error("Failed to list blocked words:", error);
			return await interaction.editReply({
				content: "Failed to fetch blocklist.",
			});
		}
	},
};

const WordListTestSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "test",
	description: "Test if text would trigger the filter",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "text",
			description: "The text to test",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.Boolean,
			name: "detect_bypasses",
			description: "Whether to detect bypass attempts (default: true)",
			required: false,
		},
	],
	async handle(interaction) {
		const member = interaction.member as GuildMember | null;
		if (!member) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "This command must be used in a server.",
			});
		}
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to test the wordlist.",
			});
		}

		const text = interaction.options.getString("text", true);
		const detectBypasses =
			interaction.options.getBoolean("detect_bypasses") ?? true;

		try {
			const result = await testForToxicContent(text, detectBypasses);

			const embed = new EmbedBuilder()
				.setTitle("Wordlist Test Result")
				.setColor(result.detected ? "Red" : "Green")
				.addFields(
					{
						name: "Input",
						value: `||${text}||`,
						inline: false,
					},
					{
						name: "Detected",
						value: result.detected ? "Yes" : "No",
						inline: true,
					},
					{
						name: "Bypass Detection",
						value: detectBypasses ? "Enabled" : "Disabled",
						inline: true,
					},
				)
				.setTimestamp();

			if (result.detected) {
				embed.addFields(
					{
						name: "Matched Word",
						value: `||${result.matchedWord}||`,
						inline: true,
					},
					{
						name: "Category",
						value: result.category
							? CATEGORY_LABELS[result.category]
							: "Unknown",
						inline: true,
					},
				);

				if (result.bypassAttempted) {
					embed.addFields({
						name: "Bypass Attempted",
						value: "Yes (text was normalized to detect)",
						inline: false,
					});
				}
			}

			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				embeds: [embed],
			});
		} catch (error) {
			logger.error("Failed to test text:", error);
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Failed to test text against blocklist.",
			});
		}
	},
};

export const WordlistCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "wordlist",
	description: "Manage the blocked words list",
	type: ApplicationCommandType.ChatInput,
	default_permission: false,
	options: [
		AddSubcommand,
		RemoveSubcommand,
		ListSubcommand,
		WordListTestSubcommand,
	],
	handle() {},
};
