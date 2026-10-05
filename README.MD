# DevDenBot

The official main Discord Bot for the
[Developer Den](https://developerden.org/discord) Discord Server.

## Building

### Building for Development

Development building skips linting checks and avoids compilation for faster
prototyping. By default, it is [configured](/src/Config.ts) to use roles and
channels from the DevDen Testing server. Invitations to this server are given on
request to avoid spam. Its use is recommended, as setting up your own testing
server can be tedious.

- Run `yarn install` to install all dependencies
- Run `yarn watch-dev` to start the bot, automatically reloading on changes. If
  this isn't desired, you can use `yarn build-and-run` to build and run the bot
  once, without automatic reloading.

### Building for Production

Production building runs linting checks and compiles the bot for production use.
This is mainly for our CI process, so it's unlikely that contributors will need
to use this.

It also uses the [Config.prod.ts](/src/Config.prod.ts) for configuration, which
by default, uses attributes from the real DevDen server. Obviously, this will
not be usable without the real bot token, so you will need to change these
attributes if you want to test in production.

- Run `yarn install` to install all dependencies
- Run `yarn build-prod` to build for production
- Optionally, use `yarn start-built` to run the bot after building

### Docker

We use [Nixpacks](https://nixpacks.com/docs/getting-started) to manage creation
of a Docker image. To build a docker image, run `nixpacks build .`

### Nix

This project also has a Nix Flake to set up a reproducible development
environment. To access this, run `nix develop`.
This is recommended for development, as it will automatically install all the dependencies you need in an isolated
environment.

## Running

The bot requires 2 things to run:

- A Discord bot token, defined in the `BOT_TOKEN` environment variable
- A SQL Database (optional). If no database settings are defined, the bot will
  run an in-memory SQLite database.

### Configuring a Database

To configure the bot to use a real SQL database (recommended), define the
following environment variables:

- `DDB_HOST` - The hostname of the database. Mandatory, probably `localhost`
- `DDB_PORT` - The port of the database. Optional, defaults to `3306`
- `DDB_DATABASE` - The name of the database. Optional, defaults to `database`
- `DDB_USERNAME` - The username to use when connecting to the database. Optional,
  defaults to `root`
- `DDB_PASSWORD` - The password to use when connecting to the database. Optional,
  defaults to `password`
- `DDB_DIALECT` - The SQL dialect to use. Optional, defaults to `postgres`. Must be a
  valid [Sequelize](https://sequelize.org/) dialect. You may need to install
  additional dependencies to use some dialects.

## Documentation Lookup

Use `/docs` to search the bot's local documentation index:

- `/docs source:python query:asyncio.gather`
- `/docs source:py query:asyncio.gather version:3.13`
- `/docs source:javascript query:Array.map`
- `/docs source:ts query:Utility Types`

`source` and `query` are required; `version` defaults to `Stable`. Supported
sources, aliases, and intentionally curated targets are:

| Source | Aliases | Targets |
| --- | --- | --- |
| Python | `py` | Stable, Python 3.13, Python 3.12 |
| JavaScript | `js` | Stable |
| TypeScript | `ts` | Stable |
| HTML | — | Stable |
| CSS | — | Stable |
| Node.js | `nodejs`, `node.js` | Stable, Node.js 24 LTS |
| Rust | — | Stable |
| Go | `golang` | Stable |

Python's Stable target follows the upstream `/3/` inventory while preserving
version-pinned result links. For DevDocs targets, Stable means the latest
available aggregate from DevDocs; it does not guarantee the upstream publisher's
current release. Add a source or target in `src/modules/docs/sources.ts`; add
new versions deliberately rather than accepting arbitrary version strings.

The index supports Sphinx v2 inventories and DevDocs publisher entries. It is
not a natural-language search and does not include every topic or symbol: for
TypeScript, search `Utility Types` rather than the unavailable `Partial` entry.
It requires no API keys or additional runtime dependencies.

The bot loads its local snapshot at startup, then syncs on startup and every 12
hours. During an upstream outage, it serves the last good cache and marks the
local refresh timestamp as stale; a result's upstream update timestamp, when
provided, is separate. `DOCS_CACHE_DIR` sets the snapshot directory, which
defaults to `.cache/docs`. Persist or mount this directory across redeploys for
offline resilience. On a cold start with no successful snapshot, documentation
lookups remain unavailable until the first sync completes without blocking the
rest of the bot.

Each download attempt has a 30-second timeout. Client-side timeouts are retried
at most twice, after 1 and 2 seconds, with a fresh timeout for each attempt.
Malformed documentation and other request failures are not retried. If all
attempts fail, the warning includes the request URL, attempt count, and cause;
the source keeps its last good cache (or remains unavailable without one)
until a later successful sync.

## Contributing Guidelines

- All code will be under the MIT License
- Make sure to run `yarn lint` before committing
- All contributions must be done through Pull Requests
- All Pull Requests must be reviewed and approved by at least one member of the
  team before being merged
- Use Semantic Versioning - `Major.Minor.Patch`. Avoid breaking changes where
  possible

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
