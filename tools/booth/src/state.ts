import type { Booth, Config, Target } from './config.js';
import { DockerError, runExec } from './docker.js';
import { hasSession, sleepSync } from './session.js';

/**
 * `claude agents --json` の 1 件。
 * status は claude 側の値をそのまま持つ。既知は idle / busy / waiting / shell だが、
 * 将来増える可能性があるので文字列のまま扱い、未知の値で落ちないようにする。
 */
export interface AgentRecord {
  pid: number;
  cwd: string;
  kind?: string;
  name?: string;
  sessionId?: string;
  startedAt?: number;
  status?: string;
  waitingFor?: string;
}

/**
 * booth の状態。3 段階に分かれる。
 *
 *   absent   … tmux セッションが無い
 *   starting … tmux はあるがセッション記録がまだ無い。起動途中か、
 *              ログイン画面・信頼ダイアログで止まっている
 *   ready    … 起動完了。status が付く
 *   unknown  … claude agents --json が使えない (claude 以外を起こしている等)
 */
export type Phase = 'absent' | 'starting' | 'ready' | 'unknown';

export interface BoothState {
  phase: Phase;
  status?: string;
  waitingFor?: string;
  agent?: AgentRecord;
  /** phase === 'starting' で、止まっている理由が判明した場合。 */
  blockedOn?: 'login' | 'trust';
  /** phase === 'unknown' の理由。 */
  note?: string;
}

/** 待ち合わせの結果。 */
export type Settled = 'idle' | 'waiting' | 'busy' | 'gone' | 'timeout' | 'unknown';

export const EXIT = {
  ok: 0,
  error: 1,
  busy: 10,
  waiting: 11,
  blocked: 12,
  absent: 13,
} as const;

const IDLE = 'idle';
const WAITING = 'waiting';

/**
 * コンテナ内の claude にセッション一覧を出させる。
 * ~/.claude/sessions/ を直接読む手もあるが、あのディレクトリは bind mount で
 * 全コンテナに共有されるため、他コンテナの記録まで混ざる。この CLI なら
 * 自コンテナ分だけが返る。
 */
export function listAgents(target: Target): AgentRecord[] | undefined {
  const result = runExec(target, ['claude', 'agents', '--json']);
  if (result.status !== 0) return undefined;

  try {
    const parsed = JSON.parse(result.stdout);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((r): r is AgentRecord => typeof r?.pid === 'number' && typeof r?.cwd === 'string');
  } catch {
    return undefined;
  }
}

export function inspectBooth(booth: Booth): BoothState {
  if (!hasSession(booth.target, booth.session)) return { phase: 'absent' };

  // 状態を報告できるのは claude を起こしている booth だけ。それ以外を
  // セッション一覧に照らすと「まだ起動していない claude」と区別が付かず、
  // 未ログインなどと誤診してしまう。
  if (!runsClaude(booth)) {
    return { phase: 'unknown', note: `command is not claude (${booth.command[0]})` };
  }

  const agents = listAgents(booth.target);
  if (agents === undefined) {
    return { phase: 'unknown', note: 'claude agents --json is unavailable' };
  }

  const agent = agents.find((a) => a.cwd === booth.workdir);
  if (!agent) return { phase: 'starting', blockedOn: diagnoseBlocked(booth) };

  return { phase: 'ready', status: agent.status, waitingFor: agent.waitingFor, agent };
}

function runsClaude(booth: Booth): boolean {
  const executable = booth.command[0] ?? '';
  return executable === 'claude' || executable.endsWith('/claude');
}

/**
 * 起動しきらない理由を claude の設定から判定する。
 * 未ログインならログイン画面、フォルダが未承認なら信頼ダイアログで止まる。
 */
export function diagnoseBlocked(booth: Booth): 'login' | 'trust' | undefined {
  const config = readClaudeConfig(booth.target);
  if (config === undefined) return undefined;

  if (!config.oauthAccount && !hasCredentialsFile(booth.target)) return 'login';
  if (config.projects?.[booth.workdir]?.hasTrustDialogAccepted !== true) return 'trust';
  return undefined;
}

interface ClaudeConfig {
  oauthAccount?: unknown;
  projects?: Record<string, { hasTrustDialogAccepted?: boolean } | undefined>;
}

function readClaudeConfig(target: Target): ClaudeConfig | undefined {
  const result = runExec(target, ['cat', '/root/.claude.json']);
  if (result.status !== 0) return undefined;
  try {
    return JSON.parse(result.stdout) as ClaudeConfig;
  } catch {
    return undefined;
  }
}

function hasCredentialsFile(target: Target): boolean {
  return runExec(target, ['test', '-s', '/root/.claude/.credentials.json']).status === 0;
}

export interface WaitOptions {
  /** 入力を送ってから、反応 (idle から離れること) を待つ時間。 */
  settleMs?: number;
  /** 決着 (idle か waiting) を待つ時間。 */
  timeoutMs: number;
  pollMs?: number;
}

