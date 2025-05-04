FROM node:22-bookworm-slim

RUN  npm install -g @anthropic-ai/claude-code

RUN  mkdir /workspaces
WORKDIR /workspaces

ENTRYPOINT [""]
CMD ["claude", "mcp", "serve"]
