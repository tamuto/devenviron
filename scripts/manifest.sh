#!/bin/sh
# ビルド済みイメージからビルドマニフェストを取り出し、リポジトリへ保存する。
#
# 保存したマニフェストをコミットしておくことで、タグ間の差分を
#   git diff manifests/devenviron-2026.08.1.txt manifests/devenviron-2026.09.0.txt
# で確認できる。バージョン固定を行わない方針における変更履歴の代替となる。
#
# 使い方:
#   ./scripts/manifest.sh <image-tag>
set -eu

if [ $# -lt 1 ]; then
    echo "usage: $0 <image-tag>" >&2
    exit 1
fi

image="docker.io/tamuto/devenviron:$1"
outfile="manifests/devenviron-$1.txt"

mkdir -p manifests
docker run --rm --entrypoint cat "$image" /etc/devenviron/manifest.txt > "$outfile"
echo "wrote $outfile"
