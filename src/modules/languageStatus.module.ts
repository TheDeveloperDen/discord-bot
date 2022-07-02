import Module from './module'

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

export const LanguageStatusModule: Module = {
	name: 'languageStatus',
	listeners: [{
		ready(_, event) {
			setInterval(
				() => event.user.setActivity(`Coding in ${languages.randomElement()}`, {type: 'PLAYING'}),
				3.6e+6)
		}
	}]
}
