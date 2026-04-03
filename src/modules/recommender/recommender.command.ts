import { ApplicationCommandType, MessageFlags } from "discord.js";
import type { Command } from "djs-slash-helper";
import { createQuizSession, getNextQuestion } from "./engine/quiz.js";
import { createSession } from "./recommender.listener.js";
import { renderQuestionMessage } from "./recommender.render.js";

export const WhatLangCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "whatlang",
	description: "Find out what programming language or stack you should learn",
	type: ApplicationCommandType.ChatInput,
	options: [],
	async handle(interaction) {
		const session = createQuizSession();
		const question = getNextQuestion(session);
		if (!question) return;

		const sessionKey = createSession(
			interaction.user.id,
			interaction.id,
			session,
		);

		const message = renderQuestionMessage(question, session, sessionKey);
		await interaction.reply({
			...message,
			flags: MessageFlags.Ephemeral,
			withResponse: false,
		});
	},
};
