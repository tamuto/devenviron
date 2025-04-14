#!/bin/bash
set -eu

mkdir -p .devcontainer/denv
mkdir -p .devcontainer/denv/.ssh
mkdir -p .devcontainer/denv/.aws
mkdir -p .devcontainer/denv/.config

touch .devcontainer/denv/.aws/config
touch .devcontainer/denv/.aws/credentials
touch .devcontainer/denv/.gitconfig
touch .devcontainer/denv/.git-credentials
touch .devcontainer/denv/.npmrc

wget -P .devcontainer --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/devcontainer.json

wget -P /usr/local/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvdb8
wget -P /usr/local/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvtime
ln -s /usr/local/bin/denvdb8 /usr/local/bin/denvdb
chmod +x /usr/local/bin/denv*
