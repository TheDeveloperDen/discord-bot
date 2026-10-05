import { setTimeout as waitForDelay } from "node:timers/promises";
import { inflateSync } from "node:zlib";
import type {
	DocsEntry,
	DocsSnapshot,
	DocsSource,
	DocsTarget,
} from "./types.js";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_INVENTORY_DECOMPRESSED_BYTES = 20 * 1024 * 1024;
const DEVDOCS_MANIFEST_URL = "https://devdocs.io/docs.json";
const DEVDOCS_DOCUMENTS_BASE_URL = "https://documents.devdocs.io/";
const DEVDOCS_RESULT_BASE_URL = "https://devdocs.io/";
const SAFE_SLUG = /^[a-z0-9][a-z0-9_~-]*$/;
const SAFE_INVENTORY_TYPE = /^[^:\s]+:[^\s]+$/;
const INTEGER = /^-?\d+$/;

export function createDocsSnapshotLoader(
	transport: (url: string, signal: AbortSignal) => Promise<Uint8Array>,
	wait: (delayMs: number) => Promise<void> = waitForDelay,
): (
	source: DocsSource,
	target: DocsTarget,
	previous?: DocsSnapshot,
) => Promise<DocsSnapshot> {
	return async (source, target, previous) => {
		switch (target.provider) {
			case "sphinx":
				return await loadSphinxSnapshot(source, target, transport, wait);
			case "devdocs":
				return await loadDevDocsSnapshot(
					source,
					target,
					previous,
					transport,
					wait,
				);
		}
	};
}

export const loadDocsSnapshot = createDocsSnapshotLoader(fetchBytes);

export function parseSphinxInventory(
	bytes: Uint8Array,
	baseUrl: string,
): { version: string; entries: DocsEntry[] } {
	if (bytes.byteLength > MAX_RESPONSE_BYTES) {
		throw new Error("Sphinx inventory exceeds the compressed size limit");
	}

	const { compressedOffset, version } = readSphinxHeader(bytes);

	let inventoryText: string;
	try {
		inventoryText = decodeUtf8(
			inflateSync(bytes.subarray(compressedOffset), {
				maxOutputLength: MAX_INVENTORY_DECOMPRESSED_BYTES,
			}),
		);
	} catch (error) {
		throw new Error("Invalid Sphinx inventory compression", { cause: error });
	}

	const base = parseSafeBaseUrl(baseUrl);
	const entries: DocsEntry[] = [];
	for (const line of inventoryText.split(/\r?\n/)) {
		if (!line.trim()) continue;
		const match = /^(.+?)\s+(\S+)\s+(-?\d+)\s+(\S*)\s+(.*)$/.exec(line.trim());
		if (!match) {
			throw new Error("Malformed Sphinx inventory entry");
		}
		const [, name, type, priority, location, displayName] = match;
		if (
			!name ||
			!location ||
			!SAFE_INVENTORY_TYPE.test(type) ||
			!INTEGER.test(priority)
		) {
			throw new Error("Malformed Sphinx inventory entry");
		}

		const shouldUseDisplayName =
			(type === "std:doc" || type === "std:label") &&
			displayName !== "-" &&
			Boolean(displayName);
		entries.push({
			name: shouldUseDisplayName ? displayName : name,
			type,
			url: resolveSphinxUrl(
				base,
				location.endsWith("$") ? `${location.slice(0, -1)}${name}` : location,
			),
		});
	}

	if (entries.length === 0) {
		throw new Error("Sphinx inventory did not contain documentation entries");
	}
	return { version, entries };
}

