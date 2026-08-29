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
booth init             # write a sample booth.toml
booth targets          # show the configured targets
booth open myproject   # start claude in /workspaces/myproject as session 'myproject'
booth ls
booth send myproject "run the tests and report back"   # waits, stops if it needs you
booth status myproject
booth logs myproject
booth close myproject
```

## Naming

A booth name is a folder name under `workspaces_root`, and it is used as-is for the tmux
session name. `booth open myproject` starts the command in `/workspaces/myproject` as session
`myproject`. Because folder names are unique within the workspaces root, session names cannot
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

# One shared container hosting every booth.
[targets.denv]
compose_file = "/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
service = "denv"
# project = "denv-cc-remote"   # passed as `docker compose -p` when set

# One container per project: `service` expands {name} to the booth name.
# [targets.perproject]
# compose_file = "/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
# service = "{name}"

# Only booths that need an override have to be listed.
[booths.myproject]
target = "denv"
command = "claude --remote-control myproject --add-dir /workspaces/shared"
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
| `booth open <name> [--restart] [--no-wait] [--ready-timeout s]` | Create the tmux session, start the command, and wait until it is actually usable |
| `booth ls [--target t]` | List sessions with their state |
| `booth status <name> [--json] [--pane n] [--wait-for settled]` | Report the state and exit with a code that matches it |
| `booth send <name> <text...> [--no-wait] [-w seconds] [--pane n] [-f]` | Send a line, then wait for the turn to finish — or stop as soon as the session needs you |
| `booth logs <name> [-n lines]` | Print the current pane content |
| `booth attach <name>` | Attach interactively (detach with the usual `Ctrl-b d`) |
| `booth close <name> [--settle s] [--wait s] [--force]` | Wait for the turn to finish, send `/exit`, then kill the session |

`open` refuses to reuse a live session unless `--restart` is given, checks that the workdir
exists in the container, and fails loudly if the command dies during startup instead of
reporting a session that is already gone.

## States and feedback

The point of booth is not to fire commands into the dark. Every command that waits stops
the moment the session needs a human — and says so, with the pane attached — so whoever
(or whatever) is driving can react.

The state comes from claude itself, via `claude agents --json` inside the container, so it
is not screen scraping. There are three tiers:

| State | Meaning | Exit code |
| --- | --- | --- |
| `not open` | No tmux session | 13 |
| `starting` | The session exists but claude has not registered yet — it is booting, or stopped at the login screen or the trust dialog (booth tells you which) | 12 |
| `idle` | At the prompt, ready for input | 0 |
| `busy` | Working on a turn | 10 |
| `waiting` | Stopped on something a human must answer — a dialog, a permission prompt. `waitingFor` says what | 11 |
| `no status` | The booth does not run claude, so there is nothing to report | 0 |

`booth send` waits for the turn to finish and exits 0. If the session stops on a dialog
instead, it exits 11 and prints the pane. Sending text into an open dialog would go nowhere,
so `send` refuses to do it unless you pass `--force`. `booth close` waits for the current
turn to finish before sending `/exit`, because a `/exit` typed mid-turn is dropped.

```bash
booth send myproject "run the tests"    # → 0: turn finished · 11: needs you · 10: still busy
booth status myproject --json           # machine-readable state for a supervising process
```

## Skill for Claude Code

`skill/SKILL.md` teaches a Claude Code session the lifecycle — open, send, close — and the
exit-code contract. It deliberately stops there: when booth stops on something, the CLI itself
prints the commands to run next, so that knowledge lives in the tool rather than in a document
that can drift. Install it once:

```bash
mkdir -p ~/.claude/skills/booth
cp "$(pnpm root -g)/@infodb/booth/skill/SKILL.md" ~/.claude/skills/booth/SKILL.md
```

Under devenviron, `~/.claude` is bind mounted from `.devcontainer/denv/.claude`, so installing it
once makes it available in every container.

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
