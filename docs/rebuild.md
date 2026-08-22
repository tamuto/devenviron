# Dockerイメージのビルド

- ./scriptsの下にビルド用のコマンドが用意されているため、こちらをカスタマイズして利用する。
- スクリプトの基本的な内容としては、Dockerfile内の文字を置き換えてビルドを行っている。
- ベースイメージおよびアーキテクチャを置き換えるなどのカスタマイズが可能。

## ビルドの実行

```bash
./script/build_py3_11.sh <image-tag>
```

## デプロイ

- 権限を持っている場合に実行可能

```bash
./deploy.sh <image-tag>
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
