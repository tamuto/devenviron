# @infodb/booth

**booth**（docker compose サービス上の tmux セッション）を開き、その中で対話型コマンド
（主に `claude`）を起動する CLI です。

`booth open` が返ったあともコマンドは動き続けます。以降は `booth send` で話しかけ、
`booth logs` で読み、`booth attach` で座り、`booth close` で閉じます。close は
`/exit` を送ってからセッションを落とします。

すべて `docker compose exec <service> tmux ...` 経由で動くため、booth 自身は状態を持ちません。
真実はコンテナ内の tmux サーバだけにあります。

## 実行方法

インストールは不要で、`pnpx` が公開済みパッケージを取ってきます。

```bash
pnpx @infodb/booth ls
```

常用するならエイリアスかグローバルインストールを。

```bash
alias booth='pnpx @infodb/booth'
# または
pnpm add -g @infodb/booth
```

booth は `docker compose` を叩くため、compose プロジェクトを操作できる側で動かす必要があります。
ホスト、または devenviron のコンテナ内（docker socket が bind mount されており node も入っている）
のどちらでも構いません。以下の例では `booth` が上記いずれかの形で解決される前提で書いています。

## クイックスタート

```bash
booth init          # booth.toml の雛形を書き出す
booth targets       # 設定済みのターゲットを表示
booth open allesc   # tmux new-session -d -s allesc -c /workspaces/allesc claude --remote-control allesc
booth ls
booth send allesc "テストを流して結果を教えて"
booth logs allesc
booth close allesc
```

## 名前の扱い

booth 名は `workspaces_root` 直下のフォルダ名であり、そのまま tmux のセッション名になります。
`booth open allesc` なら `/workspaces/allesc` で `allesc` というセッションを起こします。
フォルダ名はワークスペース内で一意なので、セッション名の衝突も起きません。

## 設定

`booth.toml` を次の順に探します。

1. `--config <path>`
2. `$BOOTH_CONFIG`
3. カレントディレクトリから親へ辿った `booth.toml`
4. `~/.config/booth/booth.toml`

いずれも見つからない場合、`init` 以外のコマンドはエラー終了（exit 1）します。ターゲットを
推測して勝手に何かを起動することはありません。`booth init` は同梱の
[`booth.example.toml`](./booth.example.toml) をカレントに書き出します。

```toml
[defaults]
# --target を省略したときのターゲット。targets が1つだけなら省略可。
target = "denv"
# booth 名はこの下のフォルダ名として解釈される (= tmux のセッション名)。
workspaces_root = "/workspaces"
# tmux 内で起動するコマンド。{name} と {workdir} が展開される。
# --remote-control は Remote Control を有効にした「対話セッション」を起こす。
# サーバモード (claude remote-control サブコマンド) ではない。
command = "claude --remote-control {name}"

# プロジェクトごとに compose のサービスを分けている構成。
# service の {name} は booth 名に展開される。
[targets.denv]
compose_file = "/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
service = "{name}"
# project = "denv-cc-remote"   # 指定すると docker compose -p に渡る

# 1つのコンテナに全 booth を同居させる構成なら、サービス名を固定で書く。
# [targets.shared]
# compose_file = "/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
# service = "denv"

# 上書きしたい booth だけ書けばよい。書かなくても open できる。
[booths.allesc]
target = "denv"
command = "claude --remote-control allesc --add-dir /workspaces/shared"
```

どちらの構成でも動きます。`service = "{name}"` なら booth ごとに専用コンテナが対応し、
`booth ls` は起動中のサービスを compose に列挙させて順に問い合わせます（tmux が無いサービスは
自動的に読み飛ばされます）。サービス名が固定なら、1つのコンテナの中に全 booth が並びます。

`compose_file` は相対パスでもよく、その場合は `booth.toml` のあるディレクトリからの相対として解決されます。
`command` は文字列（空白で分割）でも文字列配列でも書けます。tmux 側で1つのシェルコマンドに
連結されるため、引用符を含む複雑なコマンドはラッパースクリプトにしてください。

## コマンド

| コマンド | 説明 |
| --- | --- |
| `booth init [--force]` | `booth.toml` の雛形をカレントに書き出す |
| `booth targets` | 設定済みターゲットの一覧 |
| `booth open <name> [--target t] [--restart]` | tmux セッションを作りコマンドを起動 |
| `booth ls [--target t]` | セッション一覧（ターゲット / 名前 / 実行中コマンド / 稼働時間 / attach 状況） |
| `booth send <name> <text...> [--no-enter] [--delay ms]` | セッションに1行送る |
| `booth logs <name> [-n lines]` | 現在のペイン内容を表示 |
| `booth attach <name>` | 対話的にアタッチ（`Ctrl-b d` でデタッチ） |
| `booth close <name> [--exit-command t] [--wait s] [--force]` | `/exit` を送ってから落とす |

`open` は、生きているセッションがあれば `--restart` なしでは上書きせず、作業ディレクトリの
存在をコンテナ内で確認し、起動直後にコマンドが死んだ場合は成功と報告せずエラーにします。

## コンテナ側の前提

サービスには `tmux` が入っていること、そしてサービス自体が起動し続けることが必要です。
対話型コマンドは compose の `command:` ではなく booth が起動するため、claude を
メインプロセスにしていたサービスはこう変わります。

```yaml
services:
  denv:
    image: denv-cc-remote:local
    command: ["sleep", "infinity"]
```

## ライセンス

MIT
