#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { Command } from 'commander';
import {
  Config,
  ConfigError,
  hasServiceTemplate,
  launchCommand,
  loadConfig,
  resolveBooth,
  sessionName,
  withServiceName,
  type Booth,
  type Target,
} from './config.js';
import { DockerError, execInteractive, listRunningServices } from './docker.js';
import {
  EXIT,
  describe,
  exitCodeFor,
  inspectBooth,
  listAgents,
  statusByWorkdir,
  survivedLaunch,
  waitForReady,
  waitForSettled,
  type AgentRecord,
  type BoothState,
} from './state.js';
import {
  capturePane,
  createSession,
  directoryExists,
  hasSession,
  killSession,
  killSessionSafe,
  listSessions,
  sendKeys,
  sendText,
  sleepSync,
  type SessionInfo,
} from './session.js';

const VERSION = '0.5.1';

/** 起動を見届ける時間。使える状態になれば待たずに抜けるので、実際にはここまで掛からない。 */
const STARTUP_GRACE_MS = 8000;

/** init が書き出す雛形。パッケージ同梱の booth.example.toml がそのまま原本。 */
const SAMPLE_CONFIG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'booth.example.toml'
);

const program = new Command();

program
  .name('booth')
  .description('Launch and drive claude sessions inside tmux on a docker compose service')
  .version(VERSION)
  .option('-c, --config <path>', 'Path to booth.toml');

program
  .command('init')
  .description('Write a sample booth.toml into the current directory')
  .option('-f, --force', 'Overwrite an existing booth.toml')
  .action((options: { force?: boolean }) => {
    const dest = path.join(process.cwd(), 'booth.toml');
    if (fs.existsSync(dest) && !options.force) {
      fail(`booth.toml already exists at ${dest}. Use --force to overwrite.`);
    }
    if (!fs.existsSync(SAMPLE_CONFIG_PATH)) {
      fail(`Sample config is missing from the installed package: ${SAMPLE_CONFIG_PATH}`);
    }
    fs.copyFileSync(SAMPLE_CONFIG_PATH, dest);
    console.log(`${chalk.green('✔')} Created ${dest}`);
  });

program
  .command('open')
  .description('Create a tmux session and start the booth command in it')
  .argument('<name>', 'Booth name (folder under workspaces_root, used as the session name)')
  .option('-t, --target <target>', 'Target to open the booth on')
  .option('--restart', 'Kill an existing session with the same name first')
  .option('--continue', 'Resume the previous conversation in the workdir (the default)')
  .option('--no-continue', 'Start a fresh conversation instead of resuming')
  .option('--no-wait', 'Return as soon as the tmux session exists')
  .option('--ready-timeout <seconds>', 'How long to wait for the session to become usable', '60')
  .action(
    (
      name: string,
      options: {
        target?: string;
        restart?: boolean;
        continue?: boolean;
        wait: boolean;
        readyTimeout: string;
      }
    ) => {
      run(() => {
        const booth = resolveBooth(config(), name, options.target, options.continue);

        if (hasSession(booth.target, booth.session)) {
          if (!options.restart) {
            fail(`Booth '${booth.name}' is already open on '${booth.target.name}'. Use --restart to recreate it.`);
          }
          killSession(booth.target, booth.session);
          console.log(`${chalk.yellow('↺')} Killed existing session '${booth.name}'`);
        }

        if (!directoryExists(booth.target, booth.workdir)) {
          fail(`Workdir '${booth.workdir}' does not exist in service '${booth.target.service}'.`);
        }

        const launch = launchCommand(booth);
        let command = launch.command;
        createSession(booth, command);
        let started = survivedLaunch(booth, STARTUP_GRACE_MS);

        // その workdir にまだ会話の記録が無いと、claude --continue は
        // 「No conversation found to continue」と言って終了する。初回だけの話なので、
        // 引き継ぎ無しで開き直す。それでも死ぬなら本当の起動失敗。
        let fellBack = false;
        if (!started && launch.resuming) {
          command = booth.command;
          createSession(booth, command);
          started = survivedLaunch(booth, STARTUP_GRACE_MS);
          fellBack = started;
        }

        if (!started) {
          fail(
            `Booth '${booth.name}' exited immediately. Check that \`${booth.command[0]}\` runs in ` +
              `'${booth.workdir}' on service '${booth.target.service}'.`
          );
        }

        console.log(
          `${chalk.green('✔')} Opened ${chalk.bold(booth.name)} on ` +
            `${booth.target.name} (service ${booth.target.service})`
        );
        console.log(`  ${chalk.dim('workdir')} ${booth.workdir}`);
        console.log(`  ${chalk.dim('command')} ${command.join(' ')}`);
        if (fellBack) {
          console.log(chalk.dim('  No conversation to continue; started a fresh one.'));
        }

        if (!options.wait) return;

        // tmux セッションが立っただけでは、まだ使えるとは限らない。
        // ログイン画面や信頼ダイアログで止まっていることがあるため、
        // セッション記録が現れるまで待って「本当に使える」ことを確かめる。
        const state = waitForReady(booth, Number(options.readyTimeout) * 1000);
        reportState(booth, state, { paneOnAttention: true });
        if (state.phase === 'starting') process.exit(EXIT.blocked);
      });
    }
  );

