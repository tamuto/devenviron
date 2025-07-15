FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y curl p7zip-full

RUN curl -LO "https://github.com/oras-project/oras/releases/download/v1.2.3/oras_1.2.3_linux_amd64.tar.gz" \
&&  mkdir -p oras-install/ \
&&  tar -zxf oras_1.2.3_*.tar.gz -C oras-install/ \
&&  mv oras-install/oras /usr/local/bin/ \
&&  rm -rf oras_1.2.3_*.tar.gz oras-install/

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
&&  7z x awscliv2.zip \
&&  ./aws/install \
&&  rm -rf ./aws \
&&  rm awscliv2.zip

RUN curl -sL "https://github.com/google/go-containerregistry/releases/download/v0.20.6/go-containerregistry_linux_x86_64.tar.gz" > go-containerregistry.tar.gz \
&&  tar zxf go-containerregistry.tar.gz \
&&  mv crane /usr/local/bin/crane \
&&  rm go-containerregistry.tar.gz \
&&  rm README.md gcrane krane LICENSE
