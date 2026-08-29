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
  loadConfig,
  resolveBooth,
  withServiceName,
  type Booth,
  type Target,
} from './config.js';
import { DockerError, execInteractive, listRunningServices } from './docker.js';
import {
  capturePane,
  createSession,
  directoryExists,
  hasSession,
  killSession,
  killSessionSafe,
  listSessions,
  sendText,
  sleepSync,
  survivedStartup,
} from './session.js';

const VERSION = '0.1.0';

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
  .action((name: string, options: { target?: string; restart?: boolean }) => {
    run(() => {
      const booth = resolveBooth(config(), name, options.target);

      if (hasSession(booth.target, booth.name)) {
        if (!options.restart) {
          fail(`Booth '${booth.name}' is already open on '${booth.target.name}'. Use --restart to recreate it.`);
        }
        killSession(booth.target, booth.name);
        console.log(`${chalk.yellow('↺')} Killed existing session '${booth.name}'`);
      }

      if (!directoryExists(booth.target, booth.workdir)) {
        fail(`Workdir '${booth.workdir}' does not exist in service '${booth.target.service}'.`);
      }

      createSession(booth);

      if (!survivedStartup(booth.target, booth.name)) {
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
      console.log(`  ${chalk.dim('command')} ${booth.command.join(' ')}`);
    });
  });

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
          return services.flatMap((t) => listSessions(t));
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
        command: Math.max(7, ...rows.map((r) => r.command.length)),
      };

      console.log(
        chalk.dim(
          `${'TARGET'.padEnd(widths.target)}  ${'SERVICE'.padEnd(widths.service)}  ` +
            `${'NAME'.padEnd(widths.name)}  ${'COMMAND'.padEnd(widths.command)}  UPTIME  ATTACHED`
        )
      );
      for (const row of rows) {
        console.log(
          `${row.target.padEnd(widths.target)}  ${row.service.padEnd(widths.service)}  ` +
            `${chalk.bold(row.name.padEnd(widths.name))}  ` +
            `${row.command.padEnd(widths.command)}  ${uptime(row.created).padEnd(6)}  ${row.attached ? 'yes' : 'no'}`
        );
      }
    });
  });

program
  .command('send')
  .description('Send a line of text to the booth session')
  .argument('<name>', 'Booth name')
  .argument('<text...>', 'Text to send')
  .option('-t, --target <target>', 'Target the booth runs on')
  .option('--no-enter', 'Send the text without a trailing Enter')
  .option('--delay <ms>', 'Delay before sending Enter', '150')
  .action((name: string, text: string[], options: { target?: string; enter: boolean; delay: string }) => {
    run(() => {
      const booth = requireOpen(name, options.target);
      sendText(booth.target, booth.name, text.join(' '), options.enter, Number(options.delay));
      console.log(`${chalk.green('✔')} Sent to ${chalk.bold(booth.name)}`);
    });
  });

program
  .command('logs')
  .description('Print the current pane content of the booth session')
  .argument('<name>', 'Booth name')
  .option('-t, --target <target>', 'Target the booth runs on')
  .option('-n, --lines <count>', 'Number of scrollback lines to include', '200')
  .action((name: string, options: { target?: string; lines: string }) => {
    run(() => {
      const booth = requireOpen(name, options.target);
      process.stdout.write(capturePane(booth.target, booth.name, Number(options.lines)));
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
      process.exit(execInteractive(booth.target, ['tmux', 'attach', '-t', `=${booth.name}`]));
    });
  });

program
  .command('close')
  .description('Send /exit to the booth command, then kill the session')
  .argument('<name>', 'Booth name')
  .option('-t, --target <target>', 'Target the booth runs on')
  .option('--exit-command <text>', 'Text to send before killing the session', '/exit')
  .option('-w, --wait <seconds>', 'How long to wait for a clean exit', '10')
  .option('-f, --force', 'Kill the session without sending the exit command')
  .action((name: string, options: { target?: string; exitCommand: string; wait: string; force?: boolean }) => {
    run(() => {
      const booth = requireOpen(name, options.target);

      if (!options.force) {
        sendText(booth.target, booth.name, options.exitCommand, true, 150);
        const deadline = Date.now() + Number(options.wait) * 1000;
        while (Date.now() < deadline) {
          if (!hasSession(booth.target, booth.name)) {
            console.log(`${chalk.green('✔')} Closed ${chalk.bold(booth.name)} (exited on '${options.exitCommand}')`);
            return;
          }
          sleepSync(500);
        }
        console.log(chalk.yellow(`⚠ '${options.exitCommand}' did not end the session within ${options.wait}s; killing it.`));
      }

      killSessionSafe(booth.target, booth.name);
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
  if (!hasSession(booth.target, booth.name)) {
    fail(`Booth '${booth.name}' is not open on '${booth.target.name}'. Run \`booth open ${booth.name}\` first.`);
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