export function parseDevDocsManifest(
	value: unknown,
	slug: string,
): { version: string; upstreamUpdatedAt: number } {
	if (!SAFE_SLUG.test(slug) || !Array.isArray(value)) {
		throw new Error("Malformed DevDocs manifest");
	}

	const manifest = value.find(
		(entry) =>
			entry !== null &&
			typeof entry === "object" &&
			!Array.isArray(entry) &&
			"slug" in entry &&
			entry.slug === slug,
	);
	if (
		manifest === undefined ||
		manifest === null ||
		typeof manifest !== "object" ||
		Array.isArray(manifest)
	) {
		throw new Error(`DevDocs manifest does not contain ${slug}`);
	}

	const releaseValue = "release" in manifest ? manifest.release : undefined;
	let release: string | undefined;
	if (releaseValue !== undefined && releaseValue !== "") {
		if (typeof releaseValue !== "string") {
			throw new Error("DevDocs manifest release is invalid");
		}
		release = releaseValue;
	}
	const versionValue = "version" in manifest ? manifest.version : undefined;
	let version: string | undefined;
	if (versionValue !== undefined && versionValue !== "") {
		if (typeof versionValue !== "string") {
			throw new Error("DevDocs manifest version is invalid");
		}
		version = versionValue;
	}
	const mtime = "mtime" in manifest ? manifest.mtime : undefined;
	if (typeof mtime !== "number" || !Number.isSafeInteger(mtime) || mtime <= 0) {
		throw new Error(`DevDocs manifest has an invalid mtime for ${slug}`);
	}

	return {
		version: release ?? version ?? "Current reference",
		upstreamUpdatedAt: mtime * 1000,
	};
}

export function parseDevDocsIndex(slug: string, value: unknown): DocsEntry[] {
	if (
		!SAFE_SLUG.test(slug) ||
		value === null ||
		typeof value !== "object" ||
		Array.isArray(value) ||
		!("entries" in value) ||
		!("types" in value) ||
		!Array.isArray(value.entries)
	) {
		throw new Error(`Malformed DevDocs index for ${slug}`);
	}
	if (
		!Array.isArray(value.types) ||
		!value.types.every(
			(type) =>
				type !== null &&
				typeof type === "object" &&
				!Array.isArray(type) &&
				"name" in type &&
				typeof type.name === "string" &&
				"slug" in type &&
				typeof type.slug === "string" &&
				"count" in type &&
				typeof type.count === "number" &&
				Number.isSafeInteger(type.count) &&
				type.count >= 0,
		)
	) {
		throw new Error(`Malformed DevDocs type list for ${slug}`);
	}

	const entries: DocsEntry[] = value.entries.map((entry) => {
		if (
			entry === null ||
			typeof entry !== "object" ||
			Array.isArray(entry) ||
			!("name" in entry) ||
			!("path" in entry) ||
			!("type" in entry) ||
			typeof entry.name !== "string" ||
			!entry.name.trim() ||
			typeof entry.path !== "string" ||
			!entry.path ||
			typeof entry.type !== "string" ||
			!entry.type.trim()
		) {
			throw new Error(`Malformed DevDocs entry for ${slug}`);
		}
		return {
			name: entry.name,
			type: entry.type,
			url: resolveDevDocsUrl(slug, entry.path),
		};
	});

	if (entries.length === 0) {
		throw new Error(`DevDocs index is empty for ${slug}`);
	}
	return entries;
}

async function loadSphinxSnapshot(
	source: DocsSource,
	target: Extract<DocsTarget, { provider: "sphinx" }>,
	transport: (url: string, signal: AbortSignal) => Promise<Uint8Array>,
	wait: (delayMs: number) => Promise<void>,
): Promise<DocsSnapshot> {
	const inventoryUrl = parseSafeSphinxInventoryUrl(
		target.inventoryUrl,
		target.baseUrl,
	);
	const bytes = await downloadWithTimeoutRecovery(
		inventoryUrl.href,
		transport,
		wait,
	);
	const { version } = readSphinxHeader(bytes);
	const inventory = parseSphinxInventory(
		bytes,
		pinnedPythonBaseUrl(source, target, version),
	);

	return {
		sourceId: source.id,
		targetId: target.id,
		provider: "sphinx",
		version: inventory.version,
		entries: inventory.entries,
		refreshedAt: Date.now(),
	};
}

