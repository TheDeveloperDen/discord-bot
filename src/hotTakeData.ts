import {readFileSync} from "fs";

export type HotTakeData = {
	people: string[],
	companies: string[],
	languages: string[]
	technologies: string[],
	problems: string[]
	takes: string[],
}


export const hotTakeData = JSON.parse(
	readFileSync(process.cwd()+'/hotTakeData.json').toString()
) as HotTakeData;