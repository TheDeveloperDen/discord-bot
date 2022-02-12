import {compose} from '../util/functions.js'

const pingRegex = /<[a-zA-Z0-9@:&!#]+?[0-9]+>/g

const punctuationRegex = /[.?,!\-'"` ]/g
const stripPunctuation = (message: string) => message.replace(punctuationRegex, '')

const stripPings = (message: string) => message.replace(pingRegex, '')
const strip = compose(stripPunctuation, stripPings)


export const xpForLevel = (level: number) => Math.floor(level ** 3 + 27 * level ** 2 + 125 * level)

function findForward(input: string, index: number, set: Set<string>): number {
    let current = ""
    while (set.has(current) && index < input.length) {
        current = current.concat(input[index])
        index++
    }
    set.add(current)
    return current.length
}

function compressibility(input: string): number {
    input = input.toLowerCase()
    let things = new Set<string>()
    things.add("")
    let cut = 0
    let i = 0
    while (i < input.length) {
        let length = Math.max(findForward(input, i, things) - 1, 0)
        cut += length
        i += length + 1
    }
    return cut / input.length
}

export const xpForMessage = (message: string) => {
	const length = strip(message).length
	return Math.round((1 - compressibility(message)) * Math.tanh(length / 3) + Math.pow(length, 0.75))
}
