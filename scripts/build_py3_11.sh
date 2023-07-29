#!/bin/sh
set -eu

mkdir -p build/resources
cat template/container/Dockerfile.tmpl | sed \
-e "s/{{BASEIMG}}/python:3.11-slim-bullseye/" \
-e "s/{{CHROMIUM}}/chromium/" \
-e "s/{{ARCH}}/x86_64/" \
-e "s/{{SSM_ARCH}}/ubuntu_64bit/" > build/Dockerfile

cp template/container/resources/* build/resources/
${2:-podman} build -t docker.io/tamuto/devenviron:$1 build -f build/Dockerfile
${2:-podman} tag docker.io/tamuto/devenviron:$1 docker.io/tamuto/devenviron:latest
