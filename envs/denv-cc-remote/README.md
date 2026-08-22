# denv-cc-remote

Claude Code を remote-control で動かすための環境。

devenviron をベースイメージとした派生イメージであり、
VSCode の devcontainer と同じ土台の上で動く。
どちらから作業しても同じ環境になるよう、
ベースイメージのバージョンは `envs/devcontainer/Dockerfile` と一致させている。

**devcontainer は前提としない。** セットアップ手順も devenviron 本体とは別系統となる。
このフォルダ一式（`Dockerfile` と `docker-compose.yaml`）を配布すれば、
各利用者が同じ環境を再現できる。

**このイメージ自体はレジストリへ公開しない。** バージョン番号も持たない。
環境の実体はベースイメージ側で固定されているため、
`Dockerfile` の `FROM` が指す devenviron のバージョンだけで環境が一意に定まる。

## 同梱しているもの

- **Claude Code** … ネイティブインストーラで導入。バックグラウンドで自動更新される。
- **Serena** … セマンティックなコード検索・編集ツールを提供する MCP サーバ。
  ツール本体のみ同梱している。MCP としての登録はセットアップ手順5で行う。

## 前提

- Docker および Docker Compose が利用できること
- Claude Code を利用できるプラン（Pro / Max / Team / Enterprise / Console）のアカウント
  - 無料プランでは Claude Code を利用できない
- Team / Enterprise の場合、管理者が Remote Control を有効化していること

## セットアップ

### 1. ワークスペースの場所を指定する

`WORKSPACES_ROOT` に開発用フォルダのパスを指定する。未指定時は `/root/workspaces`。

```bash
export WORKSPACES_ROOT=/root/workspaces
```

### 2. 設定の置き場所をホスト側に用意する

Claude Code の設定と認証情報はホスト側へ保存する。
**bind mount するファイルが存在しないと Docker がディレクトリを作ってしまう**ため、
先に実体を作っておくこと。

```bash
mkdir -p $WORKSPACES_ROOT/.devcontainer/denv/.claude
[ -s $WORKSPACES_ROOT/.devcontainer/denv/.claude.json ] \
  || echo '{}' > $WORKSPACES_ROOT/.devcontainer/denv/.claude.json
```

`.claude.json` は空ファイルだと JSON として不正になるため `{}` で初期化する。

devenviron の `setup.sh` を実行済みであれば、この2つは作成されている。

### 3. イメージをビルドする

```bash
docker compose build
```

このイメージはレジストリへ公開していない。各利用者が手元でビルドして使う。
環境の実体はベースイメージ `tamuto/devenviron` 側で固定されているため、
誰がいつビルドしても同じ開発環境になる。

### 4. 初回のログインとワークスペース信頼の承認

remote-control のサーバモードは、ログイン済みでないと起動時にエラーで終了する。
またワークスペースの信頼を一度承認しておく必要がある。
いずれも対話操作が必要なため、初回のみ通常のセッションを起動して済ませる。

```bash
PROJECT=myproject docker compose run --rm denv-cc-remote claude
```

起動したら以下を行う。

1. ワークスペースの信頼を確認するダイアログを承認する
2. `/login` を実行し、ブラウザでサインインする
3. `/exit` で終了する

**ログインはアカウント単位で一度だけでよい**が、
**ワークスペースの信頼はディレクトリごとに承認が必要**である。
プロジェクトを増やしたら、そのプロジェクトを指定して同じ手順を一度実施すること。

認証情報と組織情報はホスト側の `.devcontainer/denv/.claude` および
`.devcontainer/denv/.claude.json` に保存されるため、次回以降このやり取りは不要になる。

### 5. MCP サーバを登録する

MCP の登録内容はイメージには含めていない。
ログインと同じく初回のみの手作業とし、
**利用者が好きな MCP を自由に入れられる**ようにしてある。

登録内容はホスト側の `.claude.json` に保存されるため、
一度登録すればコンテナを作り直しても残る。

**`--scope user` で登録すれば全プロジェクトで有効になる。**
`.claude.json` はすべてのサービスが同じファイルを bind mount しているため、
どのプロジェクトのコンテナからでも同じ MCP が使える。
プロジェクトごとに登録し直す必要はない。

同梱している Serena を登録する場合は以下。

```bash
docker compose run --rm denv-cc-remote \
  claude mcp add --scope user serena -- \
  serena start-mcp-server --context claude-code --project-from-cwd
```

任意の MCP を追加する場合も同じ要領で登録できる。

```bash
docker compose run --rm denv-cc-remote \
  claude mcp add --scope user <name> -- npx -y <package>
```

登録済みの一覧は以下で確認できる。

```bash
docker compose run --rm denv-cc-remote claude mcp list
```

