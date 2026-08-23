#!/bin/sh
set -eu

# ビルド情報。イメージのラベルとマニフェストに記録する。
DENV_REVISION=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
DENV_CREATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 環境別の設定。Jetson固有のwheelを取得するためのpipインデックス。
# ベースイメージがcu128のためcu128のインデックスを指定する。
DENV_PIP_INDEX_URL="https://pypi.jetson-ai-lab.io/jp6/cu128"

# 前回のビルド成果物を持ち越さない。
# 残しておくとresourcesへの追記が重複するなどの事故になる。
rm -rf build
mkdir -p build/resources
# アーキテクチャ依存の取得物はDockerfile側でビルド時に解決するため、
# ここで置き換えるのはベースイメージだけでよい。
sed -e "s|{{BASEIMG}}|dustynv/pytorch:2.7-r36.4.0-cu128-24.04|" template/container/Dockerfile.tmpl > build/Dockerfile

# certs/ のようなサブディレクトリを含むため -r が要る。
cp -r template/container/resources/* build/resources/
docker build \
    --build-arg DENV_VERSION="$1" \
    --build-arg DENV_REVISION="$DENV_REVISION" \
    --build-arg DENV_CREATED="$DENV_CREATED" \
    --build-arg DENV_PIP_INDEX_URL="$DENV_PIP_INDEX_URL" \
    --network host -t docker.io/tamuto/devenviron:$1 build -f build/Dockerfile

# ビルド時点の構成をmanifests/へ記録する
./scripts/manifest.sh "$1"
