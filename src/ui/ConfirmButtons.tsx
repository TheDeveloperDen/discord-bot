import { ButtonStyle } from "discord.js";
import { ActionRow, Button } from "disjsx";

/** A confirm / cancel pair. */
export function ConfirmButtons({
	confirmId,
	cancelId,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
}: {
	confirmId: string;
	cancelId: string;
	confirmLabel?: string;
	cancelLabel?: string;
}) {
	return (
		<ActionRow>
			<Button style={ButtonStyle.Success} customId={confirmId}>
				{confirmLabel}
			</Button>
			<Button style={ButtonStyle.Danger} customId={cancelId}>
				{cancelLabel}
			</Button>
		</ActionRow>
	);
}
