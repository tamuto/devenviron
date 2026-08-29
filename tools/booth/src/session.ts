import type { Booth, Target } from './config.js';
import { runExec, runTmux, runTmuxOrThrow } from './docker.js';

export interface SessionInfo {
  target: string;
  service: string;
  name: string;
  created: Date;
  windows: number;
  attached: boolean;
  command: string;
}

const LIST_FORMAT = '#{session_name}\t#{session_created}\t#{session_windows}\t#{session_attached}';
const PANE_FORMAT = '#{session_name}\t#{pane_current_command}';

/** ペインを対象に取る tmux コマンド用のターゲット指定。`=` は完全一致の意味。 */
function paneTarget(name: string): string {
  return `=${name}:`;
}

export function hasSession(target: Target, name: string): boolean {
  // has-session はセッションが無いと exit 1 になる。tmux サーバ未起動でも同様。
  return runTmux(target, ['has-session', '-t', `=${name}`]).status === 0;
}

/** tmux の -c は存在しないディレクトリを渡されると黙って無視されるので先に確かめる。 */
export function directoryExists(target: Target, dir: string): boolean {
  return runExec(target, ['test', '-d', dir]).status === 0;
}

/** tmux セッションを detached で作り、その中で booth のコマンドを起動する。 */
export function createSession(booth: Booth): void {
  runTmuxOrThrow(booth.target, [
    'new-session',
    '-d',
    '-s',
    booth.name,
    '-c',
    booth.workdir,
    ...booth.command,
  ]);
}

/**
 * 起動直後に死んでいないかを見る。コマンドが見つからない等の失敗は
 * new-session 自体は成功したまま、セッションだけが消える形で現れる。
 */
export function survivedStartup(target: Target, name: string, graceMs = 500): boolean {
  sleepSync(graceMs);
  return hasSession(target, name);
}

export function listSessions(target: Target): SessionInfo[] {
  const listed = runTmux(target, ['list-sessions', '-F', LIST_FORMAT]);
  // セッションが1つも無いときの `no server running` は空リストとして扱う。
  if (listed.status !== 0) return [];

  const panes = new Map<string, string>();
  const paneResult = runTmux(target, ['list-panes', '-a', '-F', PANE_FORMAT]);
  if (paneResult.status === 0) {
    for (const line of splitLines(paneResult.stdout)) {
      const [session, command] = line.split('\t');
      if (session && command && !panes.has(session)) panes.set(session, command);
    }
  }

  return splitLines(listed.stdout).map((line) => {
    const [name, created, windows, attached] = line.split('\t');
    return {
      target: target.name,
      service: target.service,
      name: name ?? '',
      created: new Date(Number(created) * 1000),
      windows: Number(windows) || 0,
      attached: attached === '1',
      command: panes.get(name ?? '') ?? '-',
    };
  });
}

/** テキストを1行として送る。キー名として解釈されないよう -l を使う。 */
export function sendText(target: Target, name: string, text: string, enter: boolean, delayMs: number): void {
  runTmuxOrThrow(target, ['send-keys', '-t', paneTarget(name), '-l', '--', text]);
  if (!enter) return;
  // TUI が入力を取り込む前に Enter が届くと取りこぼすので少し待つ。
  sleepSync(delayMs);
  runTmuxOrThrow(target, ['send-keys', '-t', paneTarget(name), 'Enter']);
}

export function capturePane(target: Target, name: string, lines: number): string {
  const out = runTmuxOrThrow(target, [
    'capture-pane',
    '-p',
    '-t',
    paneTarget(name),
    '-S',
    `-${lines}`,
  ]);
  // ペイン下端の空行までは読んでも仕方ないので落とす。
  return `${out.replace(/\s+$/, '')}\n`;
}

export function killSession(target: Target, name: string): void {
  runTmuxOrThrow(target, ['kill-session', '-t', `=${name}`]);
}

export function sleepSync(ms: number): void {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function splitLines(out: string): string[] {
  return out.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0);
}

/** 既に消えているセッションを kill しても失敗にはしない。 */
export function killSessionSafe(target: Target, name: string): void {
  if (!hasSession(target, name)) return;
  killSession(target, name);
}
