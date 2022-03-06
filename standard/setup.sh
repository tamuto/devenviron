#!/bin/bash
podman pull docker.io/tamuto/devenviron:latest
mkdir -p ~/.devenviron
mkdir -p ~/.devenviron/mysql_data
touch ~/.devenviron/.gitconfig
touch ~/.devenviron/.git-credentials
touch ~/.devenviron/.awsconfig
touch ~/.devenviron/.aws-credentials
touch ~/.devenviron/.npmrc

mkdir -p ~/bin
rm ~/bin/denv*
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/standard/bin/denv 
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/standard/bin/denvp
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/standard/bin/denvdb

chmod +x ~/bin/denv*
