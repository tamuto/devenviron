#!/bin/sh
set -eu

mkdir -p build/resources
sed "s/{{BASEIMG}}/python:3.9-slim-bullseye/" template/container/Dockerfile.tmpl > build/Dockerfile

cp template/container/resources/* build/resources/
${2:-podman} build -t docker.io/tamuto/devenviron:$1 build -f build/Dockerfile
${2:-podman} tag docker.io/tamuto/devenviron:$1 docker.io/tamuto/devenviron:latest
