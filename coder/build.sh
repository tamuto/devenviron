#!/bin/sh
docker build -t tamuto/devenviron:coder-$1 .
docker push tamuto/devenviron:coder-$1
