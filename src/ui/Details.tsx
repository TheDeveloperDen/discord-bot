import { TextDisplay } from "disjsx";

export type DetailItem = [label: string, value: string];

/** Short labelled values, one per line, like inline embed fields: `**Label:** value` */
export const detailText = (items: DetailItem[]) =>
	items.map(([label, value]) => `**${label}:** ${value}`).join("\n");

/** Renders nothing when there are no items, since an empty text display isn't allowed */
export function Details({ items }: { items: DetailItem[] }) {
	return (
		<>{items.length > 0 && <TextDisplay>{detailText(items)}</TextDisplay>}</>
	);
}
