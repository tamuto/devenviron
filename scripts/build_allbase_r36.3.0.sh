#!/bin/sh
# allbase系のJetson向けイメージをビルドする。
#
# 現時点では未使用である。ベースの allbase:l4t-r36.3.0 を
# 将来バージョンアップした際の受け皿として残している。
# 実際に使う前に、DENV_PIP_INDEX_URL が実機のCUDAと一致するか、
# ベースのpythonが利用するツールの要件を満たすかを確認すること。
set -eu

# ビルド情報。イメージのラベルとマニフェストに記録する。
DENV_REVISION=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
DENV_CREATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 環境別の設定。Jetson固有のwheelを取得するためのpipインデックス。
# 実機のCUDAバージョンに合わせること。jp6配下にcu126とcu128があり、cu122は存在しない。
DENV_PIP_INDEX_URL="https://pypi.jetson-ai-lab.io/jp6/cu126"

# 前回のビルド成果物を持ち越さない。
# 残しておくとresourcesへの追記が重複するなどの事故になる。
rm -rf build
mkdir -p build/resources
# アーキテクチャ依存の取得物はDockerfile側でビルド時に解決するため、
# ここで置き換えるのはベースイメージだけでよい。
sed -e "s|{{BASEIMG}}|allbase:l4t-r36.3.0|" template/container/Dockerfile.tmpl > build/Dockerfile

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
