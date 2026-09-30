import { describe, expect, test } from "bun:test";
import { parseTimespan, prettyPrintDuration } from "./timespan.js";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

describe("parseTimespan", () => {
	test.each([
		["30s", 30 * SECOND],
		["5m", 5 * MINUTE],
		["2h", 2 * HOUR],
		["3d", 3 * DAY],
		["1w", WEEK],
		["1M", 4.3 * WEEK],
	])("parses single-unit span %p", (input, expected) => {
		expect(parseTimespan(input)).toBe(expected);
	});

	test.each([
		["5minutes", 5 * MINUTE],
		["1hour", HOUR],
		["2days", 2 * DAY],
		["10seconds", 10 * SECOND],
	])("parses long unit names %p", (input, expected) => {
		expect(parseTimespan(input)).toBe(expected);
	});

	test("adds up multiple units", () => {
		expect(parseTimespan("1h30m")).toBe(HOUR + 30 * MINUTE);
		expect(parseTimespan("1d12h30m15s")).toBe(
			DAY + 12 * HOUR + 30 * MINUTE + 15 * SECOND,
		);
	});

	test("m is minutes and M is months", () => {
		expect(parseTimespan("1m")).toBe(MINUTE);
		expect(parseTimespan("1M")).toBe(4.3 * WEEK);
	});

	test.each([
		"",
		"abc",
		"5",
		"5x",
		"h",
	])("returns 0 for invalid span %p", (input) => {
		expect(parseTimespan(input)).toBe(0);
	});

	test("ignores unknown units alongside valid ones", () => {
		expect(parseTimespan("1h5x")).toBe(HOUR);
	});
	test("allows spaces between parts", () => {
		expect(parseTimespan("1h 30m")).toBe(HOUR + 30 * MINUTE);
	});

	test("allows a space between number and unit", () => {
		expect(parseTimespan("5 minutes")).toBe(5 * MINUTE);
	});

	test("a year is roughly 365 days", () => {
		expect(parseTimespan("1y")).toBe(365 * DAY);
	});
});

describe("prettyPrintDuration", () => {
	test.each([
		[0, "0 seconds"],
		[500, "0 seconds"],
		[SECOND, "1 second"],
		[2 * MINUTE, "2 minutes"],
		[HOUR + 30 * MINUTE, "1 hour, 30 minutes"],
		[
			DAY + 2 * HOUR + 3 * MINUTE + 4 * SECOND,
			"1 day, 2 hours, 3 minutes, 4 seconds",
		],
		[2 * WEEK, "2 weeks"],
	])("formats %p as %p", (input, expected) => {
		expect(prettyPrintDuration(input)).toBe(expected);
	});

	test("round-trips with parseTimespan", () => {
		expect(prettyPrintDuration(parseTimespan("1d12h"))).toBe("1 day, 12 hours");
	});
});
