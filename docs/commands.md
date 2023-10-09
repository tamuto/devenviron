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
