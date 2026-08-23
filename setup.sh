#!/bin/bash
set -eu

mkdir -p .devcontainer/denv
mkdir -p .devcontainer/denv/.ssh
mkdir -p .devcontainer/denv/.aws
mkdir -p .devcontainer/denv/.config
mkdir -p .devcontainer/denv/.claude

touch .devcontainer/denv/.aws/config
touch .devcontainer/denv/.aws/credentials
touch .devcontainer/denv/.gitconfig
touch .devcontainer/denv/.git-credentials
touch .devcontainer/denv/.npmrc
# 空ファイルはJSONとして不正なため、中身のない場合のみ {} で初期化する
[ -s .devcontainer/denv/.claude.json ] || echo '{}' > .devcontainer/denv/.claude.json

wget -P .devcontainer --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/envs/devcontainer/devcontainer.json
wget -P .devcontainer --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/envs/devcontainer/Dockerfile

wget -P /usr/local/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvdb8
wget -P /usr/local/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvtime
ln -sf /usr/local/bin/denvdb8 /usr/local/bin/denvdb
chmod +x /usr/local/bin/denv*
