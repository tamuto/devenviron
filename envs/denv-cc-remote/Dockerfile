# Claude Code を remote-control で動かすための派生イメージ。
#
# ベースイメージのバージョンは envs/devcontainer/Dockerfile と一致させること。
# VSCode 側と同じ devenviron を土台にすることで、
# どちらから作業しても同じ環境になることを担保している。
FROM tamuto/devenviron:2026.08.0

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

WORKDIR /workspaces

# サーバモード。claude.ai への外向き接続を待ち受ける。
# 事前に一度ログインとワークスペース信頼の承認が必要。README.md を参照。
CMD ["claude", "remote-control"]
