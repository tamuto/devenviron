#!/bin/sh
docker build -t tamuto/devenviron:$1 .
docker tag tamuto/devenviron:$1 tamuto/devenviron:latest
docker push tamuto/devenviron:$1
docker push tamuto/devenviron:latest