program
  .command('ls')
  .alias('list')
  .description('List tmux sessions on the configured targets')
  .option('-t, --target <target>', 'Only list this target')
  .action((options: { target?: string }) => {
    run(() => {
      const cfg = config();
      const rows = selectTargets(cfg, options.target).flatMap((target) => {
        try {
          // service = "{name}" のターゲットは、どのコンテナを見ればよいかが
          // 設定だけでは決まらないので、起動中のサービスを compose に列挙させる。
          // tmux が無いサービスは list-sessions が失敗し、空として落ちる。
          const services = hasServiceTemplate(target)
            ? listRunningServices(target).map((service) => withServiceName(target, service))
            : [target];
          return services.flatMap((t) => {
            const byWorkdir = statusByWorkdir(listAgents(t));
            return listSessions(t).map((row) => ({
              ...row,
              name: boothNameOf(row),
              state: describeRow(row.workdir, byWorkdir),
            }));
          });
        } catch (error) {
          // 一覧では、落ちているターゲットがあっても他は見せる。
          if (error instanceof DockerError) {
            console.error(chalk.yellow(`⚠ ${target.name}: ${error.message.split('\n')[0]}`));
            return [];
          }
          throw error;
        }
      });

      if (rows.length === 0) {
        console.log(chalk.dim('No sessions.'));
        return;
      }

      const widths = {
        target: Math.max(6, ...rows.map((r) => r.target.length)),
        service: Math.max(7, ...rows.map((r) => r.service.length)),
        name: Math.max(4, ...rows.map((r) => r.name.length)),
        state: Math.max(6, ...rows.map((r) => r.state.length)),
      };

      console.log(
        chalk.dim(
          `${'TARGET'.padEnd(widths.target)}  ${'SERVICE'.padEnd(widths.service)}  ` +
            `${'NAME'.padEnd(widths.name)}  ${'STATE'.padEnd(widths.state)}  UPTIME  ATTACHED`
        )
      );
      for (const row of rows) {
        console.log(
          `${row.target.padEnd(widths.target)}  ${row.service.padEnd(widths.service)}  ` +
            `${chalk.bold(row.name.padEnd(widths.name))}  ` +
            `${colorState(row.state).padEnd(widths.state + colorPad(row.state))}  ` +
            `${uptime(row.created).padEnd(6)}  ${row.attached ? 'yes' : 'no'}`
        );
      }
    });
  });

