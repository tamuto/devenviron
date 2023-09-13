# DevEnviron

- 共通した開発環境を提供するためのプロジェクト
- devcontainerを利用してVSCodeへの開発環境の提供を想定している

## セットアップ

- dockerが利用できる環境が必要。
- Docker for Desktopなども利用可能ではあるがディスクI/Oが遅いため、できればWSL2+Ubuntuを利用することを推奨する。
- Windowsの場合は、[WSL2+Ubuntu](./docs/setup_windows.md)を参照。
- 【後日記載】Macの場合は、Lima+Ubuntu

## イメージ内に含まれるソフトウェア

将来的にはdevcontainerのfeaturesへの移行を行いたい。

* 開発言語系
  * python 3.11
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
