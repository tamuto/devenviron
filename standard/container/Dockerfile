FROM python:3.9-slim-buster

RUN apt-get update && apt-get install -y \
    curl build-essential git sqlite3 \
    software-properties-common gnupg sudo iputils-ping net-tools ftp \
    mycli php p7zip-full subversion \
&&  curl -L https://deb.nodesource.com/setup_lts.x | bash - \
&&  apt-get install -y nodejs \
&&  curl -fsSL https://apt.releases.hashicorp.com/gpg | apt-key add - \
&&  apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
&&  apt-get update && apt-get install terraform \
&&  apt-get clean && rm -rf /var/lib/apt/lists/* \
&&  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
&&  7z x awscliv2.zip \
&&  ./aws/install \
&&  rm -rf ./aws \
&&  rm awscliv2.zip

COPY --from=composer /usr/bin/composer /usr/bin/composer
RUN pip install --upgrade pip
RUN pip install \
    poetry \
    ansible \
    boto \
    boto3 \
    twine \
    setuptools_scm \
    python-dotenv

RUN npm install -g npm \
&&  npm install -g @infodb/infodb-cli npm-check-updates \
&&  poetry config virtualenvs.in-project true \
&&  curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "session-manager-plugin.deb" \
&&  dpkg -i session-manager-plugin.deb \
&&  rm session-manager-plugin.deb

COPY resources/bash_aliases /root/.bashrc
COPY resources/ssh-aws.sh /usr/local/bin/ssh-aws.sh

ENTRYPOINT [""]
CMD ["/bin/bash"]
