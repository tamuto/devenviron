# TODO / 改善課題一覧

DevEnviron のレビュー結果と、それに対する方針決定をまとめたもの。
各項目は `[ ]` 未着手 / `[x]` 完了 で管理する。

---

## 0. 前提方針

このプロジェクトの性格上、一般的なベストプラクティスをあえて採らない判断をしている箇所がある。
レビュー時に繰り返し議論にならないよう、採用しない方針も理由付きで明記する。

### 0.1 採用する方針

- **常に最新を導入する。ソフトウェアのバージョン固定は行わない。**
  - 開発環境であり、最新のツールチェインを使えることを優先する。
  - `pip` / `apt` / `volta install node pnpm` 等はバージョン無指定のままとする。
  - 代わりに「ビルド時点で何が入ったか」を**記録して追跡可能にする**（→ 1章）。
- **配布イメージのタグは不変（immutable）とする。一度 push したタグは上書きしない。**
  - メンバー間の環境統一は「同じタグ = 同じイメージ」で担保する。
  - 中身を変えたい場合は必ず新しいタグを発行する。
- **特殊環境（Jetson / L4T / ROS2 等）は各自の実機でのビルドを前提とする。**

### 0.2 採用しない方針（明記）

- **GitHub Actions 等の CI によるイメージビルドは採用しない。**
  - 理由: Jetson(L4T) 系イメージは手元の実機環境でのビルドが前提であり、CI 環境では再現できない。
  - 一部のターゲット（x86 の Python 系）だけを CI 化すると、ビルド経路が二系統に分かれて
    「どのイメージがどこで焼かれたか」が不明瞭になり、かえって中途半端な状態になる。
  - 特殊環境は各自ビルドという前提を崩さないため、ビルドはローカル実行に統一する。
  - ※ shellcheck 等の「ビルドを伴わない静的チェック」を CI に載せることは、この方針の対象外とする（→ 7.4）。
- **ソフトウェアのバージョンピン留め（constraints.txt 等）は行わない。**（→ 0.1）

---

## 1. 【最優先】ビルド時点の構成を記録・追跡可能にする

バージョンを固定しない方針を採る以上、「このタグのイメージには何が入っているのか」
「前のタグから何が上がったのか」を後から確認できることが、統一基盤としての生命線になる。
固定の代わりに**記録**で担保する。

- [x] **1.1 イメージ内にビルドマニフェストを埋め込む**
  - `template/container/resources/devenviron-manifest`（新規）を作成し、
    Dockerfile の最終層で実行して `/etc/devenviron/manifest.txt` に出力する。
  - 収集内容の例:
    - ベースイメージ名 / ビルド日時 / ビルドホストのアーキテクチャ
    - `cat /etc/os-release`
    - `dpkg -l`（apt パッケージ全一覧とバージョン）
    - `pip list --format=freeze`
    - `node -v` / `pnpm -v` / `volta list all`
    - `terraform version` / `aws --version` / `session-manager-plugin --version` / `uv --version`
  - コンテナ内から `cat /etc/devenviron/manifest.txt` で即座に構成を確認できる状態にする。

- [x] **1.2 マニフェストをリポジトリにコミットして差分を追えるようにする**
  - ビルドスクリプトの最後で以下を実行:
    ```sh
    docker run --rm docker.io/tamuto/devenviron:$1 cat /etc/devenviron/manifest.txt \
      > manifests/devenviron-$1.txt
    ```
  - `manifests/` をリポジトリに含めることで、`git diff manifests/devenviron-2026.08.1.txt manifests/devenviron-2026.09.0.txt`
    で **タグ間で何のバージョンが変わったのかが完全に見える**。
  - CHANGELOG を手書きしなくても、実質的な変更履歴がこれで残る。

- [x] **1.3 OCI 標準ラベルを付与する**
  - `Dockerfile.tmpl` に以下を追加し、稼働中のコンテナからイメージの素性を逆引きできるようにする。
    ```dockerfile
    ARG DENV_VERSION
    ARG DENV_REVISION
    ARG DENV_BASEIMG
    LABEL org.opencontainers.image.source="https://github.com/tamuto/devenviron" \
          org.opencontainers.image.version="${DENV_VERSION}" \
          org.opencontainers.image.revision="${DENV_REVISION}" \
          org.opencontainers.image.base.name="${DENV_BASEIMG}" \
          org.opencontainers.image.created="..."
    ```
  - `docker inspect` だけで「どのコミットの定義から、どのベースで焼かれたか」が判る。

### 実装メモ（1.1〜1.3 完了分）

- `template/container/resources/devenviron-manifest` … マニフェスト生成本体。
  存在しないコマンドは `(not installed)` として記録するため、ベースイメージが変わっても落ちない。
- `template/container/Dockerfile.tmpl` … `ARG DENV_VERSION/REVISION/CREATED` を追加し、
  全導入処理の後で `/etc/devenviron/manifest.txt` を生成、OCI ラベルを付与。
