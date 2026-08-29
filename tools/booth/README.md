# @infodb/booth

A CLI that opens a **booth** — a tmux session on a docker compose service — and starts an
interactive command (typically `claude`) inside it.

The command keeps running after `booth open` returns. Later you talk to it with
`booth send`, read it with `booth logs`, sit in it with `booth attach`, and shut it down
with `booth close`, which sends `/exit` before killing the session.

Everything runs through `docker compose exec <service> tmux ...`, so booth itself holds no
state: the tmux server in the container is the source of truth.

## Running it

Nothing to install — `pnpx` fetches the published package:

```bash
pnpx @infodb/booth ls
```

If you use it often, either alias it or install it globally:

```bash
alias booth='pnpx @infodb/booth'
# or
pnpm add -g @infodb/booth
```

booth drives `docker compose`, so it has to run where the compose project is: on the host,
or inside a devenviron container (the docker socket is bind mounted there, and node is
already present). The examples below assume `booth` resolves to one of the forms above.

## Quick start

```bash
booth init          # write a sample booth.toml
booth targets       # show the configured targets
booth open allesc   # tmux new-session -d -s allesc -c /workspaces/allesc claude --remote-control allesc
booth ls
booth send allesc "run the tests and report back"
booth logs allesc
booth close allesc
```

## Naming

A booth name is a folder name under `workspaces_root`, and it is used as-is for the tmux
session name. `booth open allesc` starts the command in `/workspaces/allesc` as session
`allesc`. Because folder names are unique within the workspaces root, session names cannot
collide.

## Configuration

booth reads `booth.toml`, resolved in this order:

1. `--config <path>`
2. `$BOOTH_CONFIG`
3. `booth.toml` in the current directory or any parent
4. `~/.config/booth/booth.toml`

If none is found, every command except `init` fails with an error and exits 1 — booth never
guesses a target, so nothing is started. `booth init` writes the shipped
[`booth.example.toml`](./booth.example.toml) into the current directory.

```toml
[defaults]
# Used when --target is omitted. Optional if exactly one target is defined.
target = "denv"
# Booth names are folders under this directory, and the tmux session name.
workspaces_root = "/workspaces"
# The command started inside tmux. {name} and {workdir} are expanded.
# --remote-control starts an interactive session with Remote Control enabled,
# not the server mode (the `claude remote-control` subcommand).
command = "claude --remote-control {name}"

# One compose service per project: `service` expands {name} to the booth name.
[targets.denv]
compose_file = "/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
service = "{name}"
# project = "denv-cc-remote"   # passed as `docker compose -p` when set

# One shared container hosting every booth: write a fixed service name instead.
# [targets.shared]
# compose_file = "/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
# service = "denv"

# Only booths that need an override have to be listed.
[booths.allesc]
target = "denv"
command = "claude --remote-control allesc --add-dir /workspaces/shared"
```

Both container layouts work. With `service = "{name}"` each booth gets its own container, and
`booth ls` asks compose for the running services and queries each of them (services without
tmux are skipped). With a fixed service name, every booth is a tmux session in one container.

`compose_file` may be relative; it is resolved against the directory of `booth.toml`.
`command` accepts a string (split on whitespace) or an array of strings. tmux joins the
arguments back into one shell command, so avoid embedded quoting and write a wrapper
script if you need it.

## Commands

| Command | Description |
| --- | --- |
| `booth init [--force]` | Write a sample `booth.toml` into the current directory |
| `booth targets` | List the targets defined in the config |
| `booth open <name> [--target t] [--restart]` | Create the tmux session and start the command |
| `booth ls [--target t]` | List sessions (target, name, running command, uptime, attached) |
| `booth send <name> <text...> [--no-enter] [--delay ms]` | Send a line of text to the session |
| `booth logs <name> [-n lines]` | Print the current pane content |
| `booth attach <name>` | Attach interactively (detach with the usual `Ctrl-b d`) |
| `booth close <name> [--exit-command t] [--wait s] [--force]` | Send `/exit`, then kill the session |

`open` refuses to reuse a live session unless `--restart` is given, checks that the workdir
exists in the container, and fails loudly if the command dies during startup instead of
reporting a session that is already gone.

## Container requirements

The service must have `tmux` installed and must stay up on its own — the interactive
command is started by booth, not by the compose `command:`. A service that used to run
claude as its main process becomes:

```yaml
services:
  denv:
    image: denv-cc-remote:local
    command: ["sleep", "infinity"]
```

## License

MIT
