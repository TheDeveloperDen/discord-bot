import type { DocsSource } from "./types.js";

const devDocsTarget = (slug: string, label = "Stable") => ({
	id: "stable",
	label,
	provider: "devdocs" as const,
	slug,
});

export const DOCS_SOURCES: readonly DocsSource[] = [
	{
		id: "python",
		name: "Python",
		aliases: ["py"],
		targets: [
			{
				id: "stable",
				label: "Stable",
				provider: "sphinx",
				inventoryUrl: "https://docs.python.org/3/objects.inv",
				baseUrl: "https://docs.python.org/3/",
			},
			{
				id: "3.13",
				label: "Python 3.13",
				provider: "sphinx",
				inventoryUrl: "https://docs.python.org/3.13/objects.inv",
				baseUrl: "https://docs.python.org/3.13/",
			},
			{
				id: "3.12",
				label: "Python 3.12",
				provider: "sphinx",
				inventoryUrl: "https://docs.python.org/3.12/objects.inv",
				baseUrl: "https://docs.python.org/3.12/",
			},
		],
	},
	{
		id: "javascript",
		name: "JavaScript",
		aliases: ["js"],
		targets: [devDocsTarget("javascript")],
	},
	{
		id: "typescript",
		name: "TypeScript",
		aliases: ["ts"],
		targets: [devDocsTarget("typescript")],
	},
	{
		id: "html",
		name: "HTML",
		aliases: [],
		targets: [devDocsTarget("html")],
	},
	{
		id: "css",
		name: "CSS",
		aliases: [],
		targets: [devDocsTarget("css")],
	},
	{
		id: "node",
		name: "Node.js",
		aliases: ["nodejs", "node.js"],
		targets: [
			devDocsTarget("node"),
			{
				id: "24-lts",
				label: "Node.js 24 LTS",
				provider: "devdocs",
				slug: "node~24_lts",
			},
		],
	},
	{
		id: "rust",
		name: "Rust",
		aliases: [],
		targets: [devDocsTarget("rust")],
	},
	{
		id: "go",
		name: "Go",
		aliases: ["golang"],
		targets: [devDocsTarget("go")],
	},
];