- `scripts/manifest.sh <tag>` … ビルド済みイメージから `manifests/devenviron-<tag>.txt` を取り出す。
- `scripts/build_*.sh` … ビルド情報を `--build-arg` で渡し、ビルド後に `manifest.sh` を自動実行。
- あわせて `ENV VOLTA_HOME` / `ENV PATH` を追加した。
  従来は `.bashrc` でのみ PATH を通していたため、`docker run <image> node -v` のような
  非対話実行では node / pnpm が見つからない状態だった（マニフェスト収集にも必要だった）。

- [ ] **1.4 （発展・保留）SBOM の生成とレジストリへの添付**

  1.1〜1.3 で作ったマニフェストは「人間が読む / git diff で比較する」ためのテキストである。
  1.4 はそれを**機械可読な標準フォーマット**にし、**イメージ本体に紐付けてレジストリ側に置く**もの。

  - **SBOM とは**: Software Bill of Materials（ソフトウェア部品表）。
    イメージに含まれる全パッケージとバージョンを、SPDX / CycloneDX という標準フォーマットの
    JSON で列挙したもの。中身の情報としてはマニフェストとほぼ同じ。
  - **標準フォーマットにする利点**: 脆弱性スキャナ（`grype` / `trivy` 等）がそのまま読める。
    「CVE-XXXX が公表されたが、どのタグのイメージが影響を受けるか」を
    テキスト検索ではなくツールで機械的に判定できる。
  - **`oras attach` とは**: SBOM ファイルを、イメージと同じレジストリに
    「そのイメージへの添付物」として関連付けて push する仕組み（OCI Referrers）。
    イメージを再ビルドせずに後付けでき、`oras discover <image>` で辿れる。
    `manifests/` のような git 側の記録と違い、**レジストリからイメージを取得した相手が
    そのまま SBOM も取得できる**点が異なる。
  - **本プロジェクトでの位置づけ**: `etc/runtimes/nodeoras` に既に `oras` / `crane` があるため
    実装の下地はある。ただしメンバー配布が主用途で外部への配布はしていないため、
    現時点では 1.1〜1.3 のテキスト記録で足りている。
    脆弱性対応を運用に組み込む段階になったら着手する。

---

## 2. リリース運用（タグ不変性の担保）

- [x] **2.1 `latest` タグの廃止**
  - `deploy.sh` の `docker push ...:latest` を削除。
  - `scripts/build_py3_12.sh` / `build_py3_13.sh` の `docker tag ...:latest` を削除。
  - `latest` を指定して `deploy.sh` を実行した場合もエラーで停止するようにした。

- [x] **2.2 `deploy.sh` に `set -eu` と引数チェックを追加**
  - あわせて、push 前にローカルへイメージが存在するかも確認する。

- [x] **2.3 push 前に既存タグを検出して停止する**
  - `docker manifest inspect` でレジストリ側に同名タグがあるかを確認し、存在すれば拒否する。
  - タグ不変ポリシーを運用ではなく仕組みで守る。
  - やむを得ない場合のみ `./deploy.sh --force <tag>` で上書きできる。
  - あわせて `manifests/devenviron-<tag>.txt` の存在も push の必須条件とした。
    記録のないイメージが配布されることを防ぐ。

- [x] **2.4 バージョンの単一情報源を確定**
  - `template/Dockerfile` を配布バージョンの単一情報源とする。
    他のドキュメントにはバージョン番号を書かない（`grep` で他に存在しないことを確認済み）。
  - `docs/rebuild.md` に「タグの運用ルール」と「リリース手順」を追加。
    ビルド → マニフェストのコミット → push → `template/Dockerfile` 更新 → git tag、
    の流れを明文化し、イメージタグと git タグを一致させる運用にした。

- [x] **2.5 `etc/runtimes/build.sh` の `latest` タグ付けを廃止**
  - ランタイムイメージも同様に `latest` を付与しないようにした。
  - あわせて引数チェックと Dockerfile の存在確認を追加。

### 実装メモ（2章 完了分）

- `deploy.sh` は以下をすべて満たさない限り push しない。
  1. 引数が指定されていること / `latest` でないこと
  2. 対象イメージがローカルに存在すること
  3. `manifests/devenviron-<tag>.txt` が存在すること
  4. レジストリに同名タグが存在しないこと（`--force` で回避可）
- 検証は docker スタブを用いて全分岐を確認済み。実レジストリへの push は未実行。
- ランタイムイメージ（`etc/runtimes/`）にはまだマニフェスト記録の仕組みがない。
  配布物として扱うなら 1 章と同等の仕組みを入れる必要がある（→ 別途検討）。

---

## 3. 【新機軸】remote-control 版 devenviron

Claude Code を remote-control で起動する環境を新たに提供し、今後の主軸をこちらに移す。
既存の devenviron（VSCode devcontainer 前提）とは**イメージ名・バージョン体系・セットアップ手順を分離**する。

