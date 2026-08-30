---
name: booth
description: Start, check, and stop a Claude Code session that runs inside a docker compose container, using the booth CLI. Use when asked to open, inspect, feed, or close a booth, or to work with a claude session hosted on a container rather than in this terminal.
---

# booth

`booth` runs a Claude Code session in a tmux session on a docker compose service and drives it
from outside. Invoke it as `pnpx @infodb/booth <command>`, or as `booth` when installed globally.

The session outlives the command that started it: open it once, then talk to it over many turns.

## Ask before spending the user's usage

`booth open` starts a Claude session and `booth send` makes one take a turn. Both consume the
account's subscription usage, and **you cannot measure how much** — do not estimate it. Ask the
user first unless they just asked you to. `targets`, `ls`, `status` and `logs` cost nothing.

## Lifecycle

```bash
booth targets                    # where booths can run
booth ls                         # what is open, and the state of each
booth open <name>                # start, and wait until the session is actually usable
booth send <name> "<prompt>"     # send a prompt and wait for the turn to finish
booth close <name>               # wait for the turn, send /exit, then kill the session
```

A booth name is a folder under `workspaces_root` and doubles as the tmux session name, so
`booth open api` runs in `/workspaces/api` as session `api`.

`open` resumes the booth's previous conversation by default (it adds `--continue`), so reopening
a booth continues where it left off rather than starting from nothing — the session it resumes
may already know things you did not tell it. Pass `--no-continue` when the work needs a clean
slate. On a workdir that has no conversation yet, booth falls back to a fresh one on its own.

`open` does not report success just because tmux came up — it waits until the session is really
usable. `close` waits for the current turn because a `/exit` typed mid-turn is dropped.
`close --force` skips that wait and kills the session, losing whatever the turn was doing.

## Branch on the exit code, then follow the "Next:" lines

Every command exits with the state the booth ended in.

| Code | State |
| --- | --- |
| 0 | idle — at the prompt |
| 10 | busy — still working |
| 11 | waiting — a decision is pending |
| 12 | starting — not usable yet, or stopped at login or the trust dialog |
| 13 | not open |
| 1 | config or docker error |

When booth stops because something is needed, **it prints the exact commands to run next, under
`Next:`**. Follow those instead of improvising; they are built from the state it just observed,
and they carry the traps with them (for example, that answering the trust dialog with Enter would
end the session rather than approve the folder).

Two decisions belong to the user, not to you: whether to trust a folder, and how to answer a
permission prompt. Report those and stop.

## Do not run `booth attach`

It hands the terminal over to the session interactively and does not return. Read with
`booth logs <name>` and act with the commands booth suggests.
