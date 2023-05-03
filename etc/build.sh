#!/bin/sh
set -eu

mkdir -p build/resources
echo {\"BASEIMG\": \"${2:-"python:3.9-slim-bullseye"}\"} > build/base.json
infodb-cli template -t ./template/container/Dockerfile.tmpl -i build/base.json -o build/Dockerfile
rm build/base.json

copy template/container/resources build/resources
# ${3:-podman} build -t docker.io/tamuto/devenviron:$1 build -f build/Dockerfile
# ${3:-podman} tag docker.io/tamuto/devenviron:$1 docker.io/tamuto/devenviron:latest
