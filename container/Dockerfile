FROM python:3.9-slim-buster

RUN apt-get update && apt-get install -y \
    curl build-essential git docker.io sqlite3 software-properties-common gnupg sudo \
&&  curl -L https://deb.nodesource.com/setup_lts.x | bash - \
&&  apt-get install -y nodejs \
&&  curl -fsSL https://apt.releases.hashicorp.com/gpg | apt-key add - \
&&  apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
&&  apt-get update && apt-get install terraform \
&&  apt-get clean && rm -rf /var/lib/apt/lists/* \
&&  pip install \
    poetry \
    ansible \
    awscli \
    boto \
    boto3 \
    twine \
    setuptools_scm \
    python-dotenv \
&&  npm install -g @infodb/infodb-cli npm-check-updates \
&&  poetry config virtualenvs.in-project true

COPY resources/bash_aliases /root/.bashrc

ENTRYPOINT [""]
CMD ["/bin/bash"]
