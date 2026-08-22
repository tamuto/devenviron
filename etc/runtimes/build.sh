#!/bin/sh
# ランタイムイメージをビルドする。
#
# latestタグは付与しない。ビルド時期によって中身が変わるため、
# latestが指す実体が不定になり環境統一の妨げになる。
#
# 使い方:
#   ./build.sh <folder> <tag>
set -eu

if [ $# -lt 2 ]; then
    echo "usage: $0 <folder> <tag>" >&2
    exit 1
fi

if [ ! -f "$1/Dockerfile" ]; then
    echo "error: $1/Dockerfile が存在しない。" >&2
    exit 1
fi

docker build -t "docker.io/tamuto/$1:$2" . -f "$1/Dockerfile"
