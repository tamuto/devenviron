import fs from 'fs';
import os from 'os';
import path from 'path';
import { parse as parseToml } from 'smol-toml';

/**
 * docker compose exec の実行先。
 * service は {name} を含められる。プロジェクトごとにサービスを分けている compose なら
 * service = "{name}"、1つのコンテナに全 booth を同居させるなら固定名を書く。
 */
export interface Target {
  name: string;
  composeFile: string;
  /** {name} 展開後のサービス名。 */
  service: string;
  /** 設定に書かれたままのサービス名。{name} を含みうる。 */
  serviceTemplate: string;
  /** docker compose -p の値。省略時は compose_file のディレクトリ名が使われる。 */
  project?: string;
}

/** tmux セッション1つ分の定義。セッション名 = booth 名 = フォルダ名。 */
export interface Booth {
  name: string;
  target: Target;
  /** tmux に渡す argv。{name} / {workdir} は展開済み。 */
  command: string[];
  workdir: string;
}

export interface Config {
  path: string;
  workspacesRoot: string;
  defaultTarget?: string;
  defaultCommand: string[];
  targets: Map<string, Target>;
  booths: Map<string, BoothSpec>;
}

interface BoothSpec {
  target?: string;
  command?: string[];
  workdir?: string;
}

const DEFAULT_WORKSPACES_ROOT = '/workspaces';
const DEFAULT_COMMAND = ['claude'];

export class ConfigError extends Error {}

/**
 * 設定ファイルを探す。優先順は --config、$BOOTH_CONFIG、カレントから上に辿った
 * booth.toml、最後に ~/.config/booth/booth.toml。
 */
export function findConfigPath(explicit?: string): string {
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new ConfigError(`Config file not found: ${explicit}`);
    }
    return path.resolve(explicit);
  }

  const fromEnv = process.env.BOOTH_CONFIG;
  if (fromEnv) {
    if (!fs.existsSync(fromEnv)) {
      throw new ConfigError(`Config file not found (BOOTH_CONFIG): ${fromEnv}`);
    }
    return path.resolve(fromEnv);
  }

  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, 'booth.toml');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const userConfig = path.join(os.homedir(), '.config', 'booth', 'booth.toml');
  if (fs.existsSync(userConfig)) return userConfig;

  throw new ConfigError(
    'No booth.toml found. Run `booth init` to create one, or pass --config <path>.'
  );
}

export function loadConfig(explicit?: string): Config {
  const configPath = findConfigPath(explicit);

  let raw: unknown;
  try {
    raw = parseToml(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new ConfigError(
      `Failed to parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const root = asTable(raw, 'config root');
  const defaults = root.defaults ? asTable(root.defaults, '[defaults]') : {};

  const targets = new Map<string, Target>();
  const targetTable = root.targets ? asTable(root.targets, '[targets]') : {};
  for (const [name, value] of Object.entries(targetTable)) {
    const t = asTable(value, `[targets.${name}]`);
    const composeFile = requireString(t.compose_file, `[targets.${name}].compose_file`);
    const service = requireString(t.service, `[targets.${name}].service`);
    targets.set(name, {
      name,
      composeFile: path.resolve(path.dirname(configPath), composeFile),
      service,
      serviceTemplate: service,
      project: optionalString(t.project, `[targets.${name}].project`),
    });
  }

  if (targets.size === 0) {
    throw new ConfigError(`${configPath} defines no [targets.*] entries.`);
  }

  const booths = new Map<string, BoothSpec>();
  const boothTable = root.booths ? asTable(root.booths, '[booths]') : {};
  for (const [name, value] of Object.entries(boothTable)) {
    const b = asTable(value, `[booths.${name}]`);
    booths.set(name, {
      target: optionalString(b.target, `[booths.${name}].target`),
      command: optionalCommand(b.command, `[booths.${name}].command`),
      workdir: optionalString(b.workdir, `[booths.${name}].workdir`),
    });
  }

  const defaultTarget = optionalString(defaults.target, '[defaults].target');
  if (defaultTarget && !targets.has(defaultTarget)) {
    throw new ConfigError(`[defaults].target refers to unknown target '${defaultTarget}'.`);
  }

  return {
    path: configPath,
    workspacesRoot:
      optionalString(defaults.workspaces_root, '[defaults].workspaces_root') ??
      DEFAULT_WORKSPACES_ROOT,
    defaultTarget: defaultTarget ?? (targets.size === 1 ? [...targets.keys()][0] : undefined),
    defaultCommand: optionalCommand(defaults.command, '[defaults].command') ?? DEFAULT_COMMAND,
    targets,
    booths,
  };
}

/** booth 名（= フォルダ名 = tmux セッション名）を解決する。 */
export function resolveBooth(config: Config, name: string, targetOverride?: string): Booth {
  validateName(name);

  const spec = config.booths.get(name) ?? {};
  const targetName = targetOverride ?? spec.target ?? config.defaultTarget;
  if (!targetName) {
    throw new ConfigError(
      `No target for booth '${name}'. Set [booths.${name}].target, [defaults].target, or pass --target.`
    );
  }

  const target = config.targets.get(targetName);
  if (!target) {
    throw new ConfigError(`Unknown target '${targetName}'. Known: ${[...config.targets.keys()].join(', ')}`);
  }

  const workdir = spec.workdir ?? path.posix.join(config.workspacesRoot, name);
  const command = (spec.command ?? config.defaultCommand).map((arg) =>
    arg.replaceAll('{name}', name).replaceAll('{workdir}', workdir)
  );

  return { name, target: withService(target, name), command, workdir };
}

/** service テンプレートを booth 名で埋めた実行先を返す。 */
export function withService(target: Target, name: string): Target {
  const service = target.serviceTemplate.replaceAll('{name}', name);
  return service === target.service ? target : { ...target, service };
}

/** サービス名を直接指定して実行先を作る。ls で compose に列挙させたときに使う。 */
export function withServiceName(target: Target, service: string): Target {
  return service === target.service ? target : { ...target, service };
}

/** service がテンプレートなら、対象サービスは compose 側に問い合わせないと分からない。 */
export function hasServiceTemplate(target: Target): boolean {
  return target.serviceTemplate.includes('{name}');
}

/** tmux セッション名として安全で、かつフォルダ名としても妥当な形だけ通す。 */
export function validateName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new ConfigError(
      `Invalid booth name '${name}'. Use letters, digits, dot, underscore and hyphen only.`
    );
  }
}

function asTable(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigError(`${label} must be a table.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  const s = optionalString(value, label);
  if (s === undefined) throw new ConfigError(`${label} is required.`);
  return s;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ConfigError(`${label} must be a string.`);
  return value;
}

/** command は文字列でも配列でも書ける。文字列は空白で分割する。 */
function optionalCommand(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) throw new ConfigError(`${label} must not be empty.`);
    return parts;
  }
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    if (value.length === 0) throw new ConfigError(`${label} must not be empty.`);
    return value as string[];
  }
  throw new ConfigError(`${label} must be a string or an array of strings.`);
}
