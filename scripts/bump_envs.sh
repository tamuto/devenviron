#!/bin/sh
# envs/配下のFROMを指定したバージョンへ揃える。
#
# 「配布するバージョン」を持つのはこの2ファイルだけである。
# 両者が食い違うと、VSCodeから作業した場合とremote-controlから作業した場合とで
# 環境が変わってしまうため、必ず同時に更新する。
#
# deploy.sh がpush成功後に自動で呼ぶ。単独でも実行できる。
#
# 使い方:
#   ./scripts/bump_envs.sh <image-tag>
set -eu

if [ $# -lt 1 ]; then
    echo "usage: $0 <image-tag>" >&2
    exit 1
fi

tag=$1

# latestタグは使用しない方針
if [ "$tag" = "latest" ]; then
    echo "error: latestタグは使用しない。バージョンタグを指定すること。" >&2
    exit 1
fi

files="envs/devcontainer/Dockerfile envs/denv-cc-remote/Dockerfile"

changed=0
for f in $files; do
    if [ ! -f "$f" ]; then
        echo "error: $f が存在しない。リポジトリのルートで実行すること。" >&2
        exit 1
    fi

    current=$(sed -n 's|^FROM tamuto/devenviron:\(.*\)$|\1|p' "$f")
    if [ -z "$current" ]; then
        echo "error: $f に FROM tamuto/devenviron:<tag> の行が見つからない。" >&2
        exit 1
    fi

    if [ "$current" = "$tag" ]; then
        echo "変更なし: $f (既に $tag)"
        continue
    fi

    sed -i "s|^FROM tamuto/devenviron:.*$|FROM tamuto/devenviron:$tag|" "$f"
    echo "更新: $f ($current -> $tag)"
    changed=1
done

# 2ファイルが揃っていることを確認する。ここがズレると環境の統一が崩れる。
for f in $files; do
    v=$(sed -n 's|^FROM tamuto/devenviron:\(.*\)$|\1|p' "$f")
    if [ "$v" != "$tag" ]; then
        echo "error: $f が $tag になっていない ($v)。" >&2
        exit 1
    fi
done

if [ "$changed" -eq 0 ]; then
    exit 0
fi

cat <<MSG

配布するバージョンを $tag へ更新した。コミットしてタグを打つこと。

  git add $files
  git commit -m "配布バージョンを$tagへ更新"
  git tag v$tag
  git push && git push --tags
MSG
