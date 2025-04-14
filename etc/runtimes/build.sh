#!/bin/sh
set -eu

docker build -t docker.io/tamuto/$1:$2 . -f $1/Dockerfile
docker tag docker.io/tamuto/$1:$2 docker.io/tamuto/$1:latest
