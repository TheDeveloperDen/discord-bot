import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import {
	createDocsSnapshotLoader,
	parseDevDocsIndex,
	parseDevDocsManifest,
	parseSphinxInventory,
} from "./adapters.js";
import type { DocsSnapshot, DocsSource, DocsTarget } from "./types.js";

const encoder = new TextEncoder();

const pythonTarget: DocsTarget = {
	id: "stable",
	label: "Stable",
	provider: "sphinx",
	inventoryUrl: "https://docs.python.org/3/objects.inv",
	baseUrl: "https://docs.python.org/3/",
};

const pythonSource: DocsSource = {
	id: "python",
	name: "Python",
	aliases: ["py"],
	targets: [pythonTarget],
};

const nodeTarget: DocsTarget = {
	id: "stable",
	label: "Stable",
	provider: "devdocs",
	slug: "node",
};

const nodeSource: DocsSource = {
	id: "node",
	name: "Node.js",
	aliases: [],
	targets: [nodeTarget],
};

function sphinxInventory(version: string, entries: string): Uint8Array {
	const header = encoder.encode(
		`# Sphinx inventory version 2\n# Project: Python\n# Version: ${version}\n# The remainder of this file is compressed using zlib.\n`,
	);
	const compressed = deflateSync(encoder.encode(entries));
	const bytes = new Uint8Array(header.byteLength + compressed.byteLength);
	bytes.set(header);
	bytes.set(compressed, header.byteLength);
	return bytes;
}

function json(value: unknown): Uint8Array {
	return encoder.encode(JSON.stringify(value));
}

describe("Sphinx inventory adapter", () => {
	test("parses Sphinx grammar and pins Python stable links", async () => {
		const inventory = sphinxInventory(
			"3.14",
			[
				"asyncio.gather py:function 1 library/asyncio-task.html#$ -",
				"custom py:class 1 api.html#custom A custom display name",
				"option name rst:directive:option 1 directives.html#$ A directive option",
				"term std:label 1 labels.html#term A label with whitespace",
				"tutorial std:doc 1 tutorial.html -",
				"glossary term std:label 1 glossary.html#term -",
				"",
			].join("\n"),
		);
		const entries = parseSphinxInventory(
			inventory,
			"https://docs.python.org/3.14/",
		);
		expect(entries).toEqual({
			version: "3.14",
			entries: [
				{
					name: "asyncio.gather",
					type: "py:function",
					url: "https://docs.python.org/3.14/library/asyncio-task.html#asyncio.gather",
				},
				{
					name: "custom",
					type: "py:class",
					url: "https://docs.python.org/3.14/api.html#custom",
				},
				{
					name: "option name",
					type: "rst:directive:option",
					url: "https://docs.python.org/3.14/directives.html#option%20name",
				},
				{
					name: "A label with whitespace",
					type: "std:label",
					url: "https://docs.python.org/3.14/labels.html#term",
				},
				{
					name: "tutorial",
					type: "std:doc",
					url: "https://docs.python.org/3.14/tutorial.html",
				},
				{
					name: "glossary term",
					type: "std:label",
					url: "https://docs.python.org/3.14/glossary.html#term",
				},
			],
		});

		const transportCalls: string[] = [];
		const load = createDocsSnapshotLoader(async (url) => {
			transportCalls.push(url);
			return inventory;
		});
		const snapshot = await load(pythonSource, pythonTarget);
		expect(transportCalls).toEqual(["https://docs.python.org/3/objects.inv"]);
		expect(snapshot.entries[0]?.url).toBe(
			"https://docs.python.org/3.14/library/asyncio-task.html#asyncio.gather",
		);
	});

	test("rejects entries that escape the configured documentation base", () => {
		const inventory = sphinxInventory(
			"3.14",
			"bad py:function 1 https://example.com/escape -",
		);
		expect(() =>
			parseSphinxInventory(inventory, "https://docs.python.org/3.14/"),
		).toThrow("outside the configured base URL");
	});
});