program
  .command('send')
  .description('Send a line of text to the booth session and wait for it to settle')
  .argument('<name>', 'Booth name')
  .argument('<text...>', 'Text to send')
  .option('-t, --target <target>', 'Target the booth runs on')
  .option('--no-enter', 'Send the text without a trailing Enter')
  .option('--delay <ms>', 'Delay before sending Enter', '150')
  .option('--no-wait', 'Return immediately instead of waiting for the turn to finish')
  .option('-w, --wait-timeout <seconds>', 'How long to wait for the turn to finish', '600')
  .option('--pane <lines>', 'Lines of pane output to show when it stops for you', '25')
  .option('-f, --force', 'Send even when the session is waiting on a dialog')
  .action(
    (
      name: string,
      text: string[],
      options: {
        target?: string;
        enter: boolean;
        delay: string;
        wait: boolean;
        waitTimeout: string;
        pane: string;
        force?: boolean;
      }
    ) => {
      run(() => {
        const booth = requireOpen(name, options.target);
        const before = inspectBooth(booth);

        // ダイアログが出ている間にテキストを打っても入力欄には入らない。
        // 選択肢の操作が要るので、既定では止める。
        if (before.phase === 'ready' && before.status === 'waiting' && !options.force) {
          console.error(
            `${chalk.red('✖')} ${chalk.bold(booth.name)} is waiting: ${describe(before)}`
          );
          printPane(booth, Number(options.pane));
          printNext(booth, before);
          process.exit(EXIT.waiting);
        }

        sendText(booth.target, booth.session, text.join(' '), options.enter, Number(options.delay));
        console.log(`${chalk.green('✔')} Sent to ${chalk.bold(booth.name)}`);

        if (!options.wait || before.phase !== 'ready') {
          if (options.wait && before.phase !== 'ready') {
            console.log(chalk.dim(`  Not waiting: ${describe(before)}.`));
          }
          return;
        }

        const result = waitForSettled(booth, {
          settleMs: 5000,
          timeoutMs: Number(options.waitTimeout) * 1000,
        });

        switch (result.settled) {
          case 'idle':
            if (!result.reacted) {
              console.log(
                chalk.yellow('⚠ The session never left idle. The input may not have registered.')
              );
              printPane(booth, Number(options.pane));
              process.exit(EXIT.ok);
            }
            console.log(`${chalk.green('✔')} Turn finished · ${chalk.bold(booth.name)} is idle`);
            return;
          case 'waiting':
            console.log(
              `${chalk.yellow('⏸')} ${chalk.bold(booth.name)} needs you: ${describe(result.state)}`
            );
            printPane(booth, Number(options.pane));
            printNext(booth, result.state);
            process.exit(EXIT.waiting);
          case 'timeout':
            console.log(
              chalk.yellow(`⏱ Still ${result.state.status ?? 'running'} after ${options.waitTimeout}s.`)
            );
            printPane(booth, Number(options.pane));
            printNext(booth, result.state);
            process.exit(EXIT.busy);
          case 'gone':
            fail(`Booth '${booth.name}' disappeared while waiting.`);
            return;
          default:
            console.log(chalk.dim('  Status is no longer reported; stopped waiting.'));
            return;
        }
      });
    }
  );

program
  .command('key')
  .description('Send tmux key names (Enter, Escape, Up, C-c …) — how you answer a dialog')
  .argument('<name>', 'Booth name')
  .argument('<keys...>', 'tmux key names, in order')
  .option('-t, --target <target>', 'Target the booth runs on')
  .option('--pane <lines>', 'Lines of pane output to show afterwards', '25')
  .action((name: string, keys: string[], options: { target?: string; pane: string }) => {
    run(() => {
      const booth = requireOpen(name, options.target);
      sendKeys(booth.target, booth.session, keys);
      console.log(`${chalk.green('✔')} Sent ${keys.join(' ')} to ${chalk.bold(booth.name)}`);

      // キー操作は画面を見て次を決めるものなので、少し待ってから結果を返す。
      sleepSync(1000);
      const state = inspectBooth(booth);
      reportState(booth, state, { paneOnAttention: false });
      printPane(booth, Number(options.pane));
      process.exit(exitCodeFor(state));
    });
  });

