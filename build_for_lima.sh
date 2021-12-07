#!/bin/sh
docker build -t tamuto/devenviron:$1 container -f container/Dockerfile.lima
docker tag tamuto/devenviron:$1 tamuto/devenviron:latest
