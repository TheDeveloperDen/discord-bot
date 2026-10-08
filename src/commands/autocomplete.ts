import type {
	ApplicationCommandOptionChoiceData,
	AutocompleteInteraction,
} from "discord.js";

/** Discord shows at most 25 autocomplete choices */
const MAX_CHOICES = 25;

/**
 * Responds to an autocomplete interaction with the choices matching what the user has typed.
 * With nothing typed, the first {@link MAX_CHOICES} choices are shown.
 */
export async function respondWithChoices(
	interaction: AutocompleteInteraction,
	choices: ApplicationCommandOptionChoiceData<string>[],
) {
	const typed = interaction.options.getFocused().trim().toLowerCase();
	const matches = choices
		.filter((c) => c.name.toLowerCase().includes(typed))
		.sort(
			(a, b) =>
				Number(b.name.toLowerCase().startsWith(typed)) -
					Number(a.name.toLowerCase().startsWith(typed)) ||
				a.name.localeCompare(b.name),
		)
		.slice(0, MAX_CHOICES);
	await interaction.respond(matches);
}
