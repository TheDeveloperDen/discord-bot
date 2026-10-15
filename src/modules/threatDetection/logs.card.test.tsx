import { describe, expect, test } from "bun:test";
import {
	type APIMessageTopLevelComponent,
	Colors,
	ComponentType,
	type User,
} from "discord.js";
import { createMockUser } from "../../tests/mocks/discord.js";
import { renderThreatLog } from "./logs.card.js";
import type { ThreatLog } from "./logs.js";

const user = Object.assign(createMockUser({ id: "67890" }), {
	displayName: "Spammer",
	displayAvatarURL: () => "https://cdn/a.png",
}) as unknown as User;

function render(log: ThreatLog, target: User | null = user) {
	const [container] = renderThreatLog(log, target)
		.components as unknown as APIMessageTopLevelComponent[];
	if (container?.type !== ComponentType.Container) {
		throw new Error("the alert isn't a card");
	}
	const texts = container.components.flatMap((child) =>
		child.type === ComponentType.TextDisplay
			? [child.content]
			: child.type === ComponentType.Section
				? child.components.map((text) => text.content)
				: [],
	);
	return { accent: container.accent_color, texts, text: texts.join("\n") };
}

describe("renderThreatLog", () => {
	test("shows the user beside a summary, then the details", () => {
		const { accent, texts, text } = render({
			kind: "SpamDetected",
			target: user,
			messageCount: 8,
			windowSeconds: 5,
			action: "Timed out",
		});

		expect(accent).toBe(Colors.Orange);
		expect(texts[0]).toBe("## Spam Detected");
		expect(text).toContain("<@67890>");
		expect(text).toContain("Sent **8 messages** in 5 seconds.");
		expect(text).toContain("**Action taken:** Timed out");
		expect(text).toContain("User ID: 67890");
	});

	test("renders an alert that isn't about one user", () => {
		const { texts, text } = render(
			{
				kind: "RaidAlert",
				joinCount: 20,
				windowSeconds: 10,
				newAccountCount: 15,
				raidModeActivated: true,
			},
			null,
		);

		expect(texts[0]).toBe("## Raid Alert");
		expect(text).toContain("**20 users joined** in 10 seconds!");
		expect(text).toContain("**Raid mode activated:** Yes");
		expect(text).not.toContain("User ID");
	});

	test("still mentions a user who couldn't be fetched", () => {
		const { text } = render(
			{
				kind: "SuspiciousAccount",
				target: user,
				accountAgeDays: 0.5,
				reasons: ["New account", "Default avatar"],
			},
			null,
		);
		expect(text).toContain("<@67890>");
		expect(text).toContain("**Reasons:** New account, Default avatar");
	});

	test("spoilers a matched toxic word", () => {
		const { text } = render({
			kind: "ToxicContentDetected",
			target: user,
			matchedWord: "badword",
			category: null,
			bypassAttempted: true,
			action: "Deleted",
		});
		expect(text).toContain("**Matched word:** ||badword||");
		expect(text).toContain("**Bypass attempted:** Yes");
		expect(text).not.toContain("**Category:**");
	});
});
