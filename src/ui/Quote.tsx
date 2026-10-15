import { TextDisplay } from "disjsx";

/** Another message's text as a block quote, attributed to its author (e.g. the message a starred message replied to) */
export function Quote(props: {
	author: string;
	/** Links the attribution to the quoted message */
	url?: string;
	children: string;
}) {
	return <TextDisplay>{quoteText(props)}</TextDisplay>;
}

/** The markdown {@link Quote} renders, for combining with other text in one block */
export function quoteText({
	author,
	url,
	children,
}: {
	author: string;
	url?: string;
	children: string;
}) {
	const attribution = url ? `[${author}](${url})` : author;
	const quoted = children
		.split("\n")
		.map((line) => `> ${line}`)
		.join("\n");
	return `Replying to **${attribution}**\n${quoted}`;
}