program
  .command('status')
  .description('Report whether the booth is idle, busy, waiting on you, or stuck starting')
  .argument('<name>', 'Booth name')
  .option('-t, --target <target>', 'Target the booth runs on')
  .option('--json', 'Print the state as JSON')
  .option('--pane <lines>', 'Also print this many lines of pane output', '0')
  .option('-w, --wait-for <state>', 'Block until the booth reaches idle or waiting')
  .option('--wait-timeout <seconds>', 'How long to block for --wait-for', '600')
  .action(
    (
      name: string,
      options: { target?: string; json?: boolean; pane: string; waitFor?: string; waitTimeout: string }
    ) => {
      run(() => {
        const booth = resolveBooth(config(), name, options.target);

        let state: BoothState;
        if (options.waitFor) {
          if (!['idle', 'waiting', 'settled'].includes(options.waitFor)) {
            fail(`--wait-for takes 'idle', 'waiting' or 'settled'.`);
          }
          const result = waitForSettled(booth, { timeoutMs: Number(options.waitTimeout) * 1000 });
          state = result.state;
        } else {
          state = inspectBooth(booth);
        }

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                name: booth.name,
                target: booth.target.name,
                service: booth.target.service,
                workdir: booth.workdir,
                phase: state.phase,
                status: state.status ?? null,
                waitingFor: state.waitingFor ?? null,
                blockedOn: state.blockedOn ?? null,
                pid: state.agent?.pid ?? null,
                sessionId: state.agent?.sessionId ?? null,
              },
              null,
              2
            )
          );
        } else {
          reportState(booth, state, { paneOnAttention: false });
        }

        const lines = Number(options.pane);
        if (lines > 0 && state.phase !== 'absent') printPane(booth, lines);

        process.exit(exitCodeFor(state));
      });
    }
  );

program
  .command('logs')
  .description('Print the current pane content of the booth session')
  .argument('<name>', 'Booth name')
  .option('-t, --target <target>', 'Target the booth runs on')
  .option('-n, --lines <count>', 'Number of scrollback lines to include', '200')
  .action((name: string, options: { target?: string; lines: string }) => {
    run(() => {
      const booth = requireOpen(name, options.target);
      process.stdout.write(capturePane(booth.target, booth.session, Number(options.lines)));
    });
  });

program
  .command('attach')
  .description('Attach to the booth session interactively')
  .argument('<name>', 'Booth name')
  .option('-t, --target <target>', 'Target the booth runs on')
  .action((name: string, options: { target?: string }) => {
    run(() => {
      const booth = requireOpen(name, options.target);
      process.exit(execInteractive(booth.target, ['tmux', 'attach', '-t', `=${booth.session}`]));
    });
  });

program
  .command('close')
  .description('Send /exit to the booth command, then kill the session')
  .argument('<name>', 'Booth name')
  .option('-t, --target <target>', 'Target the booth runs on')
  .option('--exit-command <text>', 'Text to send before killing the session', '/exit')
  .option('-w, --wait <seconds>', 'How long to wait for a clean exit', '10')
  .option('--settle <seconds>', 'How long to wait for a busy session to finish first', '300')
  .option('-f, --force', 'Kill the session without sending the exit command')
  .action((name: string, options: { target?: string; exitCommand: string; wait: string; settle: string; force?: boolean }) => {
    run(() => {
      const booth = requireOpen(name, options.target);

      if (!options.force) {
        // 処理中に /exit を送っても入力欄に届かず取りこぼす。落ち着くまで待つ。
        const state = inspectBooth(booth);
        if (state.phase === 'ready' && state.status !== 'idle') {
          console.log(chalk.dim(`  ${booth.name} is ${describe(state)}; waiting for it to settle…`));
          const result = waitForSettled(booth, { timeoutMs: Number(options.settle) * 1000 });
          if (result.settled === 'waiting') {
            console.error(
              `${chalk.red('✖')} ${chalk.bold(booth.name)} is waiting: ${describe(result.state)}`
            );
            printPane(booth, 25);
            printNext(booth, result.state);
            console.error(chalk.dim(`    booth close ${booth.name} --force   give up on the turn and kill it`));
            process.exit(EXIT.waiting);
          }
          if (result.settled === 'timeout') {
            console.error(
              `${chalk.red('✖')} ${chalk.bold(booth.name)} is still busy after ${options.settle}s.`
            );
            printNext(booth, result.state);
            console.error(chalk.dim(`    booth close ${booth.name} --force   give up on the turn and kill it`));
            process.exit(EXIT.busy);
          }
        }

        sendText(booth.target, booth.session, options.exitCommand, true, 150);
        const deadline = Date.now() + Number(options.wait) * 1000;
        while (Date.now() < deadline) {
          if (!hasSession(booth.target, booth.session)) {
            console.log(`${chalk.green('✔')} Closed ${chalk.bold(booth.name)} (exited on '${options.exitCommand}')`);
            return;
          }
          sleepSync(500);
        }
        console.log(chalk.yellow(`⚠ '${options.exitCommand}' did not end the session within ${options.wait}s; killing it.`));
      }

      killSessionSafe(booth.target, booth.session);
      console.log(`${chalk.green('✔')} Closed ${chalk.bold(booth.name)}`);
    });
  });

