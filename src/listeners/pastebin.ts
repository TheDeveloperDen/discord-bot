import {Listener} from './listener.js'
import {pastify} from '../util/pastify.js'

export const pastebinListener: Listener = (client) => {
	client.on('messageCreate', async (message) => {
		const pastified = await pastify(message)
		if (pastified) message.channel.send({...pastified, flags: 0})
	})
}
