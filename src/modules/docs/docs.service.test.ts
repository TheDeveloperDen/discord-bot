import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DocsService } from "./docs.service.js";
import type { DocsEntry, DocsSnapshot, DocsSource } from "./types.js";

const source: DocsSource = {
	id: "typescript",
	name: "TypeScript",
	aliases: ["ts"],
	targets: [
		{
			id: "stable",
			label: "Stable",
			provider: "devdocs",
			slug: "typescript",
		},
		{
			id: "next",
			label: "Next",
			provider: "devdocs",
			slug: "typescript~next",
		},
	],
};

const pythonSource: DocsSource = {
	id: "python",
	name: "Python",
	aliases: ["py"],
	targets: [
		{
			id: "3.12",
			label: "Python 3.12",
			provider: "sphinx",
			inventoryUrl: "https://docs.python.org/3.12/objects.inv",
			baseUrl: "https://docs.python.org/3.12/",
		},
	],
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

function snapshot(
	targetId = "stable",
	entries: DocsEntry[] = [entry("Array.map")],
): DocsSnapshot {
	return {
		sourceId: source.id,
		targetId,
		provider: "devdocs",
		version: targetId === "stable" ? "5.8" : "6.0",
		entries:
			targetId === "stable"
				? entries
				: entries.map((entry) => ({
						...entry,
						url: entry.url.replace("/typescript/", "/typescript~next/"),
					})),
		refreshedAt: 1_000,
		upstreamUpdatedAt: 900,
	};
}

function entry(name: string): DocsEntry {
	return {
		name,
		type: "Method",
		url: `https://devdocs.io/typescript/${encodeURIComponent(name)}`,
	};
}

async function temporaryCache(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "docs-service-"));
	temporaryDirectories.push(directory);
	return directory;
}

describe("DocsService lookup", () => {
	test("ranks exact names, qualified suffixes, prefixes, substrings, then conservative typos", async () => {
		const cacheDir = await temporaryCache();
		const service = new DocsService({
			cacheDir,
			sources: [source],
			loadSnapshot: async (_source, target) =>
				snapshot(target.id, [
					entry("Array.map"),
					entry("Map"),
					entry("Map.prototype"),
					entry("someMap"),
					entry("asyncio.gather"),
				]),
		});
		await service.refresh();

		const autocomplete = service.lookup("typescript", "stable", "", 2);
		expect(autocomplete).toMatchObject({ status: "ready", exact: false });
		if (autocomplete.status !== "ready")
			throw new Error("Expected a ready lookup");
		expect(autocomplete.entries.map(({ name }) => name)).toEqual([
			"Array.map",
			"asyncio.gather",
		]);

		const ranked = service.lookup("TS", "stable", "map", 10);
		expect(ranked).toMatchObject({ status: "ready", exact: true });
		if (ranked.status !== "ready") throw new Error("Expected a ready lookup");
		expect(ranked.entries.map(({ name }) => name)).toEqual([
			"Map",
			"Array.map",
			"Map.prototype",
			"someMap",
		]);

		const typo = service.lookup("typescript", "stable", "gathr");
		expect(typo).toMatchObject({ status: "ready", exact: false });
		if (typo.status !== "ready") throw new Error("Expected a ready lookup");
		expect(typo.entries.map(({ name }) => name)).toEqual(["asyncio.gather"]);
	});

	test("does not fall back to stable for an unknown explicit version", async () => {
		const service = new DocsService({
			cacheDir: await temporaryCache(),
			sources: [source],
			loadSnapshot: async (_source, target) => snapshot(target.id),
		});
		await service.refresh();

		const publisherVersion = service.lookup("ts", "5.8", "Array");
		expect(publisherVersion).toMatchObject({
			status: "ready",
			target: { id: "stable" },
		});

		expect(service.lookup("ts", "6.0", "Array.map")).toMatchObject({
			status: "ready",
			target: { id: "next" },
			entries: [{ url: "https://devdocs.io/typescript~next/Array.map" }],
		});

		expect(service.lookup("ts", "3.14", "Array")).toEqual({
			status: "unknown-version",
		});
	});
});