program
  .command('targets')
  .description('List the targets defined in the config')
  .action(() => {
    run(() => {
      const cfg = config();
      console.log(chalk.dim(`config: ${cfg.path}`));
      for (const target of cfg.targets.values()) {
        const mark = target.name === cfg.defaultTarget ? chalk.green(' (default)') : '';
        console.log(`${chalk.bold(target.name)}${mark}`);
        console.log(`  ${chalk.dim('compose')} ${target.composeFile}`);
        console.log(`  ${chalk.dim('service')} ${target.service}`);
      }
    });
  });

let cachedConfig: Config | undefined;

function config(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig(program.opts<{ config?: string }>().config);
  }
  return cachedConfig;
}

/** 開いていない booth に send/logs/attach しても意味がないので先に弾く。 */
function requireOpen(name: string, targetOverride?: string): Booth {
  const booth = resolveBooth(config(), name, targetOverride);
  if (!hasSession(booth.target, booth.session)) {
    console.error(
      `${chalk.red('✖')} Booth '${booth.name}' is not open on '${booth.target.name}'.`
    );
    printNext(booth, { phase: 'absent' });
    process.exit(EXIT.absent);
  }
  return booth;
}

function selectTargets(cfg: Config, name?: string): Target[] {
  if (!name) return [...cfg.targets.values()];
  const target = cfg.targets.get(name);
  if (!target) {
    fail(`Unknown target '${name}'. Known: ${[...cfg.targets.keys()].join(', ')}`);
  }
  return [target];
}

/** 状態を人向けに1〜2行で出す。注意が要る状態ならペインと次の一手も添える。 */
function reportState(booth: Booth, state: BoothState, options: { paneOnAttention: boolean }): void {
  const text = describe(state);
  switch (state.phase) {
    case 'ready':
      if (state.status === 'waiting') {
        console.log(`${chalk.yellow('⏸')} ${chalk.bold(booth.name)} needs you: ${text}`);
        if (options.paneOnAttention) printPane(booth, 25);
        printNext(booth, state);
        return;
      }
      if (state.status === 'idle') {
        console.log(`${chalk.green('●')} ${chalk.bold(booth.name)} is idle`);
        return;
      }
      console.log(`${chalk.cyan('◐')} ${chalk.bold(booth.name)} is ${text}`);
      printNext(booth, state);
      return;
    case 'starting':
      console.log(`${chalk.yellow('◌')} ${chalk.bold(booth.name)}: ${text}`);
      if (options.paneOnAttention) printPane(booth, 25);
      printNext(booth, state);
      return;
    case 'absent':
      console.log(`${chalk.dim('○')} ${chalk.bold(booth.name)} is not open`);
      printNext(booth, state);
      return;
    case 'unknown':
      console.log(`${chalk.dim('?')} ${chalk.bold(booth.name)}: ${text}`);
      return;
  }
}

interface NextStep {
  command: string;
  why: string;
}

/**
 * 止まった理由ごとに、次に叩くコマンドを出す。
 * 使う側 (人でも AI でも) が手順を覚えていなくても続けられるように、
 * 知識はドキュメントではなくここに置く。
 */
