#!/bin/bash
docker pull tamuto/devenviron:torch
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
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/torch/bin/denv
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/torch/bin/denvp
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/torch/bin/denvdb5
wget -P ~/bin https://raw.githubusercontent.com/tamuto/devenviron/main/torch/bin/denvdb8
ln -s ~/bin/denvdb5 ~/bin/denvdb

chmod +x ~/bin/denv*
