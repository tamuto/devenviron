# Claude Code を remote-control で動かすための派生イメージ。
#
# ベースイメージのバージョンは envs/devcontainer/Dockerfile と一致させること。
# VSCode 側と同じ devenviron を土台にすることで、
# どちらから作業しても同じ環境になることを担保している。
FROM tamuto/devenviron:2026.08.1

# Claude Code はネイティブインストーラで導入する。
# npm 版は 2026-01 (v2.1.15) に非推奨となっており、
# 結局同じネイティブバイナリを入れるだけのため利点がない。
#
# ネイティブ版はバックグラウンドで自動更新されるため、バージョンは固定しない。
# 「常に最新を導入する」という本プロジェクトの方針とも一致する。
# このため、このイメージにビルドマニフェストは用意しない。
# 記録が必要な構成はベースイメージ側の /etc/devenviron/manifest.txt が持つ。
RUN curl -fsSL https://claude.ai/install.sh | bash

# ネイティブインストーラは /root/.local/bin へ配置する。
# 非対話実行でも claude を解決できるようPATHを通す。
ENV PATH="/root/.local/bin:${PATH}"

# Serena MCP。セマンティックなコード検索・編集ツールを Claude Code へ提供する。
# uv はベースイメージに含まれているため追加導入は不要。
# uv tool install の実行ファイルは /root/.local/bin へ置かれるので、
# 上の PATH 設定でそのまま解決できる。
#
# serena init は設定の初期化。ビルド時に済ませておくことで、
# 実行時に初期化が走らないようにする。
RUN uv tool install -p 3.13 serena-agent \
&&  serena init < /dev/null

# Claude Code へユーザスコープで登録する。
#   --context claude-code  … Claude Code 向けのツール設定を使う
#   --project-from-cwd     … 起動時のカレントディレクトリをプロジェクトとして扱う
RUN claude mcp add --scope user serena -- \
      serena start-mcp-server --context claude-code --project-from-cwd

# 初回利用時に対象言語の language server を取得するため、
# MCP の起動が既定のタイムアウトに収まらないことがある。
ENV MCP_TIMEOUT=60000

WORKDIR /workspaces

# サーバモード。claude.ai への外向き接続を待ち受ける。
# 事前に一度ログインとワークスペース信頼の承認が必要。README.md を参照。
CMD ["claude", "remote-control"]
