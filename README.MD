# DevDenBot

The official main Discord Bot for the
[Developer Den](https://developerden.org/discord) Discord Server.

## Building

### Building for Development

Development runs the bot's TypeScript directly and builds the Activity frontend.
By default, it is [configured](/src/Config.ts) to use roles and
channels from the DevDen Testing server. Invitations to this server are given on
request to avoid spam. Its use is recommended, as setting up your own testing
server can be tedious.

- Use Bun `1.4.2` (as pinned in `package.json`) and run `bun install` to install
  all dependencies.
- Run `bun run watch-dev` to start the bot and Activity server together, with
  automatic bot reloads. Use `bun run start` without automatic reloads.
- Development startup builds the Activity frontend automatically. Restart the
  command after frontend HTML/CSS/TypeScript edits; it has no frontend hot reload.
- Run `bun run typecheck` and `bun run typecheck:prod` to check both the bot and
  Activity against the shared strict TypeScript settings.

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

### Docker Compose

The repository ships a [`docker-compose.yml`](/docker-compose.yml) that builds
the bot image from the [`Dockerfile`](/Dockerfile) and runs it together with a
PostgreSQL database.

1. Copy the example environment file and fill in your values:

   ```sh
   cp .env.local.example .env
   ```

   At minimum, set `DDB_BOT_TOKEN`. `DDB_PASTE_BYPASS_TOKEN` is optional.

2. Build and start everything:

   ```sh
   docker compose up --build
   ```


## BlockCount Discord Activity

BlockCount is a single-player 8×8 puzzle inside Discord, with mouse, touch, and
keyboard controls. Draw a side-connected region containing exactly one clue,
using as many cells as its number. Cover the board without overlaps to win.
Generated puzzles always have a solution; other valid solutions are accepted.
While drawing, a valid selection immediately takes on its clue's block color
once the cell count matches. Adding too many cells or another clue returns the
selection to its amber preview; release or press Enter to place a valid block.
Fast drags include the cells crossed between pointer updates. Moving outside the
board cancels the current stroke.

Tap a placed block to remove it. Undo restores the previous move, including
removals and resets. For keyboard play, use arrow keys to move, Space to select,
Enter to place, Delete/Backspace to remove, and Escape to cancel. Progress is
saved in this browser/device, not synchronized between devices.
Completing a puzzle focuses “Play another puzzle” and disables the covered board,
so keyboard input cannot accidentally change the saved solution.
Help, Undo, Reset, and New are grouped in the compact header above the board.
The interface has no preview-mode badge. Discord connection errors close any open
help or confirmation dialog so the error message remains visible.

The frontend uses the Discord Embedded App SDK. Its HTTP server starts and stops
inside the bot process, so normal development needs only one command:

```sh
bun run watch-dev
```

The bot builds the Activity assets on each non-production startup and serves
them at `http://localhost:3001`. It supplies its logged-in application ID;
`DISCORD_CLIENT_ID` is not needed when running with the bot. Configure the
development bot token and test-server IDs as usual in the local environment and
`src/Config.ts`.

`ACTIVITY_PORT` is optional and defaults to `3001`. The server exposes only
`/`, `/app.js`, `/style.css`, `/config.json`, and `/health`. Production uses
prebuilt assets: the Docker image builds them during image creation. Outside
Docker, run `bun run activity:build` before `bun run start:prod`.

Compose publishes the Activity port on the bot service; no separate Activity
container or profile is required:

```sh
docker compose up --build
```

For an optional **Activity-only browser preview**, without a bot token or
database:

```sh
bun run activity:build
bun run activity:start
```

That standalone mode reads `DISCORD_CLIENT_ID` if you want to embed it in
Discord. Normal browser preview does not connect to Discord.

For local testing inside Discord, expose the Activity port in another terminal:

```sh
cloudflared tunnel --url http://localhost:3001
```

Tunnels are not started automatically: they make the local service publicly
accessible. Put the generated hostname in the development application's URL
mapping, update it when the tunnel address changes, and remove it after testing.

To enable it in Discord:

1. Open the **existing bot application** in the Discord Developer Portal and
   enable **Activities**. Enable the desktop/web/mobile platforms you support.
2. Host this service behind HTTPS. Under **Activities → URL Mappings**, map
   the `/` prefix to your host (without `https://`; for example,
   `games.example.com`). Discord does not host the game files for you.
3. Use the same application as the logged-in bot; its ID is supplied automatically.
   For Activity-only hosting, set `DISCORD_CLIENT_ID` to that public application ID.
   Never put the bot token or a client secret in frontend configuration.
4. Restart the bot to register `/blockcount` in its configured guild. Launch it
   with that command or the application's **Launch** entry in the App Launcher.
   Global command synchronization preserves Discord's existing Activity entry.

Verify the embedded launch in Discord after configuring the public host and
Developer Portal. Browser preview proves gameplay but not Discord's handshake,
URL mapping, or availability to other users.

## Nix

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
