export interface DocsEntry {
	name: string;
	url: string;
	type: string;
}

export type DocsTarget =
	| {
			id: string;
			label: string;
			provider: "sphinx";
			inventoryUrl: string;
			baseUrl: string;
	  }
	| {
			id: string;
			label: string;
			provider: "devdocs";
			slug: string;
	  };

export interface DocsSource {
	id: string;
	name: string;
	aliases: readonly string[];
	targets: readonly DocsTarget[];
}

export interface DocsSnapshot {
	sourceId: string;
	targetId: string;
	provider: "sphinx" | "devdocs";
	version: string;
	entries: DocsEntry[];
	refreshedAt: number;
	upstreamUpdatedAt?: number;
}
