import {EventHandler} from '../EventHandler.js'
import {pastify} from '../util/pastify.js'

export const pastebinListener: EventHandler = (client) => {
	client.on('messageCreate', async (message) => {
		const pastified = await pastify(message)
		if (pastified) message.channel.send(pastified)
	})
}