- [x] **3.1 イメージ名（決定 → 後に方針変更）**
  - 当初は `tamuto/denv-cc-remote` として公開する前提だったが、
    **公開しない方針へ変更した。**
  - 理由:
    - ベース（`tamuto/devenviron:2026.08.1`）と派生（`denv-cc-remote:2026.08.0`）が
      同じ CalVer 形式で並ぶと、対応関係がタグから読み取れず混乱する。
    - 環境統一という目的は、すでにベースイメージ側で達成されている。
      python / node / terraform 等の実体は `FROM` のタグ固定とタグ不変ポリシーで完全に決まる。
      派生が積むのは Claude Code と Serena だけ。
    - Claude Code は**どのみち自動更新される**ため、イメージに焼いても実行時には各自で分かれる。
      publish しても統一できない。
    - 中身が実質3つの `RUN` であり、publish という重い仕組みに見合わない。
  - 残る論点: Serena は自動更新されないため、ビルド時期でバージョンがばらつく。
    揃える必要が生じたら `Dockerfile` で `serena-agent==<version>` と指定すれば足りる。
  - compose のイメージ名は `denv-cc-remote:local`。
    ローカルビルドであることを示す固定値で、バージョンの意味は持たせない。
  - **後戻り可能**: リモートサーバや多数のマシンで動かす必要が出た時点で publish へ切り替えられる。

- [x] **3.2 バージョン体系の分離（決定）**
  - **CalVer `YYYY.MM.<patch>`**（例: `2026.08.0`）を採用する。
    同一月内の再ビルドは `<patch>` で区別する。
  - **【変更1】当初は新系統のみ CalVer とし既存は SemVer 維持としたが、
    ベースイメージ `tamuto/devenviron` も CalVer へ移行することにした。**
    移行後の初版は `2026.08.1`
    （`2026.08.0` は push 前に破棄。revision が `unknown` のままだったため）。
  - **【変更2】バージョン番号を持つのはベースイメージだけとした（3.1 参照）。**
    派生イメージは公開せず、番号も持たない。
  - 採用理由:
    - 「常に最新を導入する」方針では、イメージの中身は**いつ焼いたか**でほぼ決まる。
      SemVer の `0.42.0` は中身について何も語らないが、`2026.08.0` は
      「2026年8月時点の最新構成」という情報そのものになり、方針と意味が一致する。
    - 1.2 のマニフェストと組み合わせると「いつの版か」＋「何が入っていたか」が揃う。
  - `0.41.0` 以前は SemVer で発行済み。日付形式が明らかに異なるため新旧の区別は付く。
    過去のタグを振り直すことはしない（タグ不変ポリシーのため）。

- [x] **3.3 起動インターフェースの設計（devcontainer 非依存）**
  - `envs/denv-cc-remote/` に `Dockerfile` と `docker-compose.yaml` を作成した。
    スクリプトは用意せず compose で完結させている。
    このフォルダ一式を配布すれば各利用者が同じ環境を再現できる。
  - `docker-compose.yaml` は `image:` と `build:` の両方を持つ。
    利用者は `docker compose pull` で済み、必要なときだけ `build` できる。
  - **ポート公開は不要**であることが判明した。
    remote-control は claude.ai への外向き接続で成立し、待ち受けポートを持たない。
  - ベースバージョンは `envs/devcontainer/Dockerfile` と
    `envs/denv-cc-remote/Dockerfile` の2ファイルに素で記載する。
    スクリプトによる抽出は行わない（間接化を避けるため）。
    リリース手順（`docs/rebuild.md`）に「両方を揃える」ステップを明記した。

