import type { APIMessageComponentEmoji, ButtonStyle } from "discord.js";

export interface InformationMessage {
	title: string;
	description: string;
	/** An image shown under the description */
	banner?: string;
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
