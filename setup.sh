#!/bin/bash
set -eu

mkdir -p .devcontainer/denv
mkdir -p .devcontainer/denv/.ssh
mkdir -p .devcontainer/denv/.aws

touch .devcontainer/denv/.aws/config
touch .devcontainer/denv/.aws/credentials
touch .devcontainer/denv/.gitconfig
touch .devcontainer/denv/.git-credentials
touch .devcontainer/denv/.npmrc

wget -P .devcontainer --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/devcontainer.json


mkdir -p ~/bin
rm -f ~/bin/denv*
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvdb8
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvtime
ln -s ~/bin/denvdb8 ~/bin/denvdb

chmod +x ~/bin/denv*
