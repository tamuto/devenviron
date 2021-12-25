#!/bin/sh
podman build -t tamuto/devenviron:$1 container -f container/Dockerfile
podman tag tamuto/devenviron:$1 tamuto/devenviron:latest
