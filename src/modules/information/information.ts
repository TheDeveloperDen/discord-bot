import { ButtonBuilder, EmbedBuilder } from 'discord.js'

export interface InformationMessage {
  content?: string
  embed: EmbedBuilder
  buttonRows: CustomButton[][]
}

export type CustomButton = FAQButton | LearningButton | PlainButton

export type FAQButton = { type: 'faq' } & {
  faqId: string
  button: ButtonBuilder
}
export type PlainButton = ButtonBuilder

export interface LearningButton {
  type: 'learning'
  button: ButtonBuilder
}
