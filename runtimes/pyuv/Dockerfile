FROM debian:bookworm-slim

RUN  apt-get update && apt-get install -y curl
RUN  curl -LsSf https://astral.sh/uv/install.sh | sh \
&&   . $HOME/.local/bin/env \
&&   uv self update \
&&   uv python install 3.12 \
&&   uv python pin 3.12

ENTRYPOINT ["/root/.local/bin/uvx"]
CMD [""]