- [x] **3.4 必要要件の洗い出し（主要部分）**
  - **Claude Code の導入方式**: ネイティブインストーラ（`curl -fsSL https://claude.ai/install.sh | bash`）。
    npm 版は 2026-01 (v2.1.15) に非推奨。結局同じネイティブバイナリを入れるだけで利点がない。
  - **マニフェスト不要**: ネイティブ版はバックグラウンドで自動更新するため、
    ビルド時にバージョンを記録しても即座に無意味になる。
    記録が必要な構成はベースイメージ側の `/etc/devenviron/manifest.txt` が持つ。
  - **認証情報の永続化**: 名前付きボリューム `claude-config` を `/root/.claude` へ。
    自動更新されたバイナリの実体は `claude-versions` を `/root/.local/share/claude` へ。
  - **初回のみ対話操作が必要**: サーバモードはログイン済みでないと起動時にエラー終了する。
    またワークスペース信頼の承認も必要。`docker compose run --rm ... claude` で済ませる。
  - **設定してはいけない環境変数**: `DISABLE_TELEMETRY` / `DO_NOT_TRACK` /
    `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` / `DISABLE_GROWTHBOOK`。
    remote-control が依存する機能フラグの評価を無効化してしまう。
    `ANTHROPIC_BASE_URL` を `api.anthropic.com` 以外へ向けた場合も利用不可。
  - **複数セッション**: サーバモードの `--spawn worktree` / `--capacity` で対応可能。
  - **`~/.claude.json` の永続化【対応済み・実害あり】**
    - 当初これを未対応のまま残していたところ、
      `Unable to determine your organization for Remote Control eligibility`
      で remote-control が起動できない不具合として顕在化した。
    - 調査結果: Claude Code は認証トークンを `~/.claude/.credentials.json` に、
      組織情報（`oauthAccount` … `organizationUuid` / `organizationName` /
      `organizationRole` / `organizationType`）と
      Remote Control の可否判定に使う機能フラグのキャッシュ
      （`cachedGrowthBookFeatures` / `cachedStatsigGates`）を `~/.claude.json` に、
      **別々に**保存する。
      前者だけを名前付きボリュームで永続化していたため、
      `docker compose run --rm` でログインすると
      トークンだけが残り組織情報が消える状態になっていた。
    - 対応: 名前付きボリューム `claude-config` を廃止し、
      `.claude`（ディレクトリ）と `.claude.json`（単一ファイル）を
      ホスト側 `.devcontainer/denv/` から bind mount する方式へ変更。
      単一ファイルの bind mount は `.gitconfig` / `.git-credentials` と同じ既存パターン。
    - Docker は bind mount 先が存在しないとディレクトリを作ってしまうため、
      `setup.sh` に `mkdir .claude` と `touch .claude.json` を追加した。
      `setup.sh` を使わない場合の手順も README に記載済み。
  - **Serena MCP の登録方法【対応済み・実害あり】**
    - ビルド時に `claude mcp add --scope user` で焼き込む方式を採ったが、
      MCP として認識されない不具合が出た。
    - 原因: ユーザスコープの MCP 登録先は `~/.claude.json` であり、
      組織情報の永続化のため同ファイルをホスト側から bind mount した結果、
      **イメージに焼いた登録が丸ごと覆い隠されていた**。
      登録先と永続化先が同一ファイルであるため、この2つは両立しない。
    - 対応: **登録をイメージから外し、ログインと同じく初回のみの手作業とした。**
      `.claude.json` をホスト側へ永続化したことで、
      一度登録すればコンテナを作り直しても残るようになったため。
      一時的に entrypoint で自動登録する案も入れたが、
      利用者が任意の MCP を自由に入れられる方が良いため取りやめた。
    - あわせて、空ファイル（JSON として不正）にならないよう、
      `setup.sh` と README で `{}` を書き込む形に変更した。
    - **注意点として明記した**: 永続化されるのは登録内容であってツール本体ではない。
      `/root/.local` は永続化していないため、
      コンテナ内で `uv tool install` / `npm install -g` したものは作り直すと消える。
      `npx -y <pkg>` のように起動のたびに解決される形なら問題なく使える。
      常設したいものは `Dockerfile` へ追加する。
  - **複数プロジェクトの扱い【確認済み】**
    - remote-control のサーバは **1 つにつき 1 ディレクトリ**しか扱えない。
      `--spawn` の3モード（`same-dir` / `worktree` / `session`）のいずれも
      サブディレクトリを列挙しない。
      `/workspaces` のような親ディレクトリで1つ起動しても
      プロジェクトごとのセッションにはならない。
    - 対応: `docker-compose.yaml` に YAML アンカーを用意し、
      プロジェクトごとにサービスを定義する形にした。
      各サーバに `--name` を付ければ claude.ai のセッション一覧に並ぶ。
      サービス1つにつきコンテナ1つ・プロセス1つが起動する。
    - `/workspaces` 全体を対象とする既定サービスは廃止した。
      公式ドキュメントが
      「start Remote Control from a project directory」としており、
      親ディレクトリでの起動は想定外の使い方であるため。
    - `--spawn session`（1コンテナ = 1プロジェクト = 1セッション）を基本とする。
      従来の CLI と同じ感覚で扱えるため。
    - **環境変数で `working_dir` を切り替える案は破棄した。**
      compose はコンテナを「compose プロジェクト名 + サービス名」で識別するため、
      同じサービスへの 2 回目の `up` は既存コンテナの作り直しになる。
      1 つ目が落ちて 2 つ目に置き換わるだけで、複数起動という目的を満たさない。
      サービスを並べて定義する以外に方法はない。
    - **compose ファイルを共通部と各自の定義に分割した。**
      各自のプロジェクト定義をコミットせずにリポジトリ内で作業できるようにするため。
      - `compose.base.yaml` … 共通設定。リポジトリで管理
      - `docker-compose.yaml.sample` … 雛形。リポジトリで管理
      - `docker-compose.yaml` … 各自の定義。`.gitignore` 済み
      YAML アンカーはファイルをまたげないため `extends` を使う。
      `extends` では top-level の `volumes:` が引き継がれないため、
      各自のファイル側で宣言する必要がある（雛形に含めてある）。
      相対パスは読み込む側のファイル位置が基準になるが、同一ディレクトリのため影響はない。
    - **モバイルに出るデバイス名はコンテナの hostname である。**
      Docker は既定でコンテナ ID を hostname にするため、
      指定しないと16進の羅列が表示されて判別できない。
      compose の `hostname:` で指定する（`compose.base.yaml` に既定値 `denv`）。
      compose にはサービス名を参照する変数がないため自動では引けない
      （`${...}` は環境変数と `.env` しか読まない）。
      サービス名はコンテナ間 DNS のネットワークエイリアスにはなるが、
      `/etc/hostname` とは別物である。
      YAML のアンカーで共通化する案は破棄した。
      アンカー名と値の両方を書くため記述量がかえって増えるため。
      唯一サービス名から自動で決まるのは `container_name` で、
      省略すれば `<compose プロジェクト名>-<サービス名>-1` が付く。
      セッション名（`--name`）とは別物である点に注意。
      `--remote-control-session-name-prefix` はセッション名にしか効かない。
    - マウントは全サービス共通でツリー全体（`${WORKSPACES_ROOT}` → `/workspaces`）。
      `working_dir` は開始位置の指定であって可視範囲を絞るものではないため、
      フォルダの担当分けは運用で決める必要がある。
    - 1プロジェクト内で並行作業する場合は `--spawn worktree`。
      Claude Code が `.claude/worktrees/<name>/` へ自動で切り出すため、
      フォルダを事前に分ける必要はない。
      ただし fresh checkout のため `node_modules` 等は無く、
      `.env` も `.worktreeinclude` を置かないと引き継がれない。
    - MCP はユーザスコープで登録すれば全プロジェクトで有効。
      `.claude.json` を全サービスが同じファイルで bind mount しているため。
      Serena は `--project-from-cwd` により各コンテナの作業ディレクトリを
      自動で対象プロジェクトとして扱う。
    - ワークスペース信頼はディレクトリごとの承認が必要な点に注意
      （ログインはアカウント単位で一度でよい）。
      **親ディレクトリの承認も、同じリポジトリの別 worktree の承認も引き継がれない。**
      未承認だとセッションが開始しないため、
      プロジェクトを追加するたびに `docker compose run --rm <サービス> claude` で
      一度承認する必要がある。実際にこれで2つ目のサービスが起動しない事象が発生した。
  - 残っている検討事項:
    - ホスト側の Docker ソケットを渡すか否か（渡す場合の権限設計）。
    - コンテナのライフサイクル（常駐か都度起動か）の運用方針。

