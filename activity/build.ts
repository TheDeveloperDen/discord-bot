import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const activityDirectory = dirname(fileURLToPath(import.meta.url));
const distDirectory = join(activityDirectory, "dist");

export async function buildActivity(): Promise<void> {
	await mkdir(distDirectory, { recursive: true });

	const result = await Bun.build({
		entrypoints: [join(activityDirectory, "src", "main.ts")],
		outdir: distDirectory,
		naming: "app.js",
		target: "browser",
		format: "esm",
		minify: true,
	});

	if (!result.success) {
		console.error(result.logs);
		throw new Error("BlockCount frontend build failed");
	}

	await Promise.all([
		Bun.write(
			join(distDirectory, "index.html"),
			Bun.file(join(activityDirectory, "index.html")),
		),
		Bun.write(
			join(distDirectory, "style.css"),
			Bun.file(join(activityDirectory, "src", "style.css")),
		),
	]);
}

if (import.meta.main) {
	await buildActivity();
}
