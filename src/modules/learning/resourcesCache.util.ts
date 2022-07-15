import {logger} from '../../logging.js'
import fetch from 'node-fetch'
import {LearningResource} from './learningResource.model.js'

const cache = new Map<string, LearningResource>()

export async function getResource(name: string): Promise<LearningResource> {
	name = name.toLowerCase()
	const get = cache.get(name)
	if (get) {
		return get
	}

	const resource = await queryResource(name)
	cache.set(name, resource)
	return resource
}

export async function updateAllResources() {
	cache.clear();
	(await queryAll()).forEach(resource => {
		cache.set(resource.name.toLowerCase(), resource)
		logger.info(`Updated cache for ${resource.name}`)
	})
}

export function getAllCachedResources() {
	return Array.from(cache.values())
}

const baseUrl = 'https://learningresources.developerden.net'

async function queryResource(name: string): Promise<LearningResource> {
	const resource = await fetch(`${baseUrl}/${name}`)
		.then(r => r.json())

	return resource as LearningResource
}

async function queryAll(): Promise<LearningResource[]> {
	const resources = await fetch(`${baseUrl}`).then(r => r.json()) as ResourceIndex[]
	const promises = resources
		.filter(r => !r.name.endsWith('schema.json')) // ignore schema
		.map(async r => await queryResource(r.name))
	return await Promise.all(promises)
}

interface ResourceIndex {
	name: string
	type: string
	mtime: string
	size: number
}
