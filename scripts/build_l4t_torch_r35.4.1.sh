#!/bin/sh
set -eu

mkdir -p build/resources
cat template/container/Dockerfile.tmpl | sed \
-e "s/{{BASEIMG}}/dustynv\/l4t-pytorch:r35.4.1/" \
-e "s/{{CHROMIUM}}/chromium-browser/" \
-e "s/{{ARCH}}/aarch64/" \
-e "s/{{SSM_ARCH}}/ubuntu_arm64/" > build/Dockerfile

cp template/container/resources/* build/resources/
docker build -t docker.io/tamuto/devenviron:$1 build -f build/Dockerfile
docker tag docker.io/tamuto/devenviron:$1 docker.io/tamuto/devenviron:latest
