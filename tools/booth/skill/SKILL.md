---
name: booth
description: Drive a Claude Code session that runs inside a docker compose container, through the booth CLI - open it, send prompts, read its state, answer its dialogs, and close it. Use when asked to start, inspect, feed, or stop a booth, or to work with a claude session hosted on a container rather than in this terminal.
---

# booth

`booth` starts a Claude Code session in a tmux session on a docker compose service and drives it
from outside. Invoke it as `pnpx @infodb/booth <command>`, or as `booth` when it is installed
globally. Everything it does is `docker compose exec <service> tmux ...`, so the tmux server in
the container holds the state — booth keeps none of its own.

The session keeps running after the command returns. That is the point: you open it once and talk
to it over many turns.

## Ask before spending the user's usage

`booth open` starts a Claude session and `booth send` makes one take a turn. Both consume the
account's subscription usage, and **you cannot measure how much** — do not estimate it. Ask the
user before running either, unless they just asked you to. Reading state (`status`, `ls`, `logs`,
`targets`) consumes nothing and needs no permission.

## Exit codes carry the state

Every command exits with the state the booth ended in. Branch on the code; do not parse the text.

| Code | State | Meaning |
| --- | --- | --- |
| 0 | `idle` | At the prompt, ready for input |
| 10 | `busy` | Still working on a turn |
| 11 | `waiting` | A decision is pending. booth prints the pane with it |
| 12 | `starting` | Not usable yet — booting, or stopped at the login screen or trust dialog |
| 13 | `not open` | No session. `booth open <name>` first |
| 1 | error | Config or docker problem |

The state comes from `claude agents --json` inside the container, not from reading the screen.

## The loop

```bash
booth ls                        # every booth and its state
booth send <name> "<prompt>"    # send, wait for the turn, exit 0 / 10 / 11
booth status <name> --json      # machine-readable state
booth logs <name> -n 40         # what is on screen right now
```

`booth send` waits for the turn to finish. **It stops the moment the session needs a decision**,
exits 11, and prints the pane so you can read the options. That is the signal to act.

## Answering what it stops on

Text typed into an open dialog does not reach an input field. Answer with key names instead:

```bash
booth key <name> Down Enter     # move and confirm
booth key <name> Escape         # dismiss
```

`booth key` takes tmux key names (`Enter`, `Escape`, `Up`, `Down`, `Tab`, `C-c`) and prints the
resulting screen and state. `booth send --force` types text while a dialog is open; use it only
when the dialog genuinely takes free text.

**The trust dialog is different: its default choice is "No, exit".** Enter on it ends the session
instead of approving the folder. Whether to trust a folder is the user's call — report it and
stop, do not answer it.

A permission prompt is likewise the user's call unless they have already told you how to answer.

## Starting and stopping

```bash
booth targets                   # where booths can run
booth open <name>               # start, and wait until it is actually usable
booth close <name>              # wait for the turn, send /exit, then kill the session
```

A booth name is a folder name under `workspaces_root` and doubles as the tmux session name, so
`booth open api` runs in `/workspaces/api` as session `api`.

`open` exits 12 if the session comes up but stalls; the message says whether it is waiting on
login or on the trust dialog. It leaves the session alive so a human can finish it.

`close` waits because a `/exit` typed mid-turn is dropped. `close --force` skips the wait and
kills the session outright, losing whatever the turn was doing.

## Two things not to do

**Do not run `booth attach`.** It hands the terminal to the session interactively and will not
return. Use `logs` to read and `send`/`key` to act.

**Do not expect a state from a booth that does not run claude.** Such a booth reports
`no status`, `send` has nothing to wait for, and only `logs` will tell you what happened.