function nextSteps(booth: Booth, state: BoothState): NextStep[] {
  switch (state.phase) {
    case 'absent':
      return [{ command: `booth open ${booth.name}`, why: 'start the session' }];

    case 'starting':
      if (state.blockedOn === 'login') {
        return [
          {
            command: `docker compose -f ${booth.target.composeFile} run --rm ${booth.target.service} claude`,
            why: 'log in once, interactively, then open the booth again',
          },
        ];
      }
      if (state.blockedOn === 'trust') {
        return [
          {
            command: `booth attach ${booth.name}`,
            why: "approve the folder yourself — the dialog's default is 'No, exit', so Enter would end the session",
          },
        ];
      }
      return [{ command: `booth status ${booth.name}`, why: 'check again in a moment' }];

    case 'ready':
      if (state.status === 'waiting') {
        return [
          { command: `booth key ${booth.name} Escape`, why: 'dismiss it' },
          { command: `booth key ${booth.name} Down Enter`, why: 'move and confirm (text will not reach a dialog)' },
          { command: `booth attach ${booth.name}`, why: 'answer it by hand' },
        ];
      }
      if (state.status !== 'idle' && state.status !== undefined) {
        return [
          { command: `booth status ${booth.name} --wait-for settled`, why: 'block until it finishes or needs you' },
          { command: `booth logs ${booth.name} -n 40`, why: 'see what it is doing' },
        ];
      }
      return [];

    case 'unknown':
      return [];
  }
}

function printNext(booth: Booth, state: BoothState): void {
  const steps = nextSteps(booth, state);
  if (steps.length === 0) return;
  const width = Math.max(...steps.map((s) => s.command.length));
  console.log(chalk.dim('  Next:'));
  for (const step of steps) {
    console.log(chalk.dim(`    ${step.command.padEnd(width)}   ${step.why}`));
  }
}

function printPane(booth: Booth, lines: number): void {
  if (lines <= 0) return;
  try {
    const pane = capturePane(booth.target, booth.session, lines);
    const tail = pane.split('\n').slice(-lines).join('\n').trimEnd();
    if (tail) console.log(chalk.dim(indent(tail)));
  } catch {
    // 画面が取れなくても状態の報告自体は成立するので黙って諦める。
  }
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `  │ ${line}`)
    .join('\n');
}

/**
 * ls に出す名前。tmux は `.` を `_` に置き換えて持っているので、セッション名を
 * そのまま出すと他の booth コマンドに渡せない名前になる。ペインの作業ディレクトリ
 * 名が同じ置換でセッション名になるなら、そちらが元の booth 名。
 */
function boothNameOf(row: SessionInfo): string {
  const base = row.workdir ? path.posix.basename(row.workdir) : '';
  return base && sessionName(base) === row.name ? base : row.name;
}

/**
 * ls の1行分。status が引けない booth は '-' にする。
 * 突き合わせはセッション名ではなくペインの作業ディレクトリで行う。名前から
 * workdir を組み立てると、tmux に置換された名前や [booths.*].workdir で
 * 場所を変えた booth を取り逃がす。
 */
function describeRow(workdir: string, byWorkdir: Map<string, AgentRecord>): string {
  const agent = workdir ? byWorkdir.get(workdir) : undefined;
  if (!agent) return '-';
  if (agent.status === 'waiting') return agent.waitingFor ? `waiting(${agent.waitingFor})` : 'waiting';
  return agent.status ?? '-';
}

function colorState(state: string): string {
  if (state.startsWith('waiting')) return chalk.yellow(state);
  if (state === 'idle') return chalk.green(state);
  if (state === '-') return chalk.dim(state);
  return chalk.cyan(state);
}

/** chalk が足す ANSI の分だけ padEnd を伸ばす。 */
function colorPad(state: string): number {
  return colorState(state).length - state.length;
}

function uptime(created: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - created.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function run(action: () => void): void {
  try {
    action();
  } catch (error) {
    if (error instanceof ConfigError || error instanceof DockerError) {
      fail(error.message);
    }
    throw error;
  }
}

function fail(message: string): never {
  console.error(`${chalk.red('✖')} ${message}`);
  process.exit(1);
}

program.parse();
