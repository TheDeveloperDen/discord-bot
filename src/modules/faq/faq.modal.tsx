import { MessageFlags, PermissionFlagsBits, TextInputStyle } from "discord.js";
import { Label, TextInput } from "disjsx";
import { defineComponent } from "../../components/index.js";
import { FAQ } from "../../store/models/FAQ.js";

export const FaqEditModal = defineComponent({
	id: "faq:edit",
	kind: "modal",
	args: ["name"],
	async handle(interaction, { name }) {
		if (
			!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
		) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "No permission",
			});
			return;
		}
		const faq = await FAQ.findOne({ where: { name } });
		await FAQ.upsert({
			id: faq?.id,
			name,
			title: interaction.fields.getTextInputValue("titleField"),
			content: interaction.fields.getTextInputValue("faqContentField"),
			author: BigInt(interaction.user.id),
		});
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: `FAQ named ${name} ${faq ? "updated" : "created"}`,
		});
	},
});

/** The edit form for a FAQ, prefilled when it already exists */
export const FaqEditForm = ({ name, faq }: { name: string; faq?: FAQ }) => (
	<FaqEditModal name={name} title="FAQ Content">
		<Label label="Title">
			<TextInput
				customId="titleField"
				style={TextInputStyle.Short}
				maxLength={64}
				value={faq?.title}
			/>
		</Label>
		<Label label="Content">
			<TextInput
				customId="faqContentField"
				style={TextInputStyle.Paragraph}
				value={faq?.content}
			/>
		</Label>
	</FaqEditModal>
);
