# DevEnviron

共通した開発環境をコンテナで提供するためのプロジェクト。
メンバー間で同じ構成の環境を再現できることを目的としている。

土台となるベースイメージ`tamuto/devenviron`を1つ用意し、
その上に利用形態ごとの環境を重ねる構成になっている。

## 前提

- dockerが利用できる環境が必要。
- Docker for Desktopなども利用可能ではあるがディスクI/Oが遅いため、できればWSL2+Ubuntuを利用することを推奨する。
- Windowsの場合は、[WSL2+Ubuntu](./docs/setup_windows.md)を参照。
- Macは検証環境がないため現在サポートしていない。

## セットアップ

開発用フォルダを作り、その中でセットアップスクリプトを実行する。

```sh
cd ~/workspaces
curl -H 'Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/setup.sh | sh
```

以下が用意される。

- `.devcontainer/` … devcontainerの定義（`devcontainer.json`と`Dockerfile`）
- `.devcontainer/denv/` … 認証情報と設定の置き場所（後述）
- ホスト側の独自コマンド（`denvdb` / `denvtime`）

以降の起動手順は利用環境ごとに異なる。

## 利用環境

`envs/`配下に、devenvironをベースとした利用環境の定義を置いている。
いずれも同じdevenvironを土台とするため、どこから作業しても同じ環境になる。

| 環境 | 用途 | 起動 |
| --- | --- | --- |
| [`envs/devcontainer/`](./envs/devcontainer/) | VSCodeのdevcontainerで利用する（従来からの方式） | VSCodeの`Reopen in Container` |
| [`envs/denv-cc-remote/`](./envs/denv-cc-remote/) | Claude Codeをremote-controlで動かす。devcontainerを前提とせずdocker composeで起動する | `docker compose up -d`（[手順](./envs/denv-cc-remote/README.md)） |
| [`envs/denv-cdx-remote/`](./envs/denv-cdx-remote/) | Codex standaloneをremote-control daemonとして動かす。pairing codeで接続する | `docker compose up -d`（[手順](./envs/denv-cdx-remote/README.md)） |

レジストリへ公開しているのはベースイメージの`tamuto/devenviron`だけで、
`envs/`配下の各環境は利用者の手元でビルドする。
このためバージョン番号を持つのはベースイメージだけであり、
「どのdevenvironの上に構築されたか」で環境が一意に定まる。

## 認証情報と設定の置き場所

ssh鍵やAWSの認証情報など、各環境で共有するものはホスト側の
`.devcontainer/denv/`に置き、コンテナへbind mountしている。
Codexの認証・セッション・remote-control状態は、設定とは分離して
Dockerのnamed volumeへ保存する。

| 種別 | 対象 |
| --- | --- |
| ディレクトリ | `.ssh` / `.aws` / `.config` |
| ファイル | `.gitconfig` / `.git-credentials` / `.npmrc` |
| Claude Code用 | `.claude` / `.claude.json`（denv-cc-remoteのみ） |
| Codex実行時状態 | `codex-state` named volume（denv-cdx-remoteのみ） |

**bind mountする共通設定は各環境で同じ実体を共有する。**
マウントの一覧は`envs/devcontainer/devcontainer.json`と
各remote環境の`compose.base.yaml`に書かれており、揃えて管理する。
`codex-state`はdenv-cdx-remote専用であり、他の環境とは共有しない。

Codexのプロジェクト固有MCPは`.codex/config.toml`、skillsは`.agents/skills`へ置き、
認証などの実行時状態と混在させない。詳細は
[`denv-cdx-remote`の手順](./envs/denv-cdx-remote/README.md)を参照。

bind mountのソースが存在しないとDockerがそれを**ディレクトリとして作る**。
ファイルであるべきものがディレクトリになると起動できなくなるため、
`setup.sh`を先に実行して正しい型で用意しておくこと。

## 独自コマンド

- devenvironが用意する独自コマンドが存在する。
- [こちら](./docs/commands.md)を参照。

## コンテナ内のシェル環境

