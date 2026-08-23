FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y curl p7zip-full git zip \
&&  apt-get clean && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://get.volta.sh | bash \
&&  /root/.volta/bin/volta install node pnpm

# voltaで導入したnode/pnpmを非対話シェルからも参照できるようにする。
ENV VOLTA_HOME="/root/.volta"
ENV PATH="/root/.volta/bin:${PATH}"

RUN curl -fsSL "https://github.com/oras-project/oras/releases/download/v1.2.3/oras_1.2.3_linux_amd64.tar.gz" \
    | tar -zx -C /usr/local/bin oras

RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
&&  7z x awscliv2.zip \
&&  ./aws/install \
&&  rm -rf ./aws \
&&  rm awscliv2.zip

# アーカイブにはREADME等も含まれるため、必要なcraneだけを展開する。
# (従来はカレントへ全展開してから個別にrmしており、/直下での実行が前提になっていた)
RUN curl -fsSL "https://github.com/google/go-containerregistry/releases/download/v0.20.6/go-containerregistry_linux_x86_64.tar.gz" \
    | tar -zx -C /usr/local/bin crane

RUN pip install --no-cache-dir \
    poetry \
    boto \
    boto3 \
    twine \
    setuptools_scm \
    python-dotenv[cli] \
    taskipy
