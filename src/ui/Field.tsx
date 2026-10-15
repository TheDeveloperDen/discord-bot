import { TextDisplay } from "disjsx";

/** A labelled value, like an embed field: the label in bold on its own line, then the value */
export function Field({
	label,
	children,
}: {
	label: string;
	children: string;
}) {
	return <TextDisplay>{`**${label}**\n${children}`}</TextDisplay>;
}
