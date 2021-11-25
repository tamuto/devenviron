FROM tamuto/devenviron:latest

RUN curl -fsSL https://code-server.dev/install.sh | sh
RUN apt-get update && apt-get install sudo
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

RUN useradd -m workspace
RUN echo "workspace ALL=NOPASSWD: ALL" > /etc/sudoers.d/workspace
RUN chsh -s /bin/bash

COPY bash_aliases /home/workspace/.bash_aliases
ENV SHELL=/bin/bash
USER workspace
WORKDIR /workspace
ENTRYPOINT ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none"]
CMD [""]
