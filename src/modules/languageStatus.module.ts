import Module from './module.js'
import { ActivityType } from 'discord-api-types/v10'
import { logger } from '../logging.js'
import { awaitTimeout } from '../util/timeouts.js'

const languages = [
  'Solidity',
  'C',
  'C++',
  'Carbon',
  'D',
  'C#',
  'F#',
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
  listeners: [
    {
      async ready (client, event) {
        while (client.isReady()) {
          const lang = languages.randomElement()
          await event.user.setActivity(`Coding in ${lang}`, {
            type: ActivityType.Competing
          })
          logger.info(`Set language status to ${lang}`)
          await awaitTimeout(3.6e+6)
        }
      }
    }
  ]
}
