#!/bin/sh
set -eu

# ビルド情報。イメージのラベルとマニフェストに記録する。
DENV_REVISION=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
DENV_CREATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)

mkdir -p build/resources
cat template/container/Dockerfile.tmpl | sed \
-e "s/{{BASEIMG}}/dustynv\/l4t-pytorch:r35.4.1/" \
-e "s/{{ARCH}}/aarch64/" \
-e "s/{{SSM_ARCH}}/ubuntu_arm64/" > build/Dockerfile

cp template/container/resources/* build/resources/
docker build \
    --build-arg DENV_VERSION="$1" \
    --build-arg DENV_REVISION="$DENV_REVISION" \
    --build-arg DENV_CREATED="$DENV_CREATED" \
    -t docker.io/tamuto/devenviron:$1 build -f build/Dockerfile

# ビルド時点の構成をmanifests/へ記録する
./scripts/manifest.sh "$1"
