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
- **Serena MCP** … セマンティックなコード検索・編集ツールを提供する MCP サーバ。
  ユーザスコープで登録済みのため、追加の設定なしに利用できる。

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

### 2. イメージをビルドする

```bash
docker compose build
```

このイメージはレジストリへ公開していない。各利用者が手元でビルドして使う。
環境の実体はベースイメージ `tamuto/devenviron` 側で固定されているため、
誰がいつビルドしても同じ開発環境になる。

### 3. 初回のログインとワークスペース信頼の承認

remote-control のサーバモードは、ログイン済みでないと起動時にエラーで終了する。
またワークスペースの信頼を一度承認しておく必要がある。
いずれも対話操作が必要なため、初回のみ通常のセッションを起動して済ませる。

```bash
docker compose run --rm denv-cc-remote claude
```

起動したら以下を行う。

1. ワークスペースの信頼を確認するダイアログを承認する
2. `/login` を実行し、ブラウザでサインインする
3. `/exit` で終了する

認証情報は名前付きボリューム `claude-config`（`/root/.claude`）に保存されるため、
次回以降このやり取りは不要になる。

### 4. 常駐させる

```bash
docker compose up -d
```

`claude remote-control` がサーバモードで起動し、接続を待ち受ける。
セッションURLはログで確認できる。

```bash
docker compose logs -f
```

### 5. 接続する

[claude.ai/code](https://claude.ai/code) またはスマートフォンの Claude アプリから、
セッション一覧に表示されるセッションを開く。

### 停止

```bash
docker compose down
```

名前付きボリュームは残るため、認証情報は保持される。

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

イメージに同梱済みで、Claude Code へユーザスコープで登録してある。
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

登録内容を確認・変更したい場合は以下。

```bash
docker compose exec denv-cc-remote claude mcp list
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

## サーバモードの主なオプション

`docker-compose.yaml` の `command` で指定できる。

| オプション | 説明 |
| --- | --- |
| `--name "<名前>"` | claude.ai のセッション一覧に表示される名前を指定する |
| `--spawn worktree` | セッションごとに git worktree を分ける。gitリポジトリが必要 |
| `--spawn session` | 単一セッションのみ受け付ける |
| `--capacity <N>` | 同時セッション数の上限。既定は32 |
| `--continue` | 前回のサーバが扱っていたセッションを復帰させる |
| `--verbose` | 接続とセッションのログを詳細に出力する |
