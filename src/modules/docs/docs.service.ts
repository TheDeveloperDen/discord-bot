import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logging.js";
import { loadDocsSnapshot, pinnedPythonBaseUrl } from "./adapters.js";
import { DOCS_SOURCES } from "./sources.js";
import type {
	DocsEntry,
	DocsSnapshot,
	DocsSource,
	DocsTarget,
} from "./types.js";

export const DOCS_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

const CACHE_SCHEMA_VERSION = 1;
const MAX_LOOKUP_RESULTS = 25;
const DEFAULT_LOOKUP_RESULTS = 10;
const MAX_STALE_AGE_MS = 24 * 60 * 60 * 1000;
const REFRESH_CONCURRENCY = 4;

export type DocsLookupResult =
	| {
			status: "unknown-source" | "unknown-version" | "unavailable";
	  }
	| {
			status: "ready";
			source: DocsSource;
			target: DocsTarget;
			snapshot: DocsSnapshot;
			stale: boolean;
			entries: DocsEntry[];
			exact: boolean;
	  };

interface DocsServiceOptions {
	cacheDir?: string;
	sources?: readonly DocsSource[];
	loadSnapshot?: typeof loadDocsSnapshot;
	now?: () => number;
}

interface CachedSnapshot {
	schemaVersion: number;
	snapshot: DocsSnapshot;
}

interface IndexedEntry {
	entry: DocsEntry;
	normalizedName: string;
	parts: readonly string[];
	position: number;
}

interface IndexedSnapshot {
	snapshot: DocsSnapshot;
	entries: readonly IndexedEntry[];
}

/**
 * Keeps the locally searchable documentation corpora and their last-good disk
 * snapshots. Network access is deliberately confined to refresh().
 */
export class DocsService {
	readonly sources: readonly DocsSource[];

	private readonly cacheDir: string;
	private readonly loadSnapshot: typeof loadDocsSnapshot;
	private readonly now: () => number;
	private readonly snapshots = new Map<string, IndexedSnapshot>();
	private readonly failedRefreshes = new Set<string>();
	private refreshInFlight: Promise<void> | undefined;

	constructor(options: DocsServiceOptions = {}) {
		this.cacheDir =
			options.cacheDir ?? (process.env.DOCS_CACHE_DIR || ".cache/docs");
		this.sources = options.sources ?? DOCS_SOURCES;
		this.loadSnapshot = options.loadSnapshot ?? loadDocsSnapshot;
		this.now = options.now ?? Date.now;
	}

	/** Loads valid cached data only; startup never fetches documentation. */
	async initialize(): Promise<void> {
		for (const source of this.sources) {
			for (const target of source.targets) {
				const key = snapshotKey(source.id, target.id);
				if (this.snapshots.has(key)) continue;

				const snapshot = await this.readCachedSnapshot(source, target);
				if (snapshot) this.setSnapshot(snapshot);
			}
		}
	}

	/**
	 * Refreshes every configured corpus with a small bounded worker pool. Calls
	 * made while a refresh is in progress share the same work and result.
	 */
	refresh(): Promise<void> {
		if (this.refreshInFlight) return this.refreshInFlight;

		const task = this.refreshAll().finally(() => {
			this.refreshInFlight = undefined;
		});
		this.refreshInFlight = task;
		return task;
	}

	resolveSource(input: string): DocsSource | undefined {
		const normalizedInput = normalize(input);
		if (!normalizedInput) return undefined;

		return this.sources.find(
			(source) =>
				normalize(source.id) === normalizedInput ||
				normalize(source.name) === normalizedInput ||
				source.aliases.some((alias) => normalize(alias) === normalizedInput),
		);
	}

	lookup(
		sourceInput: string,
		targetId: string,
		query: string,
		limit = DEFAULT_LOOKUP_RESULTS,
	): DocsLookupResult {
		const source = this.resolveSource(sourceInput);
		if (!source) return { status: "unknown-source" };

		const target = this.resolveTarget(source, targetId);
		if (!target) return { status: "unknown-version" };

		const indexedSnapshot = this.snapshots.get(
			snapshotKey(source.id, target.id),
		);
		if (!indexedSnapshot) return { status: "unavailable" };

		const normalizedQuery = normalize(query);
		const maxResults = boundedLimit(limit);
		const matches = rankEntries(
			indexedSnapshot.entries,
			normalizedQuery,
			maxResults,
		);
		return {
			status: "ready",
			source,
			target,
			snapshot: indexedSnapshot.snapshot,
			stale:
				this.failedRefreshes.has(snapshotKey(source.id, target.id)) ||
				this.now() - indexedSnapshot.snapshot.refreshedAt > MAX_STALE_AGE_MS,
			entries: matches.map(({ entry }) => entry),
			exact: matches.some(
				({ normalizedName }) => normalizedName === normalizedQuery,
			),
		};
	}

