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
  - `manifests/` をリポジトリに含めることで、`git diff manifests/devenviron-0.41.0.txt manifests/devenviron-0.42.0.txt`
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

- [x] **3.1 イメージ名の分離（決定）**

  | 系統 | イメージ名 | 用途 |
  | --- | --- | --- |
  | 既存 | `tamuto/devenviron` | VSCode devcontainer 前提の開発環境。現行系統として維持 |
  | 新規 | `tamuto/denv-cc-remote` | Claude Code を remote-control で動かす環境 |

  - 名前を分けることで、既存メンバーの環境に一切影響を与えずに新系統を並走できる。
  - 決定内容は `CLAUDE.md` にも記載済み（系統の取り違え防止のため）。

- [x] **3.2 バージョン体系の分離（決定）**
  - 新系統は **CalVer `YYYY.MM.<patch>`**（例: `2026.08.0`）を採用する。
    同一月内の再ビルドは `<patch>` で区別する。
  - 採用理由:
    - 「常に最新を導入する」方針では、イメージの中身は**いつ焼いたか**でほぼ決まる。
      SemVer の `0.42.0` は中身について何も語らないが、`2026.08.0` は
      「2026年8月時点の最新構成」という情報そのものになり、方針と意味が一致する。
    - `0.41.0` と `2026.08.0` は**一目で系統が違うと判る**ため、
      2系統併走中の取り違えが起きない。
    - 1.2 のマニフェストと組み合わせると「いつの版か」＋「何が入っていたか」が揃う。
  - 既存 `tamuto/devenviron` は SemVer のまま維持する（体系を後から変えない）。

- [ ] **3.3 起動インターフェースの設計（devcontainer 非依存）**
  - **前提**: 新系統は devcontainer を想定しない。必要に応じて compose を用いる。
    セットアップ手順そのものが既存とは別系統になるため、`setup.sh` は流用しない。
  - 検討事項:
    - compose ファイルの配置場所とリポジトリ内の構成
    - 既存の `.devcontainer/denv/` に依存しない認証情報の受け渡し方法
    - 新系統向けのセットアップ手順（既存の `docs/setup_windows.md` とは別立て）
  - **依存**: `deploy.sh` は現在 `tamuto/devenviron` を決め打ちしている。
    新系統の配布時にイメージ名を引数化するか、専用のデプロイ経路を用意する必要がある。
  - **依存**: 新系統のビルドにも 1 章と同等のマニフェスト記録の仕組みが要る。
    `etc/runtimes/` 配下のランタイムイメージにもまだ入っていないため、あわせて設計する。

- [ ] **3.4 必要要件の洗い出し**
  - Claude Code の認証情報（`~/.claude`）の永続化とマウント設計
  - remote-control の接続経路（ポート / トンネル / 認証）
  - 複数セッションの同時起動時のワークスペース分離とコンテナ命名
  - コンテナのライフサイクル（起動しっぱなしか、都度起動か）
  - ホスト側の Docker ソケットを渡すか否か（渡す場合の権限設計）

- [ ] **3.5 既存 devenviron との責務整理**
  - 現行 `devenviron` を維持するのか、段階的に新系統へ寄せるのかを決めて README に明記する。
  - メンバーが「どちらを使えばよいか」で迷わない状態にする。
  - 現時点では新系統の実体がないため、README への記載は 3.3 の実装後に行う。

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
  - `?ref=v0.41.0` のように取得元を明示できるようにし、
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

- [x] **9.5 `CLAUDE.md` の位置づけを変更**
  - 事実の記述（ディレクトリ構成、コマンド一覧、ベースイメージのバージョン、収録ソフト一覧）を全削除。
    これらが陳腐化の原因そのものであり、実際に `0.38.0` 表記のまま放置されていた。
  - **方針と禁止事項のみ**を残す構成に変更した。方針は陳腐化しないため、メンテ負担がほぼ消える。
    - 採用しない方針（CI ビルド / バージョン固定 / `latest` タグ）
    - 禁止事項（タグ上書き、`docker build` と `deploy.sh` の実行）
    - 変更時に連動する作業（`manifests/` のコミット、`Dockerfile.tmpl` の波及範囲）
    - 記述言語
  - 人間向けの情報は README / `docs/` に集約。README からは収録ソフトのバージョン記述を外し、
    `manifests/` を正の情報源として参照させる形にした。

- [x] **9.6 `docs/old/` の削除**
  - 全 7 ファイルを削除。最終更新 2023-09 の Podman 時代の資料。
  - `docs/old/commands.md` に記載されていたコマンド（`denv` `denvsh` `denvcli` `denvp`
    `denvdb` `denvdb5` `denv_clear_podman` `denvnote`）は **8 個すべて実体が存在しなかった**。
  - `config_misc.md` は 0 バイトだった。
