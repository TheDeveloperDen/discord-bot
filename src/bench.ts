import {generateHotTake} from './hotTakeSender.js'


async function bench() {
	for(let i = 0; i < 100000; i++) {
		await generateHotTake()
	}
}

await bench()