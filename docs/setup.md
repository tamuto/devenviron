# 環境構築

* この手順を実行する前にOS個別の設定を終了させること
  * WindowsはWSL2 + Ubuntu + Podmanのインストール済みであること
  （手順書は[wsl2_podman.md](wsl2_podman.md)を参照のこと）
  * MacはLima + Podmanのインストールが済んでいること
  （手順書は[lima_podman.md](lima_podman.md)を参照のこと）

## Setupシェルの実行

コマンドを実行する。
```
curl -H 'Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/scripts/setup.sh | sh
```

上記コマンドを実行すると以下のことが行われる。
* tamuto/devenviron:latestのダウンロード
* ~/.devenvironフォルダの整備
* ~/binへ必要なコマンドのインストール

## gitの設定

現時点では、コマンドラインからの設定ができないため、以下のファイルを編集する。
* ~/.devenviron/.gitconfig
```
[user]
  email = <your email>
  name = <your name>
[credential]
  helper = store
```
* ~/.devenviron/.git-credentials
```
https://id:pass@url
```

## awsの設定

現時点では、コマンドラインからの設定ができないため、以下のファイルを編集する。
* ~/.devenviron/.awsconfig
```
[default]
region = <your region>
output = json
```
* ~/.devenviron/.aws-credentials
```
[default]
aws_access_key_id = <your key>
aws_secret_access_key = <your secret key>

[switch-role if needed]
source_profile = default
role_arn = arn:aws:iam::<your numbers>:role/<your role>
```

## npmrcの設定

* ~/.devenviron/.npmrc

(後日追記)

## sshの設定

`~/.devenviron/.ssh/`フォルダを作成する。
その他必要なファイルを格納する。
