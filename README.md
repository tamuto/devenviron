# DevEnviron

- 共通した開発環境を提供するためのプロジェクト
- devcontainerを利用してVSCodeへの開発環境の提供を想定している

## セットアップ

- dockerが利用できる環境が必要。
- Docker for Desktopなども利用可能ではあるがディスクI/Oが遅いため、できればWSL2+Ubuntuを利用することを推奨する。
- Windowsの場合は、[WSL2+Ubuntu](./docs/setup_windows.md)を参照。
- Macは検証環境がないため現在サポートしていない。

## 独自コマンド

- devenvironが用意する独自コマンドが存在する。
- [こちら](./docs/commands.md)を参照。

## イメージのビルド

- 適切なイメージが存在しない場合は、自分でビルドする必要がある。
- [こちら](./docs/rebuild.md)を参照。

## イメージ内に含まれるソフトウェア

開発環境であるため、**ソフトウェアのバージョン固定は行わず常に最新を導入する**方針を採っている。
そのため、あるイメージタグに何がどのバージョンで入っているかは
ビルドした時点の状況で決まる。その記録は以下で確認できる。

- リポジトリ: [`manifests/`](./manifests/) 配下のタグごとのファイル
- コンテナ内: `cat /etc/devenviron/manifest.txt`

詳細は[manifests/README.md](./manifests/README.md)を参照。

主に以下を含む。（正確な構成は上記マニフェストを参照すること）

* 開発言語系
  * python（ベースイメージのバージョンに準ずる）
  * node / pnpm（voltaで導入）
* パッケージマネージャ
  * poetry
  * uv
* その他
  * awscli (with session-manager-plugin)
  * twine
  * python-dotenv
  * build-essential
  * sqlite3
  * terraform
  * git / git-lfs
  * subversion
  * 7z
  * ffmpeg
  * sox

将来的にはdevcontainerのfeaturesへの移行を行いたい。

## 改善課題

未対応の課題および方針は[TODO.md](./TODO.md)にまとめている。
