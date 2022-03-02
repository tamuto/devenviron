#!/bin/sh
docker build -t docker.io/tamuto/devenviron:$1 container -f container/Dockerfile
docker tag docker.io/tamuto/devenviron:$1 docker.io/tamuto/devenviron:torch