async function loadDevDocsSnapshot(
	source: DocsSource,
	target: Extract<DocsTarget, { provider: "devdocs" }>,
	previous: DocsSnapshot | undefined,
	transport: (url: string, signal: AbortSignal) => Promise<Uint8Array>,
	wait: (delayMs: number) => Promise<void>,
): Promise<DocsSnapshot> {
	const manifest = parseDevDocsManifest(
		parseJson(
			await downloadWithTimeoutRecovery(DEVDOCS_MANIFEST_URL, transport, wait),
		),
		target.slug,
	);
	const refreshedAt = Date.now();
	if (
		previous?.sourceId === source.id &&
		previous.targetId === target.id &&
		previous.provider === "devdocs" &&
		previous.upstreamUpdatedAt === manifest.upstreamUpdatedAt &&
		isValidDevDocsEntries(target.slug, previous.entries)
	) {
		return {
			...previous,
			version: manifest.version,
			refreshedAt,
			upstreamUpdatedAt: manifest.upstreamUpdatedAt,
		};
	}

	const indexUrl = new URL(
		`${target.slug}/index.json`,
		DEVDOCS_DOCUMENTS_BASE_URL,
	);
	const entries = parseDevDocsIndex(
		target.slug,
		parseJson(
			await downloadWithTimeoutRecovery(indexUrl.href, transport, wait),
		),
	);
	return {
		sourceId: source.id,
		targetId: target.id,
		provider: "devdocs",
		version: manifest.version,
		entries,
		refreshedAt,
		upstreamUpdatedAt: manifest.upstreamUpdatedAt,
	};
}

async function fetchBytes(
	url: string,
	signal: AbortSignal,
): Promise<Uint8Array> {
	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(
			`Documentation request failed with HTTP ${response.status}`,
		);
	}
	if (!response.body) {
		throw new Error("Documentation request had no response body");
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > MAX_RESPONSE_BYTES) {
				await reader.cancel();
				throw new Error("Documentation response exceeds the size limit");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

async function downloadWithTimeoutRecovery(
	url: string,
	transport: (url: string, signal: AbortSignal) => Promise<Uint8Array>,
	wait: (delayMs: number) => Promise<void>,
): Promise<Uint8Array> {
	for (let attempt = 1; ; attempt++) {
		const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
		try {
			return await transport(url, signal);
		} catch (error) {
			if (!isTimeoutError(error, signal) || attempt === 3) {
				const reason = error instanceof Error ? error.message : String(error);
				throw new Error(
					`Documentation download failed for ${url} after ${attempt} ${attempt === 1 ? "attempt" : "attempts"}: ${reason}`,
					{ cause: error },
				);
			}
			await wait(attempt * 1_000);
		}
	}
}

function isTimeoutError(error: unknown, signal: AbortSignal): boolean {
	if (!(error instanceof DOMException)) return false;
	if (error.name === "TimeoutError") return true;
	return (
		error.name === "AbortError" &&
		signal.aborted &&
		signal.reason instanceof DOMException &&
		signal.reason.name === "TimeoutError"
	);
}

function readSphinxHeader(bytes: Uint8Array) {
	if (bytes.byteLength > MAX_RESPONSE_BYTES) {
		throw new Error("Sphinx inventory exceeds the compressed size limit");
	}

	const compressedOffset = findInventoryHeaderEnd(bytes);
	const lines = decodeUtf8(bytes.subarray(0, compressedOffset)).split(/\r?\n/);
	if (
		lines.length < 4 ||
		lines[0] !== "# Sphinx inventory version 2" ||
		!lines[1]?.startsWith("# Project: ") ||
		!lines[2]?.startsWith("# Version: ") ||
		!lines[3]?.startsWith(
			"# The remainder of this file is compressed using zlib.",
		)
	) {
		throw new Error("Unsupported or malformed Sphinx inventory header");
	}

	const version = lines[2].slice("# Version: ".length).trim();
	if (!version) {
		throw new Error("Sphinx inventory is missing its version");
	}
	return { compressedOffset, version };
}

function findInventoryHeaderEnd(bytes: Uint8Array): number {
	let lineCount = 0;
	for (let index = 0; index < bytes.length; index++) {
		if (bytes[index] !== 10) continue;
		lineCount++;
		if (lineCount === 4) return index + 1;
	}
	throw new Error("Malformed Sphinx inventory header");
}

function decodeUtf8(bytes: Uint8Array): string {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch (error) {
		throw new Error("Documentation response is not valid UTF-8", {
			cause: error,
		});
	}
}

function parseJson(bytes: Uint8Array): unknown {
	if (bytes.byteLength > MAX_RESPONSE_BYTES) {
		throw new Error("Documentation response exceeds the size limit");
	}
	try {
		return JSON.parse(decodeUtf8(bytes));
	} catch (error) {
		throw new Error("Documentation response is not valid JSON", {
			cause: error,
		});
	}
}

function parseSafeSphinxInventoryUrl(
	inventoryUrl: string,
	baseUrl: string,
): URL {
	const inventory = parseSafeHttpsUrl(inventoryUrl);
	const base = parseSafeBaseUrl(baseUrl);
	if (
		inventory.origin !== base.origin ||
		!inventory.pathname.startsWith(base.pathname)
	) {
		throw new Error("Sphinx inventory URL is outside its configured base URL");
	}
	return inventory;
}

function parseSafeBaseUrl(value: string): URL {
	const url = parseSafeHttpsUrl(value);
	if (url.search || url.hash || !url.pathname.endsWith("/")) {
		throw new Error("Documentation base URL must be a clean directory URL");
	}
	return url;
}

function parseSafeHttpsUrl(value: string): URL {
	assertSafePath(value);
	let url: URL;
	try {
		url = new URL(value);
	} catch (error) {
		throw new Error("Invalid documentation URL", { cause: error });
	}
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.hostname !== url.hostname.toLowerCase()
	) {
		throw new Error("Documentation URL must be a safe HTTPS URL");
	}
	return url;
}

