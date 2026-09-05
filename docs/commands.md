# 独自コマンド一覧

## 外部コマンド

- devenvironをインストールしたホストOS上で実行できるコマンド

### denvdb / denvdb8

```bash
denvdb
```

- mysqlを起動するコマンド
- denvdbはdenvdb8へのシンボリックリンク
- 以下のオプションでdocker起動

```bash
#!/bin/bash
docker run \
    -d --restart always \
    --name mysql8 \
    -p3306:3306 \
    -e MYSQL_ROOT_PASSWORD=password \
    -v ~/.mysql_data8:/var/lib/mysql \
    mysql:8 \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_unicode_ci
```

### denvtime

```
denvtime
```

- WSLのホストとの時間を同期するコマンド
- 特にスクリーンセーバから復帰後にWSL上のUbuntuとホストの時間がずれる問題を解決するために利用する

### booth

```bash
pnpx @infodb/booth open <name>
```

- docker compose のサービス上に tmux セッションを作り、その中で
  `claude --remote-control <name>`（Remote Control を有効にした対話セッション）を起動するコマンド
- 起動後もコマンドは動き続け、`send` で入力を送り、`logs` で画面を読み、`attach` で入り、
  `close` で `/exit` を送ってから終了させる
- `send` はターンの完了まで待ち、**人の判断が必要な状態になったらそこで止めて報告する**。
  状態は `claude agents --json` から取得しており、終了コードでも区別できる
  (0=完了/待機可、10=処理中、11=判断待ち、12=起動できていない、13=未起動)
- booth 名は `/workspaces` 直下のフォルダ名。tmux のセッション名では `.` と `:` が `_` に
  置き換わる (`repo.branch` → `repo_branch`) が、booth のコマンドには元の名前を渡す
- `open` は既定で `--continue` を足し、その作業ディレクトリの前回の会話を引き継ぐ。
  まっさらから始めたいときは `--no-continue`、設定なら `[defaults].continue = false`
- 実体は `docker compose exec <service> tmux ...` であり、状態はコンテナ内の tmux が持つ
- 設定は `booth.toml`。`booth init` で雛形を書き出せる
- `key` で tmux のキー名 (Enter / Escape / Up …) を送れる。ダイアログはテキストでは答えられないため
- Claude Code に booth を操作させるための skill を同梱している
  (`tools/booth/skill/SKILL.md` を `~/.claude/skills/booth/` へ置く)
- 詳細は [`tools/booth/`](../tools/booth/README_ja.md) を参照

```bash
pnpx @infodb/booth init            # booth.toml の雛形
pnpx @infodb/booth ls              # セッション一覧 (状態付き)
pnpx @infodb/booth status myproj   # idle / busy / waiting を報告
pnpx @infodb/booth send myproj "テストを流して"
pnpx @infodb/booth close myproj    # /exit を送って終了
```

## 内部コマンド

- devenvironのコンテナ内で実行できるコマンド

### ssh-aws.sh

```bash
ssh-aws.sh <profile> <instance-name> [remote-command]
```

- AWSのEC2インスタンスに名前でSSM経由でSSH接続するコマンド
- .aws/credentialsに記載されたprofileを利用するため、事前にAWS CLIの設定が必要
- また、.ssh/configには以下のような設定が必要
- なお、ssh-keyはEC2インスタンスに登録されているものを利用する

```
Host ec2-instance
    User ec2-user
    IdentityFile ~/.ssh/id_rsa
```

### ssh-fw-aws.sh

```bash
ssh-fw-aws.sh <profile> <instance-name> <forward-port> [remote-command]
```

- ポートフォワード機能付きのssh-aws.shコマンド
- ポート指定は、sshの指定と同様に`13306:localhost:3306`のように指定する
- その他はssh-aws.shと同様でssh-aws.shコマンドが正常に動くことが前提となる