	private resolveTarget(
		source: DocsSource,
		targetId: string,
	): DocsTarget | undefined {
		const normalizedTarget = normalize(targetId);
		const configuredTarget = source.targets.find(
			(target) => normalize(target.id) === normalizedTarget,
		);
		if (configuredTarget) return configuredTarget;

		for (const target of source.targets) {
			const snapshot = this.snapshots.get(snapshotKey(source.id, target.id));
			if (
				snapshot &&
				normalize(snapshot.snapshot.version) === normalizedTarget
			) {
				return target;
			}
		}
		return undefined;
	}

	private async refreshAll(): Promise<void> {
		const jobs = this.sources.flatMap((source) =>
			source.targets.map((target) => ({ source, target })),
		);
		let nextJob = 0;
		const worker = async (): Promise<void> => {
			while (true) {
				const job = jobs[nextJob++];
				if (!job) return;
				await this.refreshTarget(job.source, job.target);
			}
		};

		await Promise.all(
			Array.from(
				{ length: Math.min(REFRESH_CONCURRENCY, jobs.length) },
				worker,
			),
		);
	}

	private async refreshTarget(
		source: DocsSource,
		target: DocsTarget,
	): Promise<void> {
		const key = snapshotKey(source.id, target.id);
		const previous = this.snapshots.get(key)?.snapshot;
		try {
			const snapshot = await this.loadSnapshot(source, target, previous);
			assertValidSnapshot(snapshot, source, target);
			this.setSnapshot(snapshot);
			this.failedRefreshes.delete(key);
			await this.persistSnapshot(source, target, snapshot);
		} catch (error) {
			this.failedRefreshes.add(key);
			logger.warn(
				`Documentation refresh failed for ${source.id} (${target.id}${previous ? `, ${previous.version}` : ""})`,
				error,
			);
		}
	}

	private setSnapshot(snapshot: DocsSnapshot): void {
		const entries = snapshot.entries
			.map((entry, position) => ({
				entry,
				normalizedName: normalize(entry.name),
				parts: searchParts(entry.name),
				position,
			}))
			.sort(
				(left, right) =>
					left.normalizedName.localeCompare(right.normalizedName) ||
					left.position - right.position,
			);
		this.snapshots.set(snapshotKey(snapshot.sourceId, snapshot.targetId), {
			snapshot,
			entries,
		});
	}

	private async readCachedSnapshot(
		source: DocsSource,
		target: DocsTarget,
	): Promise<DocsSnapshot | undefined> {
		try {
			const raw = await readFile(this.cacheFile(source, target), "utf8");
			const cached = JSON.parse(raw) as unknown;
			const snapshot = parseCachedSnapshot(cached, source, target);
			if (!snapshot) {
				logger.warn(
					`Ignoring invalid documentation cache for ${source.id} (${target.id})`,
				);
				return undefined;
			}
			return snapshot;
		} catch (error) {
			if (isMissingFile(error)) return undefined;
			logger.warn(
				`Ignoring unreadable documentation cache for ${source.id} (${target.id})`,
				error,
			);
			return undefined;
		}
	}