- [ ] **3.5 既存 devenviron との責務整理**
  - README に `envs/` 配下の2つを併記した（devcontainer / denv-cc-remote）。
    どちらも同じ devenviron を土台とすることも明記済み。
  - **未決**: 現行の devcontainer 方式を維持し続けるのか、段階的に新系統へ寄せるのか。
    メンバーが「どちらを使えばよいか」で迷わない状態にするには、
    推奨する方をどこかで示す必要がある。denv-cc-remote の運用実績が出てから判断する。

---

## 4. セットアップ手順の改善

前提: `git clone` してのセットアップは想定しない。workspace フォルダが git 管理下にあることも想定しない。
`curl | sh` によるワンショットセットアップという現行方式自体は維持する。

- [ ] **4.1 `setup.sh` を冪等にする（再実行可能にする）**
  - `wget -P .devcontainer ...` は既存ファイルがあると `devcontainer.json.1` を作るだけで、
    **本体は古いまま残る**。更新したつもりが反映されない。
  - `ln -s /usr/local/bin/denvdb8 /usr/local/bin/denvdb` は 2 回目で失敗し、
    `set -eu` によりスクリプト全体が停止する。
  - 対策: `curl -fsSL -o <path>` で明示的に上書き、`ln -sf` に変更。

- [ ] **4.2 `denv-update` コマンドを用意する**
  - 現状、一度セットアップした環境でテンプレートやホストコマンドを更新する導線が実質ない。
  - `setup.sh` の再取得部分だけを切り出したホストコマンドを提供し、
    「イメージを上げたらまず `denv-update`」という運用にする。

- [ ] **4.3 セットアップ内容をバージョンに追随させる**
  - 現在 `setup.sh` は GitHub API のデフォルトブランチ先端を取得するため、
    リポジトリを更新した瞬間に、既存メンバーの再セットアップ結果が変わる。
  - `?ref=v2026.08.0` のように取得元を明示できるようにし、
    `setup.sh <version>` で「そのバージョン一式」を取れるようにする。
  - タグ不変ポリシー（0.1）とセットアップ側の整合が取れる。

- [ ] **4.4 ダウンロード失敗時に処理を止める**
  - `wget` の失敗や、`curl | sh` の途中失敗が検知されない。
  - `curl -fsSL` を使い、`set -euo pipefail` を有効にする。

