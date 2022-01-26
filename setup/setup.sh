#!/bin/bash
podman pull docker.io/tamuto/devenviron:latest
mkdir -p ~/.devenviron
mkdir -p ~/.devenviron/mysql_data
touch ~/.devenviron/.gitconfig
touch ~/.devenviron/.git-credentials
touch ~/.devenviron/.awsconfig
touch ~/.devenviron/.aws-credentials
touch ~/.npmrc

mkdir -p ~/bin
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/setup/bin/denv 
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/setup/bin/denvp
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/setup/bin/denvdb

chmod +x ~/bin/denv*
