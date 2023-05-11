#!/bin/bash
set -eu

mkdir -p ~/.devenviron
mkdir -p ~/.devenviron/.ssh
mkdir -p ~/.devenviron/mysql_data5
mkdir -p ~/.devenviron/mysql_data8
touch ~/.devenviron/.gitconfig
touch ~/.devenviron/.git-credentials
touch ~/.devenviron/.awsconfig
touch ~/.devenviron/.aws-credentials
touch ~/.devenviron/.npmrc

mkdir -p ~/bin
rm -f ~/bin/denv*
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denv
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvp
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvdb5
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvdb8
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denv_clear_podman
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvnote
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvcli
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvsh
ln -s ~/bin/denvdb8 ~/bin/denvdb

chmod +x ~/bin/denv*
if which podman > /dev/null; then
    # podman pull docker.io/tamuto/devenviron:latest
    echo "command OK"
elif which docker > /dev/null; then
    # docker pull tamuto/devenviron:latest
    rm ~/bin/denv_clear_podman
    sed -i "s/podman/docker/" ~/bin/denv*
fi