	private async persistSnapshot(
		source: DocsSource,
		target: DocsTarget,
		snapshot: DocsSnapshot,
	): Promise<void> {
		const filename = this.cacheFile(source, target);
		const temporaryFilename = `${filename}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
		try {
			await mkdir(this.cacheDir, { recursive: true });
			const cached: CachedSnapshot = {
				schemaVersion: CACHE_SCHEMA_VERSION,
				snapshot,
			};
			await writeFile(temporaryFilename, JSON.stringify(cached), "utf8");
			await rename(temporaryFilename, filename);
		} catch (error) {
			logger.warn(
				`Failed to persist documentation cache for ${source.id} (${target.id})`,
				error,
			);
			await rm(temporaryFilename, { force: true }).catch(() => undefined);
		}
	}

	private cacheFile(source: DocsSource, target: DocsTarget): string {
		return join(
			this.cacheDir,
			`${encodeURIComponent(source.id)}--${encodeURIComponent(target.id)}.json`,
		);
	}
}

function parseCachedSnapshot(
	value: unknown,
	source: DocsSource,
	target: DocsTarget,
): DocsSnapshot | undefined {
	if (
		typeof value !== "object" ||
		value === null ||
		!("schemaVersion" in value) ||
		value.schemaVersion !== CACHE_SCHEMA_VERSION ||
		!("snapshot" in value)
	) {
		return undefined;
	}
	try {
		assertValidSnapshot(value.snapshot, source, target);
		return value.snapshot;
	} catch {
		return undefined;
	}
}

function assertValidSnapshot(
	value: unknown,
	source: DocsSource,
	target: DocsTarget,
): asserts value is DocsSnapshot {
	if (
		typeof value !== "object" ||
		value === null ||
		!("sourceId" in value) ||
		!("targetId" in value) ||
		!("provider" in value) ||
		!("version" in value) ||
		!("entries" in value) ||
		!("refreshedAt" in value) ||
		value.sourceId !== source.id ||
		value.targetId !== target.id ||
		value.provider !== target.provider ||
		typeof value.version !== "string" ||
		!value.version.trim() ||
		typeof value.refreshedAt !== "number" ||
		!Number.isFinite(value.refreshedAt) ||
		value.refreshedAt < 0 ||
		("upstreamUpdatedAt" in value &&
			value.upstreamUpdatedAt !== undefined &&
			(typeof value.upstreamUpdatedAt !== "number" ||
				!Number.isFinite(value.upstreamUpdatedAt) ||
				value.upstreamUpdatedAt < 0)) ||
		!Array.isArray(value.entries) ||
		value.entries.length === 0
	) {
		throw new Error("Snapshot has an invalid shape");
	}

	for (const entry of value.entries) {
		if (
			typeof entry !== "object" ||
			entry === null ||
			!("name" in entry) ||
			!("type" in entry) ||
			!("url" in entry) ||
			typeof entry.name !== "string" ||
			!entry.name.trim() ||
			typeof entry.type !== "string" ||
			!entry.type.trim() ||
			typeof entry.url !== "string" ||
			!isTrustedEntryUrl(entry.url, source, target, value.version)
		) {
			throw new Error("Snapshot has an invalid entry");
		}
	}
}

function rankEntries(
	entries: readonly IndexedEntry[],
	query: string,
	limit: number,
): IndexedEntry[] {
	if (!query) return entries.slice(0, limit);

	const matchesByRank: IndexedEntry[][] = [[], [], [], [], []];
	for (const entry of entries) {
		const rank = entryRank(entry, query);
		if (rank === undefined || matchesByRank[rank].length === limit) continue;
		matchesByRank[rank].push(entry);
	}

	const matches: IndexedEntry[] = [];
	for (const rank of matchesByRank) {
		matches.push(...rank);
		if (matches.length >= limit) break;
	}
	return matches.slice(0, limit);
}

function entryRank(entry: IndexedEntry, query: string): number | undefined {
	if (entry.normalizedName === query) return 0;
	if (
		entry.normalizedName.endsWith(`.${query}`) ||
		entry.normalizedName.endsWith(`::${query}`)
	) {
		return 1;
	}
	if (entry.normalizedName.startsWith(query)) return 2;
	if (entry.normalizedName.includes(query)) return 3;
	if (
		query.length >= 3 &&
		entry.parts.some((part) => editDistanceAtMostOne(part, query))
	) {
		return 4;
	}
	return undefined;
}

function editDistanceAtMostOne(left: string, right: string): boolean {
	if (Math.abs(left.length - right.length) > 1) return false;
	let leftIndex = 0;
	let rightIndex = 0;
	let edits = 0;

	while (leftIndex < left.length && rightIndex < right.length) {
		if (left[leftIndex] === right[rightIndex]) {
			leftIndex++;
			rightIndex++;
			continue;
		}
		if (++edits > 1) return false;
		if (left.length > right.length) {
			leftIndex++;
		} else if (right.length > left.length) {
			rightIndex++;
		} else {
			leftIndex++;
			rightIndex++;
		}
	}
	return true;
}

function searchParts(name: string): readonly string[] {
	return normalize(name)
		.split(/::|\.|\s+/)
		.filter(Boolean);
}

function boundedLimit(limit: number): number {
	if (!Number.isFinite(limit)) return DEFAULT_LOOKUP_RESULTS;
	return Math.max(1, Math.min(MAX_LOOKUP_RESULTS, Math.floor(limit)));
}

function normalize(value: string): string {
	return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

function snapshotKey(sourceId: string, targetId: string): string {
	return `${sourceId}\u0000${targetId}`;
}

function isTrustedEntryUrl(
	value: string,
	source: DocsSource,
	target: DocsTarget,
	snapshotVersion: string,
): boolean {
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" || url.username || url.password) return false;

		if (target.provider === "devdocs") {
			return (
				url.origin === "https://devdocs.io" &&
				url.pathname.startsWith(`/${target.slug}/`)
			);
		}

		const baseUrl = new URL(
			pinnedPythonBaseUrl(source, target, snapshotVersion),
		);
		return (
			baseUrl.protocol === "https:" &&
			!baseUrl.username &&
			!baseUrl.password &&
			url.origin === baseUrl.origin &&
			url.pathname.startsWith(baseUrl.pathname)
		);
	} catch {
		return false;
	}
}

function isMissingFile(error: unknown): boolean {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return false;
	}
	return error.code === "ENOENT";
}
