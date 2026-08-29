import { spawnSync } from 'child_process';
import type { Target } from './config.js';

export class DockerError extends Error {}

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function composeArgs(target: Target): string[] {
  const args = ['compose', '-f', target.composeFile];
  if (target.project) args.push('-p', target.project);
  return args;
}

/**
 * docker compose exec -T <service> <command...> を実行して出力を返す。
 * argv をそのまま渡すのでシェルの引用は介在しない。
 */
export function runExec(target: Target, command: string[]): RunResult {
  const argv = [...composeArgs(target), 'exec', '-T', target.service, ...command];
  const result = spawnSync('docker', argv, { encoding: 'utf8' });

  if (result.error) {
    const err = result.error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new DockerError('`docker` command not found in PATH.');
    }
    throw new DockerError(`Failed to run docker: ${err.message}`);
  }

  const stderr = result.stderr ?? '';
  // 停止中と未定義のサービスは compose がどちらも同じ文言で返す。
  // test -d の 1 と混ざらないよう、ここで文言を見て潰しておく。
  if (result.status !== 0 && /is not running/.test(stderr)) {
    throw new DockerError(
      `Service '${target.service}' is not running.\n` +
        `  Start it with: docker compose -f ${target.composeFile} up -d ${target.service}`
    );
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr,
  };
}

export function runTmux(target: Target, args: string[]): RunResult {
  return runExec(target, ['tmux', ...args]);
}

/** 失敗したら stderr を添えて投げる版。 */
export function runTmuxOrThrow(target: Target, args: string[]): string {
  const result = runTmux(target, args);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new DockerError(`tmux ${args[0] ?? ''} failed on '${target.name}': ${detail}`);
  }
  return result.stdout;
}

/** 起動中のサービス名を compose に問い合わせる。service = "{name}" の展開に使う。 */
export function listRunningServices(target: Target): string[] {
  const argv = [...composeArgs(target), 'ps', '--services', '--status', 'running'];
  const result = spawnSync('docker', argv, { encoding: 'utf8' });

  if (result.error) {
    const err = result.error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new DockerError('`docker` command not found in PATH.');
    }
    throw new DockerError(`Failed to run docker: ${err.message}`);
  }
  if (result.status !== 0) {
    throw new DockerError(`docker compose ps failed: ${(result.stderr ?? '').trim()}`);
  }

  return (result.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** attach のように TTY が要るものは -T を外し、標準入出力をそのまま繋ぐ。 */
export function execInteractive(target: Target, command: string[]): number {
  const argv = [...composeArgs(target), 'exec', target.service, ...command];
  const result = spawnSync('docker', argv, { stdio: 'inherit' });

  if (result.error) {
    const err = result.error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new DockerError('`docker` command not found in PATH.');
    }
    throw new DockerError(`Failed to run docker: ${err.message}`);
  }

  return result.status ?? 1;
}
