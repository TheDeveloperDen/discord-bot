import { describe, expect, test } from "bun:test";
import { excerpt } from "./strings.js";

describe("excerpt", () => {
	test("leaves short text alone", () => {
		expect(excerpt("hello\nworld", { maxLength: 100, maxLines: 4 })).toBe(
			"hello\nworld",
		);
	});

	test("keeps at most maxLines lines", () => {
		expect(excerpt("1\n2\n3\n4\n5", { maxLength: 100, maxLines: 2 })).toBe(
			"1\n2…",
		);
	});

	test("keeps within maxLength, including the ellipsis", () => {
		const result = excerpt("a".repeat(500), { maxLength: 100 });
		expect(result.length).toBeLessThanOrEqual(100);
		expect(result.endsWith("…")).toBe(true);
	});

	test("closes a code block it cuts through", () => {
		const code = 'look:\n```rs\nfn main() {\n    println!("hi");\n}\n```';
		const result = excerpt(code, { maxLength: 100, maxLines: 3 });
		expect(result).toBe("look:\n```rs\nfn main() {…\n```");
		expect(result.length).toBeLessThanOrEqual(100);
	});
});