- [ ] **4.5 認証情報のパーミッションを設定する**
  - `setup.sh` が作る `.devcontainer/denv/.ssh` および `.aws/credentials`、`.git-credentials` に対し、
    `chmod 700` / `chmod 600` を明示的に適用する。
  - SSH は権限が緩いと警告やエラーで弾かれるため、実利もある。

- [ ] **4.6 保険として `.devcontainer/denv/.gitignore` を生成する**
  - workspace が git 管理下にあることは想定していないが、
    将来誤って `git init` された場合に秘密鍵と AWS クレデンシャルがコミット対象に入る。
  - `.devcontainer/denv/.gitignore` に `*` を 1 行書いたファイルを置くだけで防げる。コストがほぼゼロの保険。

---

## 5. セキュリティ

- [ ] **5.1 `denvdb8` の MySQL を localhost に束縛する**
  - `-p3306:3306` は 0.0.0.0 で待ち受けるため、WSL2 のポート転送を経由して
    LAN から `root` / `password` で接続され得る。`--restart always` のため再起動後も上がり続ける。
  - `-p 127.0.0.1:3306:3306` に変更する。

- [ ] **5.2 MySQL の root パスワードを上書き可能にする**
  - `-e MYSQL_ROOT_PASSWORD=${DENV_MYSQL_PASSWORD:-password}` のように環境変数で差し替えられるようにする。

- [ ] **5.3 ダウンロードするバイナリのチェックサム検証**
  - awscli / session-manager-plugin / oras / crane / volta をすべて curl 取得しているが検証がない。
  - oras / crane は公式が sha256 を配布しているため、少なくともこの 2 つは検証を入れられる。
  - ※ バージョン固定はしない方針のため、「最新版の公式チェックサムを取得して照合する」形にする。

- [ ] **5.4 root 前提の設計について、意図をドキュメント化する**
  - WSL のデフォルトユーザを root にし、コンテナも `remoteUser: root` としている。
  - ファイル所有権を揃えるという意図は妥当だが、新メンバーが不安を持つ点なので
    「なぜそうしているか」「どのようなリスクを許容しているか」を `docs/` に 1 段落記載する。

---

## 6. Dockerfile / ビルドスクリプトの不具合

- [ ] **6.1 `Dockerfile.tmpl:11` `apt-get install terraform` に `-y` がない**
  - terraform パッケージに追加依存がないため現状は偶然プロンプトが出ずに通っているが、
    依存が 1 つ増えた時点でビルドが `Abort.` で落ちる。

- [ ] **6.2 `Dockerfile.tmpl:19` `curl https://get.volta.sh | bash` に `-f` がない**
  - HTTP エラー時にエラーページの HTML がそのまま bash に流し込まれる。`curl -fsSL` に統一する。

- [ ] **6.3 apt lists と pip キャッシュがイメージに焼き込まれている**
  - 1 層目（`Dockerfile.tmpl:3-6`）で `apt-get update` した lists を削除しておらず、
    後段（12 行目）で消してもレイヤーには残る（数十 MB）。
  - `pip install` に `--no-cache-dir` がなく、pip キャッシュが丸ごと残る（boto3 等を含むと数百 MB 規模）。
  - どちらも 1 行の修正で効果が大きい。

- [ ] **6.4 `lsb_release` への暗黙依存を明示する**
  - `Dockerfile.tmpl:10` で使用しているが明示インストールしておらず、
    `software-properties-common` の依存に乗っているだけ。apt リストに `lsb-release` を明記する。

- [ ] **6.5 `ENTRYPOINT [""]` を `ENTRYPOINT []` に修正する**
  - リセット目的なら `[]` が正しい記法。`[""]` は空文字のエントリポイントを設定してしまう。

- [ ] **6.6 `etc/runtimes/pyuv/Dockerfile` の `CMD [""]`**
  - 空文字の引数を 1 つ渡すため `uvx ""` として起動しエラーになる。`CMD []` が意図のはず。

- [ ] **6.7 Ubuntu 24.04 ベースで `pip install` が失敗する**
  - `scripts/build_torch_2.7-r36.4.0-cu128-24.04.sh` は Ubuntu 24.04 ベースであり、
    PEP 668 により `pip install` が `externally-managed-environment` で拒否される。
  - `--break-system-packages` の付与、または venv 経由への切り替えが必要。

- [ ] **6.8 ビルドスクリプト 11 本の重複を解消する**
  - 差分はベースイメージ / ARCH / SSM_ARCH / latest タグの有無のみ。
  - 実際に `--network host` の有無（`build_allbase_r36.3.0.sh` と `build_torch_2.7-*.sh` のみ付与）や
    `docker tag latest` の有無が既に散らばっている。
  - `scripts/targets.tsv` にターゲット定義を並べ、`scripts/build.sh <target> <tag>` の 1 本に集約する。
  - ※ CI は採用しないため、あくまで**ローカル実行スクリプトの整理**として行う。

