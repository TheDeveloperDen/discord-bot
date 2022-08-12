import {ButtonBuilder, EmbedBuilder} from 'discord.js'

export type InformationMessage = {
	content?: string,
	embed: EmbedBuilder,
	buttons: (FAQButton | LearningButton | PlainButton)[]
}

export type FAQButton = { type: 'faq' } & {
	faqId: string,
	button: ButtonBuilder
}
export type PlainButton = ButtonBuilder

export type LearningButton = {
	type: 'learning',
	button: ButtonBuilder
}