#!/bin/bash
if ! type docker &> /dev/null
then
    podman pull docker.io/tamuto/devenviron:latest
fi
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
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denv
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvp
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvdb5
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvdb8
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denv_clear_podman
wget -P ~/bin --header='Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/template/shell/denvnote
ln -s ~/bin/denvdb8 ~/bin/denvdb

chmod +x ~/bin/denv*
if ! type podman &> /dev/null
then
    rm ~/bin/denv_clear_podman
    sed -i "s/podman/docker/" ~/bin/denv*
fi
