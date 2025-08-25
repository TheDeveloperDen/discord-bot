import { logger } from "../../logging.js";
import fetch from "node-fetch";
import { LearningResource } from "./learningResource.model.js";
import { parse } from "yaml";

type FileName = string;

const cache = new Map<FileName, LearningResource>();

export async function getResource(
  name: FileName,
): Promise<LearningResource | null> {
  name = name.toLowerCase();
  const get = cache.get(name);
  if (get) {
    return get;
  }

  const resource = await queryResource(name);
  if (resource == null) {
    return null;
  }
  cache.set(name, resource);
  return resource;
}

export async function updateAllResources() {
  cache.clear();
  (await queryAll()).forEach(([fileName, resource]) => {
    cache.set(fileName, resource);
    logger.info(`Added resource ${resource.name} to cache`);
  });
}

export function getAllCachedResources(): Array<[FileName, LearningResource]> {
  return Array.from(cache);
}

const baseUrl = "https://learningresources.developerden.org";

async function queryResource(
  fileName: FileName,
): Promise<LearningResource | null> {
  logger.debug(`Querying resource ${fileName}...`);
  const resource = (await fetch(`${baseUrl}/${fileName}`))
    .text()
    .then((r) => parse(r))
    .catch(() => null);

  return (await resource) as LearningResource;
}

async function queryAll(): Promise<Array<Awaited<[string, LearningResource]>>> {
  const resources: ResourceIndex[] = (await (
    await fetch(baseUrl)
  ).json()) as ResourceIndex[];

  const hm: Array<Promise<[FileName, LearningResource]>> = resources
    .filter((r) => !r.name.endsWith("schema.json")) // ignore schema
    .map(async (r): Promise<[FileName, LearningResource]> => {
      const res = await queryResource(r.name);
      if (res == null) {
        throw new Error(`Could not get resource ${r.name}`);
      }
      return [r.name, res];
    });
  return await Promise.all(hm);
}

interface ResourceIndex {
  name: FileName;
  type: string;
  mtime: string;
  size: number;
}
