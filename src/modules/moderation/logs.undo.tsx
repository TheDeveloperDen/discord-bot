import {
	type APIMessageTopLevelComponent,
	ButtonStyle,
	ComponentType,
	type Message,
	MessageFlags,
	PermissionFlagsBits,
	type PermissionsBitField,
	TextInputStyle,
} from "discord.js";
import { Label, renderDiscordModal, TextInput } from "disjsx";
import { defineComponent } from "../../components/index.js";
import { logger } from "../../logging.js";
import {
	MAX_PARDON_REASON_LENGTH,
	pardonWarning,
	removeTimeout,
	type UndoResult,
	unbanUser,
} from "./undo.js";

export type UndoAction = "unban" | "pardon" | "untimeout";

const undoActions: Record<
	UndoAction,
	{
		button: string;
		doneMessage: string;
		formTitle: (targetId: string) => string;
		permission: bigint;
		reasonRequired: boolean;
		maxReasonLength: number;
	}
> = {
	unban: {
		button: "Unban",
		doneMessage: "Unbanned",
		formTitle: () => "Unban user",
		permission: PermissionFlagsBits.BanMembers,
		reasonRequired: false,
		// Discord's audit log reason limit
		maxReasonLength: 512,
	},
	pardon: {
		button: "Pardon",
		doneMessage: "Pardoned",
		formTitle: (warningId) => `Pardon warning #${warningId}`,
		permission: PermissionFlagsBits.ModerateMembers,
		reasonRequired: true,
		maxReasonLength: MAX_PARDON_REASON_LENGTH,
	},
	untimeout: {
		button: "Remove timeout",
		doneMessage: "Timeout removed",
		formTitle: () => "Remove timeout",
		permission: PermissionFlagsBits.ModerateMembers,
		reasonRequired: false,
		maxReasonLength: 512,
	},
};

const isUndoAction = (action: string): action is UndoAction =>
	Object.hasOwn(undoActions, action);

const REASON_INPUT_ID = "reason";
const NO_PERMISSION = "You don't have permission to do that.";

const canUndo = (
	permissions: Readonly<PermissionsBitField> | null,
	action: UndoAction,
) => permissions?.has(undoActions[action].permission) ?? false;

/** The undo button on a mod log card. Asks for a reason before doing anything. */
export const UndoButton = defineComponent({
	id: "modlog:undo",
	kind: "button",
	args: ["action", "targetId"],
	async handle(interaction, { action, targetId }) {
		if (!isUndoAction(action)) return;
		if (!canUndo(interaction.memberPermissions, action)) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: NO_PERMISSION,
			});
			return;
		}
		await interaction.showModal(
			renderDiscordModal(<UndoFormView action={action} targetId={targetId} />),
		);
	},
});

/** The button for `action`, for a card's action row */
export const UndoButtonView = ({
	action,
	targetId,
}: {
	action: UndoAction;
	targetId: string;
}) => (
	<UndoButton
		action={action}
		targetId={targetId}
		style={ButtonStyle.Secondary}
		emoji={{ name: "↩️" }}
	>
		{undoActions[action].button}
	</UndoButton>
);

export const UndoForm = defineComponent({
	id: "modlog:undo-form",
	kind: "modal",
	args: ["action", "targetId"],
	async handle(interaction, { action, targetId }) {
		if (!isUndoAction(action) || !interaction.inCachedGuild()) return;
		// doesn't hurt to be safe
		if (!canUndo(interaction.memberPermissions, action)) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: NO_PERMISSION,
			});
			return;
		}
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const field = interaction.fields.fields.get(REASON_INPUT_ID);
		const reason =
			(field?.type === ComponentType.TextInput && field.value.trim()) ||
			undefined;
		let result: UndoResult;
		switch (action) {
			case "unban":
				result = await unbanUser(
					interaction.guild,
					interaction.user,
					targetId,
					reason,
				);
				break;
			case "pardon":
				result = await pardonWarning(
					interaction.guild,
					interaction.user,
					Number(targetId),
					reason ?? "",
				);
				break;
			case "untimeout":
				result = await removeTimeout(interaction.member, targetId, reason);
				break;
		}

		if ((result.ok || result.alreadyDone) && interaction.isFromMessage()) {
			await markUndone(
				interaction.message,
				result.ok
					? `**${undoActions[action].doneMessage}** by <@${interaction.user.id}> <t:${Math.floor(Date.now() / 1000)}:R>`
					: `**${undoActions[action].doneMessage}**`,
			);
		}
		await interaction.editReply(result.message);
	},
});

const UndoFormView = ({
	action,
	targetId,
}: {
	action: UndoAction;
	targetId: string;
}) => {
	const { formTitle, reasonRequired, maxReasonLength } = undoActions[action];
	return (
		<UndoForm action={action} targetId={targetId} title={formTitle(targetId)}>
			<Label label={reasonRequired ? "Reason" : "Reason (optional)"}>
				<TextInput
					customId={REASON_INPUT_ID}
					style={TextInputStyle.Paragraph}
					required={reasonRequired}
					maxLength={maxReasonLength}
				/>
			</Label>
		</UndoForm>
	);
};

export const undoComponents = [UndoButton, UndoForm];

/**
 * Marks a mod log card as undone, adding `line` above its footer and disabling its buttons.
 * This edits the sent message's component JSON because the log's data isn't stored anywhere to re-render from.
 * TODO: once log entries are stored (planned with the Drizzle migration), re-render the card in JSX with an
 * `undone` prop instead, like suggestions do, and delete this and `withUndoneLine`.
 */
async function markUndone(message: Message, line: string) {
	try {
		await message.edit({
			components: withUndoneLine(
				message.components.map((component) => component.toJSON()),
				line,
			),
		});
	} catch (error) {
		logger.error(
			`Couldn't mark mod log message ${message.id} as undone`,
			error,
		);
	}
}

/** `components` with `line` added above the card's footer and every button disabled */
export function withUndoneLine(
	components: APIMessageTopLevelComponent[],
	line: string,
): APIMessageTopLevelComponent[] {
	return components.map((component) => {
		if (component.type === ComponentType.Container) {
			const inner = [...component.components];
			// the footer is always the card's last component
			inner.splice(Math.max(inner.length - 1, 0), 0, {
				type: ComponentType.TextDisplay,
				content: line,
			});
			return { ...component, components: inner };
		}
		if (component.type === ComponentType.ActionRow) {
			return {
				...component,
				components: component.components.map((child) =>
					child.type === ComponentType.Button
						? { ...child, disabled: true }
						: child,
				),
			};
		}
		return component;
	});
}
