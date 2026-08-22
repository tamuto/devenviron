#!/bin/sh
# denv-cc-remote のエントリポイント。
#
# MCP サーバの登録を起動時に行う。
# ビルド時に `claude mcp add --scope user` で焼き込む方式は使えない。
# ユーザスコープの登録先は ~/.claude.json であり、
# このファイルは組織情報の永続化のためホスト側から bind mount しているため、
# イメージに焼いた内容が覆い隠されてしまうためである。
#
# 起動のたびに登録状態を確認して不足を補うため、
# イメージを更新した場合も既存の環境へ反映される。
set -eu

CONFIG=/root/.claude.json

# bind mount 直後は空ファイルであり、JSON として不正な状態になっている。
# Claude Code が読める形に整えておく。
if [ ! -s "$CONFIG" ]; then
    echo '{}' > "$CONFIG"
fi

# Serena MCP をユーザスコープへ登録する。
#   --context claude-code  … Claude Code 向けのツール設定を使う
#   --project-from-cwd     … 起動時のカレントディレクトリをプロジェクトとして扱う
if claude mcp get serena >/dev/null 2>&1; then
    :
else
    echo "denv-cc-remote: registering serena mcp server..." >&2
    if claude mcp add --scope user serena -- \
         serena start-mcp-server --context claude-code --project-from-cwd
    then
        echo "denv-cc-remote: serena registered." >&2
    else
        echo "denv-cc-remote: WARNING: failed to register serena mcp server." >&2
        echo "denv-cc-remote: run 'claude mcp list' inside the container to investigate." >&2
    fi
fi

exec "$@"
