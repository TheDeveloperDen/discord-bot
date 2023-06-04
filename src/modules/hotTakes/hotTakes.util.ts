import { randomInt } from 'crypto'
import { Guild } from 'discord.js'
import { actualMention, isSpecialUser } from '../../util/users.js'
import { readFileSync } from 'fs'
import ExpiryMap from 'expiry-map'

type HotTakeThing = string | {
  take: string
  image: string | string[]
}

export function hotTakeValue (thing: HotTakeThing): string {
  if (typeof thing === 'string') return thing
  return thing.take
}

function replaceHotTakeThing (
  f: (arg: string) => string,
  thing: HotTakeThing
): HotTakeThing {
  if (typeof thing === 'string') return f(thing)
  return {
    take: f(thing.take),
    image: thing.image
  }
}

export const hotTakeData: {
  people: HotTakeThing[]
  companies: HotTakeThing[]
  languages: HotTakeThing[]
  technologies: HotTakeThing[]
  problems: HotTakeThing[]
  tlds: HotTakeThing[]
  takes: HotTakeThing[]
} = JSON.parse(readFileSync(process.cwd() + '/hotTakeData.json').toString())

interface Placeholders {
  [k: string]: (users: string[]) => HotTakeThing[]
}

const placeholders: Placeholders = {
  language: () => hotTakeData.languages,
  technology: () => hotTakeData.technologies,
  tld: () => hotTakeData.tlds,
  thing: combineSources('languages', 'technologies'),
  anything: combineSources('languages', 'technologies', 'people', 'companies'),
  oneWordAnything: mapPlaceholder(
    'anything',
    (it) => replaceHotTakeThing((s) => s.replace(' ', ''), it)
  ),
  person: () => hotTakeData.people,
  company: () => hotTakeData.companies,
  group: combineSources('people', 'companies'),
  problem: () => hotTakeData.problems,
  year: () => [randomInt(1500, 2022).toString()],
  age: () => [randomInt(1, 50).toString()],
  bigNumber: () => [randomInt(2, 100000).toString()],
  percentage: () => [randomInt(1, 100).toString()],
  oneWordThing: mapPlaceholder(
    'thing',
    (it) => replaceHotTakeThing((s) => s.replace(' ', ''), it)
  ),
  currentYear: () => [new Date().getFullYear().toString()]
}

type Placeholder = keyof typeof placeholders

function isValidPlaceholder (value: string | number): value is Placeholder {
  const strings: string[] = Object.keys(placeholders)
  return strings.includes(value.toString())
}

type NewOmit<T, K extends PropertyKey> = {
  [P in keyof T as Exclude<P, K>]: T[P];
}

function combineSources (
  ...source: Array<NewOmit<keyof typeof hotTakeData, 'takes'>>
): (users: string[]) => HotTakeThing[] {
  if (source.length === 0) return () => []
  const head: HotTakeThing[] = hotTakeData[source[0]]
  const tail = source.slice(1).flatMap((it) => hotTakeData[it])
  return (users: string[]) => head.concat(tail, users)
}

function mapPlaceholder (
  key: Placeholder,
  f: (s: HotTakeThing) => HotTakeThing
): (users: string[]) => HotTakeThing[] {
  return (users: string[]) => placeholders[key](users).map(f)
}

async function getAdditionalUsers (guild: Guild): Promise<string[]> {
  const users = await guild.members.fetch()
  return users
    .filter(isSpecialUser)
    .map((user) => actualMention(user))
}

const specialUsersCache = new ExpiryMap(1000 * 60 * 30)

async function getSpecialUsers (guild: Guild) {
  if (specialUsersCache.has(guild.id)) {
    return specialUsersCache.get(guild.id)
  }
  const users = await getAdditionalUsers(guild).catch(() => [])
  specialUsersCache.set(guild.id, users)
  return users
}

export default async function generateHotTake (guild: Guild) {
  const members = await getSpecialUsers(guild)

  const randomTake = hotTakeData.takes.randomElement()

  const takeValue = hotTakeValue(randomTake)
  return takeValue.replace(/{[\w|]+}/g, (value) => {
    const randomReplacement = value
      .slice(1, -1) // remove the {}
      .split('|') // split into options
      .map((p: string) => {
        if (isValidPlaceholder(p)) {
          return p
        } else {
          throw new Error(`Invalid placeholder: ${p as string}`)
        }
      })
      .flatMap((it) => {
        return placeholders[it](members)
      }) // get the values for each placeholder
      .randomElement() // pick a random value

    return hotTakeValue(randomReplacement)
  })
}
