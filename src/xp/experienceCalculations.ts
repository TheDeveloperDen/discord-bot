import {compose} from '../util/functions.js'

const pingRegex = /<[a-zA-Z0-9@:&!#]+?[0-9]+>/g

const punctuationRegex = /[.?,!\-'"` ]/g
const stripPunctuation = (message: string) => message.replace(punctuationRegex, '')

const stripPings = (message: string) => message.replace(pingRegex, '')
const strip = compose(stripPunctuation, stripPings)


export const xpForLevel = (level: number) => Math.floor(level ** 3 + 27 * level ** 2 + 125 * level)

export const xpForMessage = (message: string) => Math.round(Math.sqrt(strip(message).length))
