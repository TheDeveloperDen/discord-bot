import type {
	APIMessageComponentEmoji,
	ButtonStyle,
	EmbedBuilder,
} from "discord.js";

export interface InformationMessage {
	content?: string;
	embed: EmbedBuilder;
	buttonRows: InformationButton[][];
}

interface BaseButton {
	label: string;
	emoji?: APIMessageComponentEmoji;
}

type InteractiveStyle =
	| ButtonStyle.Primary
	| ButtonStyle.Secondary
	| ButtonStyle.Success
	| ButtonStyle.Danger;

export type InformationButton =
	| (BaseButton & { type: "link"; url: string })
	| (BaseButton & { type: "faq"; faqId: string; style: InteractiveStyle })
	| (BaseButton & { type: "learning"; style: InteractiveStyle });