- プロンプトのgitブランチ表示やbash補完など、共通のシェル設定を用意している。
- 実体は`/etc/devenviron/bashrc.sh`で、`~/.bashrc`の末尾から読み込まれる。
- 読み込まれるタイミングと、個人の設定を足す方法は[こちら](./docs/shell.md)を参照。

## コンテナ内からのdocker利用

- コンテナ内で`docker`コマンドが使える。ホスト側のデーモンを操作する形になる。
- パスがホスト基準で解釈されるなどの注意点があるため、[こちら](./docs/docker.md)を参照。

## 信頼ストアへ追加している証明書

- `ca-certificates`に未収録のルート証明書を追加している場合がある。
- 現在はJPRSが2026年6月17日以降に発行する証明書のためのクロスルート証明書を追加している。
- 経緯と削除の条件は[こちら](./docs/certificates.md)を参照。

## イメージのビルド

- 適切なイメージが存在しない場合は、自分でビルドする必要がある。
- レジストリへ公開するのはx86向けのみで、Jetson(L4T)向けは実機でビルドする。
- 汎用のaarch64（AWS Gravitonなど）はx86向けと同じスクリプトをそのまま使う。
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
  * docker CLI (docker compose / buildx)
  * awscli (with session-manager-plugin)
  * twine
  * python-dotenv
  * build-essential / cmake / pkg-config
  * sqlite3
  * terraform
  * git / git-lfs
  * subversion
  * 7z / zip / unzip / zstd
  * ffmpeg
  * sox
  * DBクライアント (mysql / psql)
* 基本コマンド

  ベースイメージ(slim)には入らないが、開発時に当然使うものを補っている。

  * procps / psmisc (`ps` `top` `free` `pgrep` `pkill` `watch` `pstree` `killall`)
  * iproute2 / net-tools / dnsutils (`ip` `ss` `netstat` `ifconfig` `dig` `nslookup`)
  * lsof / file / rsync / curl / wget / htop
  * tree / ripgrep (`rg`) / tmux / bash-completion / shellcheck
  * vim-tiny / nano（`vi` は`EDITOR`未設定時のgitのフォールバック先になる）

  エディタはvim-tinyとnanoのみとしている。
  フル版のvimは個人設定に属するものとして入れていない。

### 何を入れて何を入れないか

- **入れる**: 無いと作業が成立しないもの。
  `ps`が無ければプロセスを確認できず、エディタが無ければ
  `git commit`（`-m`なし）や`git rebase -i`がコンテナ内で完結しない。
  調査手段（`ss` / `dig` / `lsof`）も、コンテナ内で完結しないと原因を追えない。
- **入れない**: 個人の好みに属するもの。
  フル版のvimやシェルの入れ替えなどは各自の環境で行う。
  共通イメージへ入れると、好みが違う利用者にとっては容量だけの負担になる。
- **入れない**: 入れても機能しないもの。
  `man-db`はslimベースが`path-exclude`でmanページ本体を除いているため、
  コマンドだけが増えて内容を読めない。

## リポジトリの構成

| パス | 内容 |
| --- | --- |
| [`envs/`](./envs/) | 利用環境の定義。利用者の手元でビルドする |
| [`template/container/`](./template/container/) | ベースイメージのDockerfileテンプレートと同梱リソース |
| [`template/shell/`](./template/shell/) | ホスト側へ配置する独自コマンド |
| [`scripts/`](./scripts/) | ベースイメージのビルドスクリプト |
| [`manifests/`](./manifests/) | ビルド時点の構成の記録 |
| [`runtimes/`](./runtimes/) | 軽量ランタイムイメージ。CI/CDへ提供するための補助的なツール群で、サポート対象の成果物ではない |
| [`docs/`](./docs/) | 各種ドキュメント |
| `setup.sh` | ホスト側のセットアップ |
| `deploy.sh` | ベースイメージの公開 |

`build/`はビルドスクリプトが生成する作業ディレクトリであり、リポジトリでは管理しない。

## 改善課題

未対応の課題および方針は[TODO.md](./TODO.md)にまとめている。
