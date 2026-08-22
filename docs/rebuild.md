# Dockerイメージのビルド

- ./scriptsの下にビルド用のコマンドが用意されているため、こちらをカスタマイズして利用する。
- スクリプトの基本的な内容としては、Dockerfile内の文字を置き換えてビルドを行っている。
- ベースイメージおよびアーキテクチャを置き換えるなどのカスタマイズが可能。

**イメージのビルドはローカル実行に統一している。CIによるビルドは採用していない。**
Jetson(L4T)系のイメージは実機でのビルドが前提でCI環境では再現できず、
x86系だけをCI化するとビルド経路が二系統に分かれて管理が破綻するため。
この他の方針については[TODO.md](../TODO.md)の「0. 前提方針」を参照。

## ビルドの実行

```bash
./scripts/build_py3_13.sh <image-tag>
```

## イメージの系統

現在2系統を併走させている。バージョン体系が異なるため取り違えないこと。

| 系統 | イメージ名 | バージョン体系 | 用途 |
| --- | --- | --- | --- |
| 既存 | `tamuto/devenviron` | SemVer（例 `0.41.0`） | VSCodeのdevcontainerを前提とした開発環境 |
| 新規 | `tamuto/denv-cc-remote` | CalVer（例 `2026.08.0`） | Claude Codeをremote-controlで動かす環境 |

新系統がCalVerを採るのは、「常に最新を導入する」方針では
イメージの中身が実質ビルド時期で決まるためである。
`2026.08.0`という番号自体が「2026年8月時点の最新構成」を表すことになり、方針と意味が一致する。
`<patch>`は同一月内に再ビルドした場合の区別に使う。

**本ドキュメントのビルド・リリース手順は既存系統（`tamuto/devenviron`）を対象とする。**
新系統はdevcontainerを前提とせず、セットアップ手順そのものが別系統となるため、
実装時に別途ドキュメントを用意する。

## タグの運用ルール

- **一度pushしたイメージタグは上書きしない。**
  中身を変える場合は必ず新しいタグを発行する。
  メンバー間の環境統一は「同じタグ = 同じイメージ」で担保しているため。
- **`latest`タグは使用しない。**
  マルチアーキ構成のため、別アーキのイメージが既存の`latest`を上書きする事故が起きる。
  またタグ不変ポリシーとも本質的に相容れない。

`deploy.sh`はこれらを機械的にチェックし、違反する場合はpushせずに停止する。

## リリース手順

権限を持っている場合に実行可能。

### 1. イメージをビルドする

```bash
./scripts/build_py3_13.sh 0.42.0
```

### 2. ビルドマニフェストをコミットする

ビルド時に`manifests/devenviron-0.42.0.txt`が自動生成される。
バージョン固定を行わない方針のため、この記録が実質的な唯一の変更履歴となる。

```bash
git add manifests/devenviron-0.42.0.txt
git commit -m "0.42.0のビルドマニフェストを追加"
```

### 3. Docker Hubへpushする

```bash
./deploy.sh 0.42.0
```

以下をすべて満たさない場合はpushせずに停止する。

- ローカルに対象イメージが存在すること
- `manifests/devenviron-<image-tag>.txt` が存在すること
- レジストリに同名タグが**存在しないこと**（タグ不変ポリシー）

やむを得ず上書きする場合のみ`./deploy.sh --force 0.42.0`を使う。原則使用しない。

### 4. 配布するバージョンを更新する

devenviron を土台とする派生イメージ側の`FROM`を、新しいタグへ書き換える。
**両方を必ず同じバージョンに揃えること。**
VSCode から作業しても remote-control から作業しても同じ環境になることを、
これで担保している。

- `envs/devcontainer/Dockerfile` … VSCode devcontainer 用
- `envs/denv-cc-remote/Dockerfile` … remote-control 用

```dockerfile
FROM tamuto/devenviron:0.42.0
```

**この2ファイル以外にバージョン番号を書かないこと。**
README・TODO.md・その他ドキュメントには記載しない。
過去に複数箇所へ記載した結果、実際に乖離が発生している。

### 5. リポジトリにタグを打つ

イメージタグとgitタグを一致させ、
「そのイメージがどのコミットの定義から作られたか」を追えるようにする。
イメージ側にも`org.opencontainers.image.revision`としてコミットハッシュが記録されている。

```bash
git commit -am "配布バージョンを0.42.0へ更新"
git tag v0.42.0
git push && git push --tags
```

## ビルドマニフェスト

DevEnvironは「常に最新を導入する」方針のため、ソフトウェアのバージョン固定を行わない。
そのため、あるタグに何が入っているかは**ビルドした時点の状況で決まる**。
その情報を失わないよう、ビルド時点の構成を記録している。

### 記録先

- イメージ内: `/etc/devenviron/manifest.txt`
- リポジトリ: `manifests/devenviron-<image-tag>.txt` （ビルドスクリプトが自動生成）

記録内容は、OS情報・主要ツールチェインのバージョン・pipパッケージ一覧・aptパッケージ一覧。

### 確認方法

```bash
# コンテナ内から
cat /etc/devenviron/manifest.txt

# タグ間の差分（何のバージョンが上がったか）
git diff --no-index manifests/devenviron-0.41.0.txt manifests/devenviron-0.42.0.txt

# イメージのラベル（バージョン・コミット・ベースイメージ・ビルド日時）
docker inspect --format '{{json .Config.Labels}}' docker.io/tamuto/devenviron:<image-tag>
```

### 手動での取り出し

```bash
./scripts/manifest.sh <image-tag>
```

生成された `manifests/` 配下のファイルは、ビルドのたびにコミットすること。
この記録は「一度pushしたイメージタグは上書きしない」というタグ不変ポリシーと
セットで機能する。
