FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y curl git ripgrep \
    && rm -rf /var/lib/apt/lists/*

RUN  npm install -g @anthropic-ai/claude-code

RUN  mkdir /workspaces
WORKDIR /workspaces

ENTRYPOINT [""]
CMD ["claude", "mcp", "serve"]
