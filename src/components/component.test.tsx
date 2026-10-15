import { describe, expect, test } from "bun:test";
import { ButtonStyle } from "discord.js";
import { ActionRow, Message, renderDiscordMessage } from "disjsx";
import { defineComponent } from "./component.js";

const Plain = defineComponent({
	id: "test:plain",
	kind: "button",
	handle() {},
});
const TwoArgs = defineComponent({
	id: "test:two",
	kind: "button",
	args: ["first", "rest"],
	handle() {},
});

/** Renders one button and returns its customId */
const customIdOf = (button: React.ReactElement) => {
	const { components } = renderDiscordMessage(
		<Message isV2>
			<ActionRow>{button}</ActionRow>
		</Message>,
	);
	const [row] = components as unknown as [
		{ components: { custom_id: string }[] },
	];
	return row.components[0]?.custom_id;
};

const style = ButtonStyle.Primary;

describe("component elements", () => {
	test("build their customId from the id and args", () => {
		expect(customIdOf(<Plain style={style}>x</Plain>)).toBe("test:plain");
		expect(
			customIdOf(
				<TwoArgs first="a" rest="b" style={style}>
					x
				</TwoArgs>,
			),
		).toBe("test:two:a:b");
	});

	test("pass their other props through", () => {
		const { components } = renderDiscordMessage(
			<Message isV2>
				<ActionRow>
					<TwoArgs first="a" rest="b" style={ButtonStyle.Danger} disabled>
						Delete
					</TwoArgs>
				</ActionRow>
			</Message>,
		);
		expect(components?.[0]).toMatchObject({
			components: [
				{ style: ButtonStyle.Danger, label: "Delete", disabled: true },
			],
		});
	});

	test("only the last arg may contain the separator", () => {
		expect(customIdOf(<TwoArgs first="a" rest="b:c" style={style} />)).toBe(
			"test:two:a:b:c",
		);
		expect(() =>
			customIdOf(<TwoArgs first="a:b" rest="c" style={style} />),
		).toThrow();
	});

	test("reject ids over 100 characters", () => {
		expect(() =>
			customIdOf(<TwoArgs first="a" rest={"x".repeat(100)} style={style} />),
		).toThrow();
	});

	test("args are type-checked", () => {
		// @ts-expect-error missing args
		const missing = <TwoArgs first="a" style={style} />;
		// @ts-expect-error unexpected args
		const extra = <Plain first="a" style={style} />;
		expect([missing, extra]).toHaveLength(2);
	});

	test("arg names can't clash with element props", () => {
		defineComponent({
			id: "test:clash",
			kind: "button",
			// @ts-expect-error clashes with the button's style prop
			args: ["style"],
			handle() {},
		});
	});
});