- [ ] **6.9 ビルド前に `build/` を掃除する**
  - `build/` を消さずに使い回すため、`build_ros_humble_torch_r35.3.1.sh` を 2 回実行すると
    `bash_aliases` に `source /opt/ros/...` が重複追記される。冒頭に `rm -rf build` を追加する。

- [ ] **6.10 `sed` の区切り文字を変更する**
  - `s/{{BASEIMG}}/dustynv\/l4t-pytorch:r36.2.0/` のようにスラッシュをエスケープしているが、
    `s|...|...|` にすればエスケープ不要で読みやすくなる。

- [ ] **6.11 `etc/runtimes/nodeoras/Dockerfile` の整理**
  - apt lists の削除がない。
  - `rm README.md gcrane krane LICENSE` が `/` 直下での実行を前提にしている。
  - `amd64` / `x86_64` 決め打ちになっている。

---

## 7. 個別スクリプトの不具合

- [ ] **7.1 `bash_aliases` のプロンプト定義が壊れている**
  - `template/container/resources/bash_aliases:6` の PS1 で `\[` が二重になっている
    （`\[\[\033[01;34m\]`）。bash のプロンプト幅計算が狂い、
    長いコマンド入力時に行が折り返さない / カーソルがズレる原因になる。
  - 同ファイル `:8` の `source /usr/share/bash-completion/completions/git` は無条件 source だが、
    `bash-completion` パッケージが入っておらず、**シェル起動のたびにエラーが出る**。
    4 行目の git-prompt 側は `-e` でガードされているのに、こちらだけ素通しになっている。
  - ファイル名が `bash_aliases` なのに `/root/.bashrc` として COPY されており、
    ベースイメージの `.bashrc` を完全に上書きしている。実態に合った名前にする。

- [ ] **7.2 `denv_backup` / `denv_restore` が現在の構成と一致していない**
  - `denv_backup` は `~/.devenviron/` 配下の `.awsconfig` / `.aws-credentials` を tar するが、
    `setup.sh` が作るのは `.devcontainer/denv/.aws/config` と `.aws/credentials`。
    **パスもファイル名も一致しておらず、現状このスクリプトは動作しない。**
  - `denv_restore` が作る `~/.devenviron/mysql_data8` も、
    `denvdb8` が実際にマウントする `~/.mysql_data8` とズレている。
  - 現行レイアウトに合わせて書き直すか、使っていないなら削除する。
    中途半端に残っていると新メンバーが踏む。

- [ ] **7.3 `ssh-aws.sh` / `ssh-fw-aws.sh` がインスタンスを絞り込んでいない**
  - `--filters "Name=tag:Name,Values=[$2]"` に状態フィルタがないため、
    同名の terminated / stopped インスタンスが残っていると InstanceId が複数返り、
    `--target` に空白区切りの文字列が渡って失敗する。
  - `Name=instance-state-name,Values=running` を追加し、
    `--query "Reservations[0].Instances[0].InstanceId"` で 1 件に絞る。
  - あわせて `set -eu` と引数数チェックを追加する。

- [ ] **7.4 shellcheck を導入する**
  - シェルスクリプト中心のリポジトリであり、未クォート変数やシェバン誤りを自動検出できる。
  - `shellcheck scripts/*.sh template/shell/* etc/runtimes/build.sh`
  - ※ これはビルドを伴わない静的チェックであり、0.2 の「CI でイメージをビルドしない」方針とは別枠。
    ローカル実行のみとするか CI に載せるかは別途判断する。

- [ ] **7.5 `denvtime` のシェバンが `#/bin/bash`（`!` 抜け）**
  - 実質 sh で動いてしまうため気付きにくい。

---

## 8. 将来構想: VSCode 非依存 / AI ファースト

- [ ] **8.1 起動手段を devcontainer から分離する**
  - 現状は `devcontainer.json` が唯一の起動口になっている。
  - コンテナ起動の実体（マウント定義・runArgs 相当）を `docker compose` あるいは
    起動スクリプトに寄せ、`devcontainer.json` はそれを呼ぶ薄い層にする。
  - VSCode / remote-control / 素の CLI のいずれからも同じ環境が立ち上がる状態を目指す。
  - `etc/runtimes/README.md` に書かれている `docker run` の長大なマウント列は、
    まさにこの共通化で解消できる部分。

- [ ] **8.2 マウント定義の単一情報源化**
  - 同じマウント一覧が `template/devcontainer.json` と `etc/runtimes/README.md` に重複している。
  - 8.1 の共通化と同時に 1 箇所へ集約する。

- [ ] **8.3 AI ファースト環境としての要件整理**
  - エージェントが安全に動ける前提（作業ディレクトリの範囲、ネットワーク、権限）
  - エージェント用の認証情報と人間用の認証情報の分離
  - 複数エージェントの並行実行（コンテナ / ワークスペースの分離戦略）
  - VSCode 拡張機能リストへの依存を減らし、エディタ非依存の設定へ寄せる

