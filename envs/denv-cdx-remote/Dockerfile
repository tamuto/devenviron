# Codex を remote-control で動かすための派生イメージ。
#
# ベースイメージのバージョンは envs/devcontainer/Dockerfile および
# envs/denv-cc-remote/Dockerfile と一致させること。
FROM tamuto/devenviron:2026.08.3

# Codex は公式の standalone installer で導入する。
# npm 版と異なり、remote-control が必要とする managed standalone install が
# 含まれる。常にビルド時点の最新版を導入する。
RUN curl -fsSL https://chatgpt.com/codex/install.sh | env CODEX_NON_INTERACTIVE=1 sh

ENV PATH="/root/.local/bin:${PATH}"

# Serena MCP。ツール本体と環境共通の登録をイメージへ含める。
# プロジェクト固有のMCPは各リポジトリの.codex/config.tomlで管理する。
RUN uv tool install serena-agent \
&&  serena init < /dev/null

COPY config.toml /etc/codex/config.toml

WORKDIR /workspaces

# remote-control をフォアグラウンドで動かす。
# Docker / Compose がこのプロセスを直接監視し、停止シグナルも直接届ける。
CMD ["codex", "remote-control"]
