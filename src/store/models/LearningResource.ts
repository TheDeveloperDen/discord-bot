export interface LearningResource {
	name: string
	description: string
	resources: Resource[]
}

export interface Resource {
	name: string
	url: string
	price?: string
	pros: string[]
	cons: string[]
}