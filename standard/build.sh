#!/bin/sh
podman build -t docker.io/tamuto/devenviron:$1 container -f container/Dockerfile
podman tag docker.io/tamuto/devenviron:$1 docker.io/tamuto/devenviron:latest