**注意**: 永続化されるのは登録内容であってツール本体ではない。
コンテナ内で `uv tool install` や `npm install -g` を実行しても
`/root/.local` は永続化していないため、コンテナを作り直すと消える。
`npx -y <package>` や `uvx <package>` のように
起動のたびにコマンドが解決される形であれば問題なく使える。
常設したいツールがある場合は `Dockerfile` に追加する。

### 6. 常駐させる

```bash
docker compose up -d
```

`claude remote-control` がサーバモードで起動し、接続を待ち受ける。
セッションURLはログで確認できる。

```bash
docker compose logs -f
```

### 7. 接続する

[claude.ai/code](https://claude.ai/code) またはスマートフォンの Claude アプリから、
セッション一覧に表示されるセッションを開く。

### 停止

```bash
docker compose down
```

認証情報はホスト側に保存されているため保持される。

## 注意事項

### 設定してはいけない環境変数

remote-control は機能フラグの評価結果に依存しているため、
以下を設定すると利用できなくなる。

- `DISABLE_TELEMETRY`
- `DO_NOT_TRACK`
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
- `DISABLE_GROWTHBOOK`

また `ANTHROPIC_BASE_URL` を `api.anthropic.com` 以外へ向けている場合も利用できない。
Amazon Bedrock / Google Cloud's Agent Platform / Microsoft Foundry 経由でも利用できない。

### ポート公開は不要

remote-control は claude.ai への外向き接続で成立する。
コンテナ側で待ち受けるポートはないため、ポートの公開設定は不要。

### Serena MCP について

ツール本体のみイメージに同梱している。
**MCP としての登録は利用者が行う**（セットアップ手順5）。

イメージ側で登録しないのは、ユーザスコープの MCP 登録先が `~/.claude.json` であり、
このファイルを組織情報の永続化のためホスト側から bind mount しているためである。
イメージへ焼き込んでも覆い隠されて効かない。
また登録内容を利用者が自由に決められる方が都合がよい。

接続状態は Claude Code 内で `/mcp` を実行すると確認できる。

```
serena start-mcp-server --context claude-code --project-from-cwd
```

`--project-from-cwd` により、起動時のカレントディレクトリが対象プロジェクトになる。
コンテナの作業ディレクトリは `/workspaces` である。

初回利用時は対象言語の language server を取得するため、起動に時間がかかることがある。
このため `MCP_TIMEOUT=60000` を設定してある。
取得したものとプロジェクトのインデックスは名前付きボリューム `serena-data`
（`/root/.serena`）に保存されるため、次回以降は速くなる。

登録内容を確認したい場合は以下。

```bash
docker compose exec denv-cc-remote claude mcp list
docker compose exec denv-cc-remote claude mcp get serena
```

### バージョンについて

**このイメージ自身はバージョン番号を持たない。**
基準となるのは `Dockerfile` の `FROM` が指す devenviron のバージョンだけである。
派生イメージ側にも番号を振ると、どちらがどの環境を指すのか読み取れなくなるため。

Claude Code のネイティブインストーラは
バックグラウンドで自動更新するため、バージョンは固定していない。
「常に最新を導入する」という本プロジェクトの方針とも一致する。

Serena は自動更新されないため、ビルドした時期によってバージョンが変わる。
利用者間で揃える必要が生じた場合は、`Dockerfile` で
`serena-agent==<version>` のように指定すればよい。

このためこのイメージにビルドマニフェストは用意していない。
記録が必要な構成はベースイメージ側が `/etc/devenviron/manifest.txt` に持つ。

```bash
docker compose exec denv-cc-remote cat /etc/devenviron/manifest.txt
```

## トラブルシューティング

### `Unable to determine your organization for Remote Control eligibility`

ログインには成功しているのに remote-control が起動できない場合、
**`~/.claude.json` が永続化されていない**ことが原因である可能性が高い。

Claude Code は認証トークンを `~/.claude/.credentials.json` に、
組織情報（`oauthAccount`）と Remote Control の可否判定に使う機能フラグのキャッシュを
`~/.claude.json` に、それぞれ別々に保存する。
後者が失われると、トークンはあるのに組織が判定できない状態になる。

以下を確認する。

```bash
# ホスト側に実体があるか。ディレクトリになっていたら誤り
ls -la $WORKSPACES_ROOT/.devcontainer/denv/.claude.json

# コンテナ内から中身が見えているか
docker compose exec denv-cc-remote sh -c 'ls -la /root/.claude.json; wc -c /root/.claude.json'
```

`.claude.json` が 0 バイトのままであれば、セットアップ手順4のログインをやり直す。

なお以下を設定していると、機能フラグの評価自体が止まって同様に利用できなくなる。

- `DISABLE_TELEMETRY` / `DO_NOT_TRACK`
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` / `DISABLE_GROWTHBOOK`
- `ANTHROPIC_BASE_URL` を `api.anthropic.com` 以外へ向けている

### MCP サーバが認識されない

まず登録されているかを確認する。

```bash
docker compose exec denv-cc-remote claude mcp list
```

何も出てこない場合はセットアップ手順5を実施していない。

登録したのに残らない場合は、`.claude.json` の永続化が効いていない。
ユーザスコープの登録内容はこのファイルに保存されるため、
永続化されていないとコンテナを作り直すたびに消える。

```bash
# ホスト側。ディレクトリになっていたら誤り。{} だけなら未登録
cat $WORKSPACES_ROOT/.devcontainer/denv/.claude.json | head -c 200

# コンテナ内から同じ内容が見えているか
docker compose exec denv-cc-remote head -c 200 /root/.claude.json
```

MCP は登録されているが起動に失敗する場合は、
そのコマンドがコンテナ内で解決できるかを確認する。

```bash
docker compose exec denv-cc-remote which serena
```

`/root/.local` は永続化していないため、
コンテナ内で後から `uv tool install` や `npm install -g` で入れたツールは
コンテナを作り直すと消える。常設したいものは `Dockerfile` に追加すること。

## 複数プロジェクトを扱う

**remote-control のサーバは 1 つにつき 1 ディレクトリしか扱えない。**
`--spawn same-dir`（既定）では、スマホや claude.ai から新規セッションを作っても
すべてサーバの作業ディレクトリで動く。サブフォルダが列挙されることはない。

そのため `/workspaces` のような「リポジトリの親ディレクトリ」で1つだけ起動しても、
プロジェクトごとのセッションにはならない。
公式ドキュメントにも
「The startup trust dialog never saves trust for your home directory,
so start Remote Control from a project directory.」とあり、
プロジェクトディレクトリから起動することが前提になっている。

### プロジェクトごとにサービスを定義する

**サービス 1 つにつきコンテナが 1 つ起動する。**
3 つ定義すれば `claude remote-control` が 3 プロセス並行で動くため、
常用するものだけ定義するとよい。

`docker-compose.yaml` に YAML アンカーを用意してあるので、
共通設定を書き写す必要はない。

```yaml
services:
  myproject:
    <<: *denv-cc-remote
    container_name: denv-cc-myproject
    working_dir: /workspaces/myproject
    command: ["claude", "remote-control", "--name", "myproject", "--spawn", "session"]

  another:
    <<: *denv-cc-remote
    container_name: denv-cc-another
    working_dir: /workspaces/another
    command: ["claude", "remote-control", "--name", "another", "--spawn", "session"]
```

```bash
docker compose up -d
```

これで claude.ai のセッション一覧に `myproject` と `another` が並び、
それぞれからセッションを開始できる。

`--spawn session` は「1 コンテナ = 1 プロジェクト = 1 セッション」で、
従来の CLI と同じ感覚で扱える。まずはこの形を勧める。

### 1プロジェクト内で並行作業する

サーバモードは 1 プロセスで複数セッションを扱える（既定の上限は32、`--capacity`）。
ただし既定の `--spawn same-dir` では**全セッションが同じディレクトリを共有する**ため、
同じファイルを編集すると競合する。

`--spawn worktree` にすると、各セッションを Claude Code が自動で
[git worktree](https://code.claude.com/docs/en/worktrees) へ切り出す。
**フォルダを事前に分けておく必要はない。**
worktree はリポジトリルートの `.claude/worktrees/<name>/` に、
`worktree-<name>` ブランチで作られる。

導入前に知っておくべき点。

- worktree は fresh checkout のため `node_modules` や `.venv` は無く、
  セッションごとに入れ直しが必要になる
- `.env` のような gitignore されたファイルも来ない。
  リポジトリルートに `.worktreeinclude` を置くと自動コピーできる
- `.claude/worktrees/` は `.gitignore` に入れておくこと

段差があるため、並行作業が必要になってから切り替えれば十分である。

## サーバモードの主なオプション

`docker-compose.yaml` の `command` で指定できる。

| オプション | 説明 |
| --- | --- |
| `--name "<名前>"` | claude.ai のセッション一覧に表示される名前を指定する |
| `--remote-control-session-name-prefix <接頭辞>` | 自動生成名の接頭辞。既定はホスト名で `myhost-graceful-unicorn` のような名前になる。環境変数 `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX` でも同じ |
| `--spawn worktree` | セッションごとに git worktree を分ける。gitリポジトリが必要 |
| `--spawn session` | 単一セッションのみ受け付ける |
| `--capacity <N>` | 同時セッション数の上限。既定は32 |
| `--continue` | 前回のサーバが扱っていたセッションを復帰させる |
| `--verbose` | 接続とセッションのログを詳細に出力する |
