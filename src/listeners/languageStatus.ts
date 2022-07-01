import {Listener} from './listener.js'
import {ClientUser} from 'discord.js'

const languages = [
	'C',
	'C++',
	'D',
	'C#',
	'F#',
	'OCaml',
	'Haskell',
	'Elm',
	'Elixir',
	'Erlang',
	'Clojure',
	'Java',
	'Scala',
	'Groovy',
	'Kotlin',
	'Swift',
	'JavaScript',
	'CoffeeScript',
	'TypeScript',
	'PHP (jk)',
	'Python',
	'Go',
	'Rust',
	'Ruby',
	'Crystal',
	'Lua',
	'R',
	'Dart',
	'Julia',
	'Perl',
	'APL',
	'BQN',
	'Brainf**k',
	'COBOL',
	'Fortran',
	'ALGOL 55'
]
export const languageStatusListener: Listener = (client) => {
	const update = (user: ClientUser) => {
		user.setActivity(`Coding in ${languages.randomElement()}`, {type: 'PLAYING'})
		setTimeout(() => update(user), 3.6e+6)
	}

	client.on('ready', event => update(event.user))
}