describe("DocsService refresh and cache", () => {
	test("shares concurrent refreshes", async () => {
		let loads = 0;
		const pending = Promise.withResolvers<void>();
		const service = new DocsService({
			cacheDir: await temporaryCache(),
			sources: [{ ...source, targets: [source.targets[0]] }],
			loadSnapshot: async (_source, target) => {
				loads++;
				await pending.promise;
				return snapshot(target.id);
			},
		});

		const first = service.refresh();
		const second = service.refresh();
		expect(second).toBe(first);
		pending.resolve();
		await first;
		expect(loads).toBe(1);
	});

	test("retains the last good snapshot and marks it stale after a refresh failure", async () => {
		let now = 1_000;
		let shouldFail = false;
		const service = new DocsService({
			cacheDir: await temporaryCache(),
			sources: [{ ...source, targets: [source.targets[0]] }],
			now: () => now,
			loadSnapshot: async (_source, target) => {
				if (shouldFail) throw new Error("upstream unavailable");
				return {
					...snapshot(target.id, [entry("Array.map")]),
					refreshedAt: now,
				};
			},
		});
		await service.refresh();
		shouldFail = true;
		now += 1;
		await service.refresh();

		const result = service.lookup("ts", "stable", "map");
		expect(result).toMatchObject({ status: "ready", stale: true });
		if (result.status !== "ready") throw new Error("Expected a ready lookup");
		expect(result.entries.map(({ name }) => name)).toEqual(["Array.map"]);
	});

	test("ignores corrupt cached data without preventing startup", async () => {
		const cacheDir = await temporaryCache();
		await mkdir(cacheDir, { recursive: true });
		await writeFile(join(cacheDir, "typescript--stable.json"), "not json");
		const service = new DocsService({
			cacheDir,
			sources: [{ ...source, targets: [source.targets[0]] }],
			loadSnapshot: async () => {
				throw new Error("initialize must not fetch");
			},
		});

		await service.initialize();
		expect(service.lookup("ts", "stable", "map")).toEqual({
			status: "unavailable",
		});
	});

	test("rejects cached links outside the configured documentation target", async () => {
		const cacheDir = await temporaryCache();
		await mkdir(cacheDir, { recursive: true });
		await writeFile(
			join(cacheDir, "typescript--stable.json"),
			JSON.stringify({
				schemaVersion: 1,
				snapshot: snapshot("stable", [
					{
						...entry("Array.map"),
						url: "https://untrusted.example/Array.map",
					},
				]),
			}),
		);
		const service = new DocsService({
			cacheDir,
			sources: [{ ...source, targets: [source.targets[0]] }],
			loadSnapshot: async () => {
				throw new Error("initialize must not fetch");
			},
		});

		await service.initialize();
		expect(service.lookup("ts", "stable", "map")).toEqual({
			status: "unavailable",
		});
	});

	test("rejects a Python snapshot pinned to another minor version", async () => {
		const cacheDir = await temporaryCache();
		await mkdir(cacheDir, { recursive: true });
		await writeFile(
			join(cacheDir, "python--3.12.json"),
			JSON.stringify({
				schemaVersion: 1,
				snapshot: {
					sourceId: "python",
					targetId: "3.12",
					provider: "sphinx",
					version: "3.12.7",
					entries: [
						{
							name: "pathlib.Path",
							type: "py:class",
							url: "https://docs.python.org/3.13/library/pathlib.html#pathlib.Path",
						},
					],
					refreshedAt: 1_000,
				},
			}),
		);
		const service = new DocsService({
			cacheDir,
			sources: [pythonSource],
			loadSnapshot: async () => {
				throw new Error("initialize must not fetch");
			},
		});

		await service.initialize();
		expect(service.lookup("python", "3.12", "Path")).toEqual({
			status: "unavailable",
		});
	});

	test("persists an atomic snapshot that a new service can restore without loading", async () => {
		const cacheDir = await temporaryCache();
		const stableOnly = [{ ...source, targets: [source.targets[0]] }] as const;
		const writer = new DocsService({
			cacheDir,
			sources: stableOnly,
			loadSnapshot: async (_source, target) =>
				snapshot(target.id, [entry("Utility Types")]),
		});
		await writer.refresh();

		let loads = 0;
		const reader = new DocsService({
			cacheDir,
			sources: stableOnly,
			now: () => 1_000,
			loadSnapshot: async () => {
				loads++;
				throw new Error("initialize must not fetch");
			},
		});
		await reader.initialize();

		const restored = reader.lookup("typescript", "stable", "utility");
		expect(restored).toMatchObject({ status: "ready", stale: false });
		if (restored.status !== "ready") throw new Error("Expected a ready lookup");
		expect(restored.entries.map(({ name }) => name)).toEqual(["Utility Types"]);
		expect(loads).toBe(0);
	});
});
