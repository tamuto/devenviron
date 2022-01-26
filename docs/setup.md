# 環境構築

* この手順を実行する前にOS個別の設定を終了させること
  * WindowsはWSL2 + Ubuntu + Podmanのインストール済みであること
  （手順書は[wsl2_podman.md](wsl2_podman.md)を参照のこと）
  * MacはLima + Podmanのインストールが済んでいること
  （手順書は[lima_podman.md](lima_podman.md)を参照のこと）

## Setupシェルの実行

コマンドを実行する。
```
curl https://raw.githubusercontent.com/tamuto/devenviron/main/setup/setup.sh | sh
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
* ~./devenviron/.git-credentials
```
https://id:pass@url
```

## awscliの設定

(後日追記)

## npmrcの設定

(後日追記)
