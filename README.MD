# DevDenBot

The official main Discord Bot for the
[Developer Den](https://developerden.org/discord) Discord Server.

## Achievements

Use `/achievements` to view earned and locked badges. The `level` and `reaction`
category filters include:

| Achievement | Unlock condition |
| --- | --- |
| Level Up: Apprentice | Reach level 5 |
| Level Up: Journeyman | Reach level 10 |
| Level Up: Expert | Reach level 25 |
| Level Up: Master | Reach level 50 |
| Broad Appeal | Receive reactions from 25 distinct other people across at least five distinct messages |

**All-Rounder**, in the `special` category, requires earned achievements in four
distinct active categories. Multiple badges in one category count only once.
Project Contributor counts toward this total; All-Rounder itself and unknown,
inactive, or revoked badges do not.

Level badges are checked after message XP, daily rewards, and confirmed staff XP
updates. Existing high-level members can earn all qualifying milestones on their
next XP action without leveling up again. All-Rounder is checked during automatic
achievement checks and after successful manual grants.

Broad Appeal uses the bot's recorded reaction history, checked when another
reaction is observed. Bots and self-reactions do not qualify, and multiple emojis
from one person do not increase the distinct-person count. Removed reactions stay
in the recorded history; messages predating reaction tracking are not backfilled.
Reducing XP or removing reactions does not automatically revoke earned badges.

New badges notify in the triggering channel, using the configured fallback when
needed. A silent manual grant also suppresses any resulting All-Rounder notification.

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
