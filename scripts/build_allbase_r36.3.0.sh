#!/bin/sh
set -eu

mkdir -p build/resources
cat template/container/Dockerfile.tmpl | sed \
-e "s/{{BASEIMG}}/allbase:l4t-r36.3.0/" \
-e "s/{{ARCH}}/aarch64/" \
-e "s/{{SSM_ARCH}}/ubuntu_arm64/" > build/Dockerfile

cp template/container/resources/* build/resources/
docker build --network host -t docker.io/tamuto/devenviron:$1 build -f build/Dockerfile
