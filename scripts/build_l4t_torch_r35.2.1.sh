#!/bin/sh
set -eu

mkdir -p build/resources
cat template/container/Dockerfile.tmpl | \
sed -e "s/{{BASEIMG}}/nvcr.io\/nvidia\/l4t-pytorch:r35.2.1-pth2.0-py3/" -e "s/{{CHROMIUM}}/chromium-browser/" -e "s/{{ARCH}}/aarch64/" > build/Dockerfile

cp template/container/resources/* build/resources/
${2:-podman} build -t docker.io/tamuto/devenviron:$1 build -f build/Dockerfile
${2:-podman} tag docker.io/tamuto/devenviron:$1 docker.io/tamuto/devenviron:latest
