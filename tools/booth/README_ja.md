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
booth init             # booth.toml の雛形を書き出す
booth targets          # 設定済みのターゲットを表示
booth open myproject   # /workspaces/myproject で myproject というセッションを起こす
booth ls
booth send myproject "テストを流して結果を教えて"   # 完了まで待ち、判断が要れば止まる
booth status myproject
booth logs myproject
booth close myproject
```

## 名前の扱い

booth 名は `workspaces_root` 直下のフォルダ名であり、そのまま tmux のセッション名になります。
`booth open myproject` なら `/workspaces/myproject` で `myproject` というセッションを起こします。
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
# 起動時に --continue を足し、その作業ディレクトリの前回の会話を引き継ぐ。
# 既定は true。毎回まっさらから始めたいなら false。
continue = true

# 1つのコンテナに全 booth を同居させる構成。
[targets.denv]
compose_file = "/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
service = "denv"
# project = "denv-cc-remote"   # 指定すると docker compose -p に渡る

# プロジェクトごとにコンテナを分けている構成なら、service に {name} を書く。
# booth 名と同じ名前のサービスへ exec する。
# [targets.perproject]
# compose_file = "/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
# service = "{name}"

# 上書きしたい booth だけ書けばよい。書かなくても open できる。
[booths.myproject]
target = "denv"
command = "claude --remote-control myproject --add-dir /workspaces/shared"
continue = false
```

どちらの構成でも動きます。`service = "{name}"` なら booth ごとに専用コンテナが対応し、
`booth ls` は起動中のサービスを compose に列挙させて順に問い合わせます（tmux が無いサービスは
自動的に読み飛ばされます）。サービス名が固定なら、1つのコンテナの中に全 booth が並びます。

`compose_file` は相対パスでもよく、その場合は `booth.toml` のあるディレクトリからの相対として解決されます。
`command` は文字列（空白で分割）でも文字列配列でも書けます。tmux 側で1つのシェルコマンドに
連結されるため、引用符を含む複雑なコマンドはラッパースクリプトにしてください。

## 会話の引き継ぎ

`booth open` は既定でコマンドに `--continue` を足します。開き直した booth は、その作業
ディレクトリで前回していた会話をそのまま引き継ぎます。夜に閉じて朝に開き直しても話の続きから
始められる、という状態が既定です。

その作業ディレクトリで初めて開くときは引き継ぐ会話がなく、`claude --continue` は起動せずに
終了します。booth は起動直後にセッションが死んだことを見て、`--continue` 無しで開き直し、
`No conversation to continue; started a fresh one.` と報告します。新規プロジェクトでも
既定のままで困りません。

都度変えたいときは `booth open <name> --no-continue`（設定で切っている場合は `--continue`）、
booth ごとなら `[booths.<name>].continue`、全体なら `[defaults].continue` で指定します。
`command` に既に `-c` / `--continue` / `-r` / `--resume` が書かれていれば booth は二重には
足しません。なお `booth` 自身の `-c` は `--config` なので、引き継ぎの指定は `--continue` と
省略せずに書きます。

## コマンド

| コマンド | 説明 |
| --- | --- |
| `booth init [--force]` | `booth.toml` の雛形をカレントに書き出す |
| `booth targets` | 設定済みターゲットの一覧 |
| `booth open <name> [--restart] [--no-continue] [--no-wait] [--ready-timeout s]` | tmux セッションを作り、実際に使える状態になるまで待つ |
| `booth ls [--target t]` | セッション一覧を状態付きで表示 |
| `booth status <name> [--json] [--pane n] [--wait-for settled]` | 状態を報告し、状態に対応する終了コードで終わる |
| `booth send <name> <text...> [--no-wait] [-w 秒] [--pane n] [-f]` | 1行送り、ターンの完了まで待つ。人の判断が要る状態になったらそこで止める |
| `booth logs <name> [-n lines]` | 現在のペイン内容を表示 |
| `booth attach <name>` | 対話的にアタッチ（`Ctrl-b d` でデタッチ） |
| `booth close <name> [--settle s] [--wait s] [--force]` | ターンの完了を待ち、`/exit` を送ってから落とす |

`open` は、生きているセッションがあれば `--restart` なしでは上書きせず、作業ディレクトリの
存在をコンテナ内で確認し、起動直後にコマンドが死んだ場合は成功と報告せずエラーにします。

## 状態とフィードバック

booth の要点は、コマンドを投げっぱなしにしないことです。待つ系のコマンドは**人の判断が
必要になった時点で止まり**、その旨をペインごと出力します。操作している人（あるいは AI）が
そこで反応できるようにするためです。

状態はコンテナ内の `claude agents --json` から取っており、画面の文字列解析ではありません。
3 段階に分かれます。

| 状態 | 意味 | 終了コード |
| --- | --- | --- |
| `not open` | tmux セッションが無い | 13 |
| `starting` | セッションはあるが claude がまだ登録されていない。起動途中か、ログイン画面・信頼ダイアログで停止（どちらかを booth が判定して伝える） | 12 |
| `idle` | プロンプト待ち。入力を受け付ける | 0 |
| `busy` | ターンを処理中 | 10 |
| `waiting` | 人が答えるべきもので停止。ダイアログや許可プロンプト。`waitingFor` に理由が入る | 11 |
| `no status` | claude 以外を起こしている booth。報告すべき状態が無い | 0 |

`booth send` はターンの完了を待って 0 で終わります。途中でダイアログに入った場合は 11 で
終わり、ペインを表示します。ダイアログが開いている間にテキストを送っても入力欄には届かない
ため、`send` は既定で拒否します（`--force` で強行可）。`booth close` は現在のターンが
終わるのを待ってから `/exit` を送ります。処理中に送った `/exit` は取りこぼされるためです。

```bash
booth send myproject "テストを流して"   # → 0: 完了 · 11: 判断待ち · 10: まだ処理中
booth status myproject --json          # 監視プロセス向けの機械可読な状態
```

## Claude Code 用の skill

`skill/SKILL.md` は、Claude Code のセッションに booth のライフサイクル（open / send / close）と
終了コードの取り決めを教えるものです。**意図的にそこまでで止めています。** booth が何かで止まった
ときは CLI 自身が次に叩くコマンドを出すため、その知識は古くなりうる文書ではなくツール側に置いて
あります。一度だけ配置します。

```bash
mkdir -p ~/.claude/skills/booth
cp "$(pnpm root -g)/@infodb/booth/skill/SKILL.md" ~/.claude/skills/booth/SKILL.md
```

devenviron では `~/.claude` が `.devcontainer/denv/.claude` から bind mount されているため、
1回置けば全コンテナで使えます。

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
