import { logger } from '../../logging.js'
import fetch from 'node-fetch'
import { LearningResource } from './learningResource.model.js'
import { parse } from 'yaml'

const cache = new Map<string, LearningResource>()

export async function getResource (name: string): Promise<LearningResource | null> {
  name = name.toLowerCase()
  const get = cache.get(name)
  if (get != null) {
    return get
  }

  const resource = await queryResource(name)
  if (resource == null) {
    return null
  }
  cache.set(name, resource)
  return resource
}

export async function updateAllResources () {
  cache.clear();
  (await queryAll()).forEach(resource => {
    cache.set(resource.name.toLowerCase(), resource)
    logger.info(`Updated cache for ${resource.name}`)
  })
}

export function getAllCachedResources () {
  return Array.from(cache.values())
}

const baseUrl = 'https://learningresources.developerden.org'

async function queryResource (name: string): Promise<LearningResource | null> {
  const resource = await fetch(`${baseUrl}/${name}`)
    .then(async r => await r.text())
    .then(r => parse(r))
    .catch(() => null)

  return resource as LearningResource
}

async function queryAll (): Promise<LearningResource[]> {
  const resources = await fetch(`${baseUrl}`)
    .then(async r => await r.json()) as ResourceIndex[]
  const promises = resources
    .filter(r => !r.name.endsWith('schema.json')) // ignore schema
    .map(async r => await queryResource(r.name))
  return await Promise.all(promises)
    .then(r => r.filter(it => it != null) as LearningResource[])
}

interface ResourceIndex {
  name: string
  type: string
  mtime: string
  size: number
}
