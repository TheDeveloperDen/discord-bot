import { describe, expect, test } from "bun:test";
import { ComponentType, type MessageCreateOptions } from "discord.js";
import { Message, renderDiscordMessage, TextDisplay } from "disjsx";
import { branding } from "../util/branding.js";
import { Card } from "./Card.js";

type RenderedCard = {
	type: number;
	accent_color?: number;
	components: {
		type: number;
		content?: string;
		accessory?: { media: { url: string } };
	}[];
};

const render = (card: React.ReactElement) => {
	const payload = renderDiscordMessage(<Message isV2>{card}</Message>);
	// sendable as is
	const _: MessageCreateOptions = payload;
	// one container per card
	return payload.components as unknown as [RenderedCard];
};

describe("Card", () => {
	test("renders an accented container with a header, the body and a footer", () => {
		const [container] = render(
			<Card
				accent="Gold"
				author={{
					name: "Alice",
					iconUrl: "https://cdn/a.png",
					url: "https://discord.com/users/1",
				}}
				description="Add a #rust channel"
				footer="Suggestion ID: 1"
				timestamp={1_700_000_000_000}
			>
				<TextDisplay>hello</TextDisplay>
			</Card>,
		);

		expect(container.type).toBe(ComponentType.Container);
		expect(container.accent_color).toBe(0xf1c40f);
		const [header, body, footer] = container.components;
		if (!footer) throw new Error("card has no footer");
		expect(header).toMatchObject({
			type: ComponentType.Section,
			components: [
				{ content: "**[Alice](https://discord.com/users/1)**" },
				{ content: "Add a #rust channel" },
			],
			accessory: { media: { url: "https://cdn/a.png" } },
		});
		expect(body).toMatchObject({
			type: ComponentType.TextDisplay,
			content: "hello",
		});
		expect(footer.content).toBe(
			`-# ${branding.name} · Suggestion ID: 1 · <t:1700000000:R>`,
		);
	});

	test("uses plain text for a header without an icon, and the branding colour by default", () => {
		const [container] = render(<Card author={{ name: "Bob" }} />);

		expect(container.components[0]).toMatchObject({
			type: ComponentType.TextDisplay,
			content: "**Bob**",
		});
		expect(container.accent_color).toBe(
			Number.parseInt(branding.color.replace("#", ""), 16),
		);
		expect(container.components.at(-1)?.content).toBe(`-# ${branding.name}`);
	});

	test("leaves out the avatar when there's no text to sit beside it", () => {
		const [container] = render(
			<Card author={{ name: "Alice", iconUrl: "https://cdn/a.png" }} />,
		);

		expect(container.components[0]).toMatchObject({
			type: ComponentType.TextDisplay,
			content: "**Alice**",
		});
	});
});
