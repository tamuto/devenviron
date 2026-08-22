#!/bin/sh
# ビルド済みイメージをDocker Hubへpushする。
#
# 一度pushしたイメージタグは上書きしない方針のため、
# レジストリに既に存在するタグへのpushは既定で拒否する。
# 中身を変える場合は必ず新しいタグを発行すること。
# メンバー間の環境統一は「同じタグ = 同じイメージ」で担保している。
#
# 使い方:
#   ./deploy.sh <image-tag>
#   ./deploy.sh --force <image-tag>   # 既存タグの上書きを許可（原則使用しない）
set -eu

force=0
if [ "${1:-}" = "--force" ]; then
    force=1
    shift
fi

if [ $# -lt 1 ]; then
    echo "usage: $0 [--force] <image-tag>" >&2
    exit 1
fi

tag=$1
image="docker.io/tamuto/devenviron:$tag"
manifest="manifests/devenviron-$tag.txt"

# latestタグはマルチアーキ構成で別アーキのイメージを上書きするため使用しない
if [ "$tag" = "latest" ]; then
    echo "error: latestタグは使用しない。バージョンタグを指定すること。" >&2
    exit 1
fi

# ローカルにイメージが存在するか
if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "error: $image がローカルに存在しない。先にビルドすること。" >&2
    exit 1
fi

# ビルドマニフェストが記録されているか
# バージョン固定を行わない方針のため、この記録が唯一の変更履歴となる
if [ ! -f "$manifest" ]; then
    echo "error: $manifest が存在しない。" >&2
    echo "       ./scripts/manifest.sh $tag で生成し、コミットしてからpushすること。" >&2
    exit 1
fi

# レジストリに同名タグが既に存在しないか（タグ不変ポリシー）
if docker manifest inspect "$image" >/dev/null 2>&1; then
    if [ "$force" -eq 0 ]; then
        echo "error: $image は既にレジストリに存在する。" >&2
        echo "       一度pushしたタグは上書きしないため、新しいタグを発行すること。" >&2
        exit 1
    fi
    echo "warning: --force指定のため既存タグを上書きする: $image" >&2
fi

docker push "$image"
echo "pushed $image"
