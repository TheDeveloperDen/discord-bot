export interface LearningResource {
  name: string
  emoji?: string
  description: string
  resources: Resource[]
}

export interface Resource {
  name: string
  description?: string
  url: string
  price?: string | number
  pros: string[]
  cons: string[]
}