export interface WaitResult {
  settled: Settled;
  state: BoothState;
  /** settleMs の間に一度でも idle 以外になったか。false なら入力が効いていない疑い。 */
  reacted: boolean;
}

/**
 * 決着 (idle か waiting) まで待つ。
 * waiting で止めるのが要点で、呼び出し側はそこで人 (あるいは AI) に判断を返せる。
 */
export function waitForSettled(booth: Booth, options: WaitOptions): WaitResult {
  const pollMs = options.pollMs ?? 1500;
  let state = inspectBooth(booth);

  if (state.phase !== 'ready') {
    return { settled: state.phase === 'absent' ? 'gone' : 'unknown', state, reacted: false };
  }

  // 送った直後はまだ idle のままなので、反応するまで少し猶予を置く。
  let reacted = false;
  const settleDeadline = Date.now() + (options.settleMs ?? 0);
  while (Date.now() < settleDeadline) {
    if (state.status !== IDLE) {
      reacted = true;
      break;
    }
    sleepSync(Math.min(pollMs, Math.max(0, settleDeadline - Date.now())));
    state = inspectBooth(booth);
    if (state.phase !== 'ready') {
      return { settled: state.phase === 'absent' ? 'gone' : 'unknown', state, reacted };
    }
  }
  if (state.status !== IDLE) reacted = true;

  const deadline = Date.now() + options.timeoutMs;
  for (;;) {
    if (state.phase !== 'ready') {
      return { settled: state.phase === 'absent' ? 'gone' : 'unknown', state, reacted };
    }
    if (state.status === WAITING) return { settled: 'waiting', state, reacted };
    if (state.status === IDLE) return { settled: 'idle', state, reacted };
    if (Date.now() >= deadline) return { settled: 'timeout', state, reacted };

    sleepSync(pollMs);
    state = inspectBooth(booth);
  }
}

/**
 * 起動直後の生死を見る。ready になった時点で真、セッションが消えた時点で偽を返し、
 * どちらでもないまま graceMs を過ぎたら真とみなす (信頼ダイアログ待ちなどはここに来る)。
 *
 * 単純な sleep では足りない。`claude --continue` は会話の記録が無いと数秒後に
 * 終了するので、そこまで見届けないと「起動した」と誤って報告してしまう。
 */
export function survivedLaunch(booth: Booth, graceMs: number, pollMs = 500): boolean {
  const deadline = Date.now() + graceMs;
  for (;;) {
    // 先に待つ。作った直後は、死ぬコマンドでもまだセッションが残っている。
    sleepSync(Math.min(pollMs, Math.max(0, deadline - Date.now())));
    if (!hasSession(booth.target, booth.session)) return false;

    // ready まで来ていれば起動は済んでいる。unknown は claude 以外を起こしていて
    // 状態を問い合わせられない場合で、待っても分かることは増えない。
    const phase = inspectBooth(booth).phase;
    if (phase === 'ready' || phase === 'unknown') return true;
    if (Date.now() >= deadline) return true;
  }
}

/** phase 'starting' を抜けて ready になるまで待つ。open の後始末に使う。 */
export function waitForReady(booth: Booth, timeoutMs: number, pollMs = 1000): BoothState {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = inspectBooth(booth);
    if (state.phase !== 'starting') return state;
    if (Date.now() >= deadline) return state;
    sleepSync(pollMs);
  }
}

/** ls 用。cwd を鍵にして status を引けるようにする。 */
export function statusByWorkdir(agents: AgentRecord[] | undefined): Map<string, AgentRecord> {
  const map = new Map<string, AgentRecord>();
  for (const agent of agents ?? []) map.set(agent.cwd, agent);
  return map;
}

export function exitCodeFor(state: BoothState): number {
  switch (state.phase) {
    case 'absent':
      return EXIT.absent;
    case 'starting':
      return EXIT.blocked;
    case 'unknown':
      return EXIT.ok;
    case 'ready':
      if (state.status === WAITING) return EXIT.waiting;
      if (state.status === IDLE || state.status === undefined) return EXIT.ok;
      return EXIT.busy;
  }
}

export function describe(state: BoothState): string {
  switch (state.phase) {
    case 'absent':
      return 'not open';
    case 'unknown':
      return state.note ? `no status (${state.note})` : 'no status';
    case 'starting':
      if (state.blockedOn === 'login') return 'starting · blocked on login';
      if (state.blockedOn === 'trust') return 'starting · blocked on the trust dialog';
      return 'starting';
    case 'ready': {
      const status = state.status ?? 'unknown';
      return state.waitingFor ? `${status} · ${state.waitingFor}` : status;
    }
  }
}

/** DockerError を投げずに状態だけ返したい場面用。 */
export function tryInspect(booth: Booth): BoothState {
  try {
    return inspectBooth(booth);
  } catch (error) {
    if (error instanceof DockerError) return { phase: 'unknown' };
    throw error;
  }
}

export type { Config };
