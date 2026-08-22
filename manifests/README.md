# ビルドマニフェスト

各イメージタグのビルド時点で、実際に導入されていたソフトウェアのバージョン記録。

DevEnvironは開発環境であるため「常に最新を導入する」方針を採っており、
ソフトウェアのバージョン固定は行わない。
そのため、あるタグに何が入っているかは**ビルドした時点の状況で決まる**。
その情報を失わないように、ビルドのたびにここへ記録を残す。

この仕組みは「一度pushしたイメージタグは上書きしない」という
タグ不変ポリシーとセットで機能する。同じタグの中身が変わり得るなら、
記録を残しても意味を持たないため。

## 生成方法

ビルドスクリプトの実行時に自動生成される。手動で取り出す場合は以下。

```bash
./scripts/manifest.sh <image-tag>
```

## 差分の確認

タグ間で何のバージョンが上がったのかは、そのままdiffで確認できる。

```bash
git diff --no-index manifests/devenviron-0.41.0.txt manifests/devenviron-0.42.0.txt
```

## コンテナ内からの確認

イメージ自体にも同じ内容が埋め込まれている。

```bash
cat /etc/devenviron/manifest.txt
```

## イメージのラベル

`docker inspect` でも素性を確認できる。

```bash
docker inspect --format '{{json .Config.Labels}}' docker.io/tamuto/devenviron:<tag>
```
