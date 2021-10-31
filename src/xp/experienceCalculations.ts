import {compose} from "../util/functions";

const pingRegex = /<[a-zA-Z0-9@:&!#]+?[0-9]+>/;

const punctuationRegex = /[.?,!\-'"` ]/;
const stripPunctuation = (message : string) => message.replace(punctuationRegex, "");

const stripPings = (message: string) => message.replace(pingRegex, "");
const strip = compose(stripPunctuation, stripPings)


export const xpForLevel = (level : number) => (level ** 3) + (55 / 2) * (level ** 2) + (755 / 6) * level;
export const xpForMessage = (message: string) => (strip(message).length ** 0.5).toFixed(0)
