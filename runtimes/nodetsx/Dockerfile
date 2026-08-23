FROM node:22-bookworm-slim

RUN  npm install -g pnpm@latest-10 tsx@latest

# ベースイメージのENTRYPOINTを解除する。[""]は空文字のENTRYPOINTを設定してしまう。
ENTRYPOINT []
CMD ["/bin/bash"]
