#!/bin/sh
docker build -t tamuto/devenviron:base container -f container/Dockerfile.base
docker build -t tamuto/devenviron:lima-$1 container -f container/Dockerfile.lima
docker tag tamuto/devenviron:lima-$1 tamuto/devenviron:lima-latest
# docker tag tamuto/devenviron:$1 tamuto/devenviron:latest
# docker push tamuto/devenviron:$1
# docker push tamuto/devenviron:latest