- [ ] **8.4 `devcontainer.json` の細部**
  - `TZ` 指定がないためコンテナは UTC。ログのタイムスタンプで混乱しやすい。
    `"containerEnv": {"TZ": "Asia/Tokyo"}` を追加する。
  - 拡張機能が `ms-python.flake8` だが、`uv` を導入済みなら `charliermarsh.ruff` へ寄せる方が
    現状のエコシステムと整合する。

---

## 9. ドキュメント / 不要物の整理

- [x] **9.1 `docs/rebuild.md` のパス誤記**
  - `./script/build_py3_11.sh` → `./scripts/build_py3_13.sh` に修正（例示するターゲットも現行版へ変更）。

- [x] **9.2 `etc/wsl/setup.sh` と `etc/wsl/setup.bat` が両方とも空ファイル**
  - 削除。最終更新は 2022-08 で、中身は 0 バイトだった。

- [x] **9.3 `etc/mac/default.yaml` が動作しない**
  - 削除。Mac は検証環境がないためサポート対象外とする方針を確定。
  - Ubuntu impish（21.10、2022年7月 EOL）の cloud image を参照しており、配布元から削除済みで取得もできなかった。
  - README の「【後日記載】Macの場合は、Lima+Ubuntu を想定」も
    「Macは検証環境がないため現在サポートしていない」に変更。

- [x] **9.4 EOL に近いベースイメージ / 使われていないビルドスクリプトの整理**
  - 削除したもの:
    - `scripts/build_py3_9.sh` … Python 3.9 は 2025-10 に EOL
    - `scripts/build_py3_11.sh` … bullseye（Debian 11）ベース。x86 は 3.12 / 3.13 に一本化
    - `scripts/build_l4t_torch_r35.2.1.sh` / `r35.4.1.sh` / `build_ros_humble_torch_r35.3.1.sh` … JetPack 5 系。実機なし
    - `scripts/build_llama_gguf_r36.2.0.sh` … 用途が限定的で利用実績なし
  - 残したもの: `build_py3_12.sh` / `build_py3_13.sh` /
    `build_l4t_torch_r36.2.0.sh` / `build_allbase_r36.3.0.sh` / `build_torch_2.7-r36.4.0-cu128-24.04.sh`

- [x] **9.5 `CLAUDE.md` を削除**
  - 当初は「方針と禁止事項のみを残す」形に削ぎ落としたが、その後 3.1 / 3.2 の決定を
    `CLAUDE.md` と `docs/rebuild.md` の両方へ書いてしまい、二重管理が発生した。
    「事実は一箇所に」という整理の趣旨に反するため、ファイルごと削除した。
  - 記載内容の移管先:
    - 方針全般（バージョン固定しない / タグ不変 / CI 不採用）… 本ファイルの「0. 前提方針」
    - イメージの系統とバージョン体系 … `docs/rebuild.md`
    - タグの運用ルール、リリース手順、マニフェスト … `docs/rebuild.md`
    - `manifests/` の位置づけ … `manifests/README.md`、`README.md`
  - `docs/rebuild.md` の冒頭に CI 不採用の理由を追記し、
    詳細は本ファイルの「0. 前提方針」を参照させる形にした。
  - なお、AI 向けにのみ意味があった記述（`docker build` / `deploy.sh` を実行しない、
    日本語で記述する）は移管先を設けずに削除している。
    前者は人間にとっては実行して当然の操作であり、後者はリポジトリ全体を見れば自明なため。

- [x] **9.6 `docs/old/` の削除**
  - 全 7 ファイルを削除。最終更新 2023-09 の Podman 時代の資料。
  - `docs/old/commands.md` に記載されていたコマンド（`denv` `denvsh` `denvcli` `denvp`
    `denvdb` `denvdb5` `denv_clear_podman` `denvnote`）は **8 個すべて実体が存在しなかった**。
  - `config_misc.md` は 0 バイトだった。

- [x] **9.7 `etc/` の解体とディレクトリ構成の整理**
  - `etc/` は雑多な置き場になっていたため解体した。
    - `etc/runtimes/` → `runtimes/`（トップレベルへ昇格）
    - `etc/resources/commands.drawio` → `docs/img/`（生成物の svg の隣へ）
  - 利用環境の定義を `envs/` に集約した。
    - `template/devcontainer.json` / `template/Dockerfile` → `envs/devcontainer/`
      （どちらも devenviron 本体のビルドには不要なため）
    - `envs/denv-cc-remote/` を新設
  - `template/` はベースイメージの定義（`container/`）とホストコマンド（`shell/`）のみになった。
  - `runtimes/README.md` に位置づけを明記した。
    こちらは別プロジェクトへ提供する補助ツールであり、
    `envs/` 配下の正式な配布環境とは扱いが異なる。
  - `setup.sh` の取得パスを新しい配置に追随させた。