function resolveSphinxUrl(base: URL, location: string): string {
	assertSafePath(location);
	let url: URL;
	try {
		url = new URL(location, base);
	} catch (error) {
		throw new Error("Invalid Sphinx inventory URL", { cause: error });
	}
	if (
		url.protocol !== "https:" ||
		url.origin !== base.origin ||
		!url.pathname.startsWith(base.pathname) ||
		url.username ||
		url.password
	) {
		throw new Error(
			"Sphinx inventory entry points outside the configured base URL",
		);
	}
	return url.href;
}

function resolveDevDocsUrl(slug: string, path: string): string {
	assertSafePath(path);
	if (
		path.startsWith("/") ||
		path.startsWith("//") ||
		/^[a-z][a-z0-9+.-]*:/i.test(path)
	) {
		throw new Error("DevDocs entry path must be relative");
	}
	const base = new URL(`${slug}/`, DEVDOCS_RESULT_BASE_URL);
	const url = new URL(path, base);
	if (
		url.protocol !== "https:" ||
		url.origin !== base.origin ||
		!url.pathname.startsWith(base.pathname) ||
		url.username ||
		url.password
	) {
		throw new Error("DevDocs entry path is unsafe");
	}
	return url.href;
}

function assertSafePath(value: string): void {
	if (/^[\s]|\p{Cc}|%0[0-9a-f]|%1[0-9a-f]|%7f/iu.test(value)) {
		throw new Error("Documentation URL contains unsafe characters");
	}
}

export function pinnedPythonBaseUrl(
	source: DocsSource,
	target: Extract<DocsTarget, { provider: "sphinx" }>,
	version: string | undefined,
): string {
	if (
		source.id !== "python" ||
		target.id !== "stable" ||
		target.baseUrl !== "https://docs.python.org/3/" ||
		!version
	) {
		return target.baseUrl;
	}
	const match = /^(\d+)\.(\d+)(?:\.\d+)?(?:[+ -].*)?$/.exec(version);
	if (!match) return target.baseUrl;
	return `https://docs.python.org/${match[1]}.${match[2]}/`;
}

function isValidDevDocsEntries(slug: string, entries: DocsEntry[]): boolean {
	try {
		return (
			entries.length > 0 &&
			entries.every(
				(entry) =>
					typeof entry.name === "string" &&
					Boolean(entry.name.trim()) &&
					typeof entry.type === "string" &&
					Boolean(entry.type.trim()) &&
					entry.url ===
						resolveDevDocsUrl(
							slug,
							entry.url.slice(`https://devdocs.io/${slug}/`.length),
						),
			)
		);
	} catch {
		return false;
	}
}
