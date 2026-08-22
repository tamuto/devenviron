# denv-cc-remote

Claude Code を remote-control で動かすための環境。

devenviron をベースイメージとした派生イメージであり、
VSCode の devcontainer と同じ土台の上で動く。
どちらから作業しても同じ環境になるよう、
ベースイメージのバージョンは `envs/devcontainer/Dockerfile` と一致させている。

**devcontainer は前提としない。** セットアップ手順も devenviron 本体とは別系統となる。
このフォルダ一式（`Dockerfile` と `docker-compose.yaml`）を配布すれば、
各利用者が同じ環境を再現できる。

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

### 2. イメージを取得またはビルドする

```bash
docker compose pull    # 公開イメージを利用する場合
docker compose build   # 手元でビルドする場合
```

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

### バージョンについて

Claude Code のネイティブインストーラは
バックグラウンドで自動更新するため、バージョンは固定していない。
「常に最新を導入する」という本プロジェクトの方針とも一致する。

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
