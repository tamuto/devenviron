#!/bin/bash
podman pull docker.io/tamuto/devenviron:latest
mkdir -p ~/.devenviron
mkdir -p ~/.devenviron/mysql_data
touch ~/.devenviron/.gitconfig
touch ~/.devenviron/.git-credentials
touch ~/.devenviron/.awsconfig
touch ~/.devenviron/.aws-credentials

mkdir -p ~/bin
wget -o ~/bin/denv https://raw.githubusercontent.com/tamuto/devenviron/main/setup/bin/denv 
wget -o ~/bin/denvp https://raw.githubusercontent.com/tamuto/devenviron/main/setup/bin/denvp
wget -o ~/bin/denvdb https://raw.githubusercontent.com/tamuto/devenviron/main/setup/bin/denvdb

chmod +x ~/bin/denv*
