# denv-cdx-remote

Codex standalone の app-server を remote-control として常駐させる環境。
devenviron をベースに、VSCode devcontainer や `denv-cc-remote` と同じ開発ツール・
認証情報を利用できるようにしている。ポート公開は不要で、接続には Codex の
`remote-control pair` が発行する短時間有効なコードを使う。

## 同梱しているもの

- **Codex standalone** … 公式installerで導入。remote-controlを含む。
- **Serena** … セマンティックなコード検索・編集を提供するMCP server。

Codex本体、プロジェクト設定、実行時の状態は次のように分離する。

| 対象 | 保存場所 |
| --- | --- |
| standalone本体 | イメージ内の`/root/.codex/packages` |
| 環境共通MCP | イメージ内の`/etc/codex/config.toml` |
| プロジェクト固有MCP | 各リポジトリの`.codex/config.toml` |
| プロジェクト固有skills | 各リポジトリの`.agents/skills` |
| 認証・セッション・remote-control状態 | `codex-state` named volume |

実行時は`CODEX_HOME=/var/lib/codex`としている。`codex-state`には認証、チャット、
remote-controlのenrollmentなど、Codexが管理する状態だけが保存される。
MCPやskillsを永続化するために`/root/.codex`全体をbind mountすることはしない。

## 前提

- DockerとDocker Composeが利用できること
- Codexを利用できるChatGPTアカウント
- `WORKSPACES_ROOT`以下に開発対象のリポジトリがあること

## セットアップ

### 1. ワークスペースと共通設定を用意する

未指定時の`WORKSPACES_ROOT`は`/root/workspaces`。

```bash
export WORKSPACES_ROOT=/root/workspaces
denv=$WORKSPACES_ROOT/.devcontainer/denv

mkdir -p $denv/.ssh $denv/.aws $denv/.config
touch $denv/.gitconfig $denv/.git-credentials $denv/.npmrc
```

devenvironの`setup.sh`を実行済みなら、これらは作成済みになる。
Codex用のホストディレクトリを事前作成する必要はない。

### 2. Compose定義を作る

```bash
cp docker-compose.yaml.sample docker-compose.yaml
```

`working_dir`は新規セッションの開始位置として使いたいプロジェクトへ変更できる。
ワークスペース全体は常に`/workspaces`へmountされる。

Codexのremote-controlは共有app-serverなので、Claude Code版のように
プロジェクトごとのサービスを並べない。同じ`codex-state`に対して
複数のremote-controlを起動すると、control socketや状態更新が競合する。

### 3. イメージをビルドする

```bash
docker compose build
```

Jetsonでbuild中の名前解決に失敗する場合は次のようにする。

```bash
DENV_BUILD_NETWORK=host docker compose build
```

### 4. Codexへログインする

初回だけdevice authenticationを行う。

```bash
docker compose run --rm codex codex login --device-auth
docker compose run --rm codex codex login status
```

認証情報は`codex-state`へ保存される。対話UIからログインしたい場合は、代わりに
次を実行する。

```bash
docker compose run --rm codex codex
```

### 5. プロジェクト設定を追加する（任意）

環境共通のSerenaはイメージ側で登録済み。確認は次のコマンドで行う。

```bash
docker compose run --rm codex codex mcp list
```

プロジェクト固有のMCPは、対象リポジトリの`.codex/config.toml`へ追加する。
Codexは信頼済みプロジェクトの設定だけを読み込む。

```toml
[mcp_servers.project_tool]
command = "project-tool"
args = ["mcp"]
env_vars = ["PROJECT_TOOL_TOKEN"]
```

HTTP MCPのtokenも値をcommitせず、環境変数名だけを設定する。

```toml
[mcp_servers.project_api]
url = "https://example.com/mcp"
bearer_token_env_var = "PROJECT_API_TOKEN"
```

プロジェクト固有のskillは`.agents/skills/<skill-name>/SKILL.md`、
Codexへのリポジトリ共通指示は`AGENTS.md`へ置く。これらはリポジトリへcommitし、
チームとremote-controlで同じ設定を利用する。

### 6. remote-controlを起動する

```bash
docker compose up -d
docker compose logs -f
```

コンテナのメインプロセスとして`codex remote-control`をフォアグラウンドで動かす。
Docker Composeが直接監視し、`docker compose down`の停止シグナルも直接届く。

### 7. ペアリングする

remote-control起動後に、短時間有効なpairing codeを発行する。

```bash
docker compose exec codex codex remote-control pair
```

表示されたcodeをCodexクライアントのRemote control pairing画面へ入力する。
期限が切れた場合は同じコマンドで再発行できる。pairingが
`enrollment completes`まで利用できないと表示された場合は、起動直後なので
少し待って再実行する。接続状態は次でも確認できる。

```bash
docker compose exec codex codex doctor
```

## 日常操作

```bash
# 状態とログ
docker compose ps
docker compose logs -f

# pairing codeの再発行
docker compose exec codex codex remote-control pair

# 停止
docker compose down
```

Codexの恒久的な更新はイメージを再buildして行う。
コンテナ内の`codex update`で更新したstandalone packageは、コンテナを作り直すと
イメージ内のバージョンへ戻る。

## 注意事項

### 1つのcodex-stateにつきremote-controlは1つ

`codex-state`にはremote-controlのcontrol socket、enrollment、チャット状態も保存される。
このCompose環境を起動している間は、同じvolumeを使う別コンテナから
`codex remote-control`を実行しない。

別プロセスが必要なら、Composeプロジェクトごとに異なるvolumeを用意する。
通常の`docker compose down`ではvolumeは残るが、`docker compose down -v`を実行すると
認証・ペアリング・ローカルチャットも削除される。

### 設定の配置

環境共通設定は`config.toml`をDockerfileから`/etc/codex/config.toml`へ配置している。
Serenaをすべてのプロジェクトから利用できるのはこの設定による。

プロジェクト固有MCPを`codex mcp add`でユーザー設定へ追加すると、
`codex-state`内の設定に閉じてリポジトリから再現できなくなる。
共有すべきMCPは`.codex/config.toml`を直接編集する。

### コンテナ内からのDocker利用

ホストの`/var/run/docker.sock`をmountしているため、コンテナ内のDocker CLIは
ホストdaemonを操作する。`-v`のパスはホスト基準であり、`/workspaces`に対応する
ホスト側パスは`$DENV_HOST_WORKSPACES`で参照できる。

詳細と権限上の注意は[docs/docker.md](../../docs/docker.md)を参照。

### Codexの公開仕様について

standaloneの導入方法は
[OpenAI公式のCodex CLIドキュメント](https://developers.openai.com/codex/cli/)に従っている。
プロジェクト設定、MCP、skills、認証については次を参照する。

- [Config basics](https://developers.openai.com/codex/config-basic)
- [MCP](https://developers.openai.com/codex/mcp)
- [Build skills](https://developers.openai.com/codex/skills)
- [Authentication](https://developers.openai.com/codex/auth)

`remote-control`は現時点でCLI上もexperimental扱いであり、引数やpairing手順が
変わる可能性がある。挙動が変わった場合は、まず次のhelpを確認する。

```bash
codex remote-control --help
codex remote-control pair --help
```
