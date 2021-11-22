FROM python:3.9-slim-buster

RUN apt-get update && apt-get install -y \
    curl build-essential git docker.io sqlite3 software-properties-common gnupg
RUN curl -L https://deb.nodesource.com/setup_lts.x | bash -
RUN apt-get install -y nodejs
RUN curl -fsSL https://apt.releases.hashicorp.com/gpg | apt-key add -
RUN apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
RUN apt-get update && apt-get install terraform
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
RUN pip install \
    poetry \
    ansible \
    awscli \
    boto \
    boto3 \
    twine \
    setuptools_scm \
    pystache \
    python-dotenv \
    numpy \
    pandas \
    sqlalchemy \
    PyMySQL \
    SudachiPy \
    SudachiDict-full
RUN npm install -g @infodb/infodb-cli npm-check-updates
RUN poetry config virtualenvs.in-project true

ENTRYPOINT [""]
CMD ["/bin/bash"]
