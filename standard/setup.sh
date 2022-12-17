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
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/standard/bin/denv
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/standard/bin/denvp
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/standard/bin/denvdb5
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/standard/bin/denvdb8
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/standard/bin/denv_clear_podman
ln -s ~/bin/denvdb5 ~/bin/denvdb

chmod +x ~/bin/denv*
