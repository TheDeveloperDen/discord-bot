import Module from './module.js'
import {ActivityType} from 'discord-api-types/v10'

const languages = [
	'Solidity',
	'C',
	'C++',
	'Carbon',
	'D',
	'C',
	'F',
	'OCaml',
	'Haskell',
	'Prolog',
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
	'PHP',
	'Python',
	'Go',
	'Rust',
	'VLang',
	'Ruby',
	'Crystal',
	'Lua',
	'R',
	'MATLAB',
	'Wolfram',
	'Dart',
	'Julia',
	'Perl',
	'APL',
	'BQN',
	'Brainf**k',
	'COBOL',
	'Fortran',
	'ALGOL 55',
	'ALGOL 60',
	'ALGOL 68',
	'Assembly',
	'ZSH',
	'Bash',
	'PowerShell',
	'Scratch',
	'HTML',
	'CSS',
	'SASS',
	'LESS',
	'Angular',
	'React',
	'Vue',
	'Malbolge',
	'Verilog'
]

export const LanguageStatusModule: Module = {
	name: 'languageStatus',
	listeners: [{
		ready(_, event) {
			setInterval(
				() => event.user.setActivity(`Coding in ${languages.randomElement()}`, {type: ActivityType.Playing}),
				3.6e+6)
		}
	}]
}
