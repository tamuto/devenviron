#!/bin/sh
# 予め、以下のコマンドで、必要なイメージを作成しておく（インストールするパッケージは変更の可能性あり）
# export L4T_VERSION=36.2.0
# ./build.sh --name=allbase l4t-pytorch transformers llama_cpp:gguf ros:humble-ros-core
set -eu

mkdir -p build/resources
cat template/container/Dockerfile.tmpl | sed \
-e "s/{{BASEIMG}}/allbase:l4t-r36.2.0/" \
-e "s/{{ARCH}}/aarch64/" \
-e "s/{{SSM_ARCH}}/ubuntu_arm64/" > build/Dockerfile

cp template/container/resources/* build/resources/
docker build -t docker.io/tamuto/devenviron:$1 build -f build/Dockerfile
