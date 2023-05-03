#!/bin/bash
podman pull docker.io/tamuto/devenviron:latest
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
rm ~/bin/denv*
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/standard/bin/denv
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/standard/bin/denvp
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/standard/bin/denvdb5
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/standard/bin/denvdb8
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/standard/bin/denv_clear_podman
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/standard/bin/denvnote
ln -s ~/bin/denvdb8 ~/bin/denvdb

chmod +x ~/bin/denv*