describe("Documentation download recovery", () => {
	test("retries a timed-out Sphinx inventory and parses the successful retry", async () => {
		const inventory = sphinxInventory(
			"3.14",
			"asyncio.gather py:function 1 library/asyncio-task.html#$ -",
		);
		const waits: number[] = [];
		const signals: AbortSignal[] = [];
		let attempts = 0;
		const load = createDocsSnapshotLoader(
			async (_url, signal) => {
				signals.push(signal);
				attempts++;
				if (attempts === 1) {
					throw new DOMException("The operation timed out", "TimeoutError");
				}
				return inventory;
			},
			async (delayMs) => {
				waits.push(delayMs);
			},
		);

		const snapshot = await load(pythonSource, pythonTarget);

		expect(snapshot).toMatchObject({
			version: "3.14",
			entries: [
				{
					name: "asyncio.gather",
					type: "py:function",
					url: "https://docs.python.org/3.14/library/asyncio-task.html#asyncio.gather",
				},
			],
		});
		expect(waits).toEqual([1_000]);
		expect(new Set(signals).size).toBe(2);
	});

	test("does not re-download a successful manifest when the index times out", async () => {
		const manifest = json([
			{ slug: "node", version: "", release: "24.0.0", mtime: 1_700_000_000 },
		]);
		const index = json({
			types: [{ name: "Globals", slug: "globals", count: 1 }],
			entries: [{ name: "Array", path: "globals#array", type: "Globals" }],
		});
		const calls: string[] = [];
		const waits: number[] = [];
		let indexAttempts = 0;
		const load = createDocsSnapshotLoader(
			async (url) => {
				calls.push(url);
				if (url === "https://devdocs.io/docs.json") return manifest;
				indexAttempts++;
				if (indexAttempts === 1) {
					throw new DOMException("The operation timed out", "TimeoutError");
				}
				return index;
			},
			async (delayMs) => {
				waits.push(delayMs);
			},
		);

		const snapshot = await load(nodeSource, nodeTarget);

		expect(calls).toEqual([
			"https://devdocs.io/docs.json",
			"https://documents.devdocs.io/node/index.json",
			"https://documents.devdocs.io/node/index.json",
		]);
		expect(waits).toEqual([1_000]);
		expect(snapshot.entries).toEqual([
			{
				name: "Array",
				type: "Globals",
				url: "https://devdocs.io/node/globals#array",
			},
		]);
	});

	test("stops after three timed-out attempts and retains the final cause", async () => {
		const waits: number[] = [];
		const signals: AbortSignal[] = [];
		const errors: DOMException[] = [];
		const load = createDocsSnapshotLoader(
			async (_url, signal) => {
				signals.push(signal);
				const error = new DOMException(
					"The operation timed out",
					"TimeoutError",
				);
				errors.push(error);
				throw error;
			},
			async (delayMs) => {
				waits.push(delayMs);
			},
		);

		try {
			await load(pythonSource, pythonTarget);
			throw new Error("Expected documentation download to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			if (!(error instanceof Error)) throw error;
			expect(error.message).toContain("https://docs.python.org/3/objects.inv");
			expect(error.message).toContain("3 attempts");
			expect(error.cause).toBe(errors[2]);
		}
		expect(waits).toEqual([1_000, 2_000]);
		expect(new Set(signals).size).toBe(3);
	});

	test.each([
		new Error("Documentation request failed with HTTP 404"),
		new DOMException("Request cancelled", "AbortError"),
	])("does not retry non-timeout request failures: %s", async (failure) => {
		let calls = 0;
		const load = createDocsSnapshotLoader(async () => {
			calls++;
			throw failure;
		});

		await expect(load(nodeSource, nodeTarget)).rejects.toMatchObject({
			cause: failure,
		});
		expect(calls).toBe(1);
	});

	test("does not retry a DevDocs manifest schema failure", async () => {
		let calls = 0;
		const load = createDocsSnapshotLoader(async () => {
			calls++;
			return json([{ slug: "node", mtime: "invalid" }]);
		});

		await expect(load(nodeSource, nodeTarget)).rejects.toThrow(Error);
		expect(calls).toBe(1);
	});
});

describe("DevDocs adapter", () => {
	test("uses publisher release and constructs only DevDocs result URLs", () => {
		expect(
			parseDevDocsManifest(
				[
					{
						slug: "typescript",
						version: "",
						release: "5.9",
						mtime: 1_700_000_000,
					},
				],
				"typescript",
			),
		).toEqual({ version: "5.9", upstreamUpdatedAt: 1_700_000_000_000 });
		expect(
			parseDevDocsIndex("typescript", {
				types: [{ name: "Utility Types", slug: "utility-types", count: 1 }],
				entries: [
					{
						name: "Partial<Type>",
						path: "utility-types#partialtype",
						type: "Utility Types",
					},
				],
			}),
		).toEqual([
			{
				name: "Partial<Type>",
				type: "Utility Types",
				url: "https://devdocs.io/typescript/utility-types#partialtype",
			},
		]);
		expect(() =>
			parseDevDocsIndex("typescript", {
				types: [],
				entries: [
					{ name: "unsafe", path: "https://example.com/", type: "Test" },
				],
			}),
		).toThrow("must be relative");
		expect(() =>
			parseDevDocsIndex("typescript", {
				types: [],
				entries: [{ name: "unsafe", path: "guide%0aentry", type: "Test" }],
			}),
		).toThrow("unsafe characters");
	});

	test("reuses a valid previous index when the upstream mtime is unchanged", async () => {
		const manifest = json([
			{ slug: "node", version: "", release: "24.0.0", mtime: 1_700_000_000 },
		]);
		const index = json({
			types: [{ name: "Globals", slug: "globals", count: 1 }],
			entries: [{ name: "Array", path: "globals#array", type: "Globals" }],
		});
		const calls: string[] = [];
		const load = createDocsSnapshotLoader(async (url) => {
			calls.push(url);
			if (url === "https://devdocs.io/docs.json") return manifest;
			if (url === "https://documents.devdocs.io/node/index.json") return index;
			throw new Error(`Unexpected URL: ${url}`);
		});
		const target = nodeTarget;
		const first = await load(nodeSource, target);
		const second = await load(nodeSource, target, first);

		expect(calls).toEqual([
			"https://devdocs.io/docs.json",
			"https://documents.devdocs.io/node/index.json",
			"https://devdocs.io/docs.json",
		]);
		expect(second.entries).toEqual(first.entries);
		expect(second.upstreamUpdatedAt).toBe(1_700_000_000_000);
		expect(second.refreshedAt).toBeGreaterThanOrEqual(first.refreshedAt);
	});

	test("does not reuse an invalid previous snapshot", async () => {
		const manifest = json([
			{ slug: "node", version: "", release: "24.0.0", mtime: 1_700_000_000 },
		]);
		const index = json({
			types: [{ name: "Globals", slug: "globals", count: 1 }],
			entries: [{ name: "Array", path: "globals#array", type: "Globals" }],
		});
		let indexRequests = 0;
		const load = createDocsSnapshotLoader(async (url) => {
			if (url === "https://devdocs.io/docs.json") return manifest;
			indexRequests++;
			return index;
		});
		const invalidPrevious: DocsSnapshot = {
			sourceId: "node",
			targetId: "stable",
			provider: "devdocs",
			version: "24.0.0",
			entries: [
				{ name: "Array", type: "Globals", url: "https://example.com/" },
			],
			refreshedAt: 0,
			upstreamUpdatedAt: 1_700_000_000_000,
		};

		const snapshot = await load(nodeSource, nodeTarget, invalidPrevious);
		expect(indexRequests).toBe(1);
		expect(snapshot.entries[0]?.url).toBe(
			"https://devdocs.io/node/globals#array",
		);
	});
});
