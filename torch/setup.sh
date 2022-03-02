#!/bin/bash
docker pull tamuto/devenviron:torch
mkdir -p ~/.devenviron
mkdir -p ~/.devenviron/mysql_data
touch ~/.devenviron/.gitconfig
touch ~/.devenviron/.git-credentials
touch ~/.devenviron/.awsconfig
touch ~/.devenviron/.aws-credentials
touch ~/.devenviron/.npmrc

mkdir -p ~/bin
rm ~/bin/denv*
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/setup/bin/denv 
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/setup/bin/denvp
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/setup/bin/denvdb

chmod +x ~/bin/denv*
