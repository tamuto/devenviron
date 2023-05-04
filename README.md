# DevEnviron

* 共通した開発環境を提供するためのプロジェクト

## 関連プロジェクト

関連するプロジェクトは以下の通り  
それぞれのREADME参照のこと

* [DevEnviron](https://github.com/tamuto/devenviron)
  * dockerコンテナ、コマンドライン用のプロジェクト
  * WindowsやMacでの統一した開発環境、利用しているバージョンの統一などが主目的
* [infodb-cli](https://github.com/tamuto/infodb-cli)
  * 主にnpm補助ツールとしての位置付け
  * package.jsonのスクリプト機能拡充のためのプロジェクト
* [boilerplate](https://github.com/tamuto/boilerplate)
  * プロジェクトテンプレート
  * infodb-cliのinitコマンドにて参照されるプロジェクト

## ドキュメント

* [環境構築](docs/setup.md)
* [コマンド一覧](docs/commands.md)

## イメージ内に含まれるソフトウェア

* 開発言語系
  * python 3.9
  * PHP
  * Java
  * NodeJS
  * Rust
* パッケージマネージャ
  * poetry
  * composer
  * maven
  * npm / pnpm
  * cargo
* その他
  * awscli (with session-manager-plugin)
  * twine
  * python-dotenv
  * build-essential
  * sqlite3
  * terraform
  * git
  * subversion
  * 7z
  * chromium
  * ffmpeg
