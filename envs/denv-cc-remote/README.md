# denv-cc-remote

Claude Code を Remote Control 付きで動かすための環境。

**コンテナは待機するだけで、セッションは [booth](../../tools/booth/README_ja.md) が
中の tmux に作る。** プロジェクトが増えても compose を編集する必要はなく、
`booth open <プロジェクト名>` で起こし、`booth close` で落とす。

devenviron をベースイメージとした派生イメージであり、
VSCode の devcontainer と同じ土台の上で動く。
どちらから作業しても同じ環境になるよう、
ベースイメージのバージョンは `envs/devcontainer/Dockerfile` と一致させている。

**devcontainer は前提としない。** セットアップ手順も devenviron 本体とは別系統となる。
このフォルダ一式（`Dockerfile` と `docker-compose.yaml`）を配布すれば、
各利用者が同じ環境を再現できる。

**このイメージ自体はレジストリへ公開しない。** バージョン番号も持たない。
環境の実体はベースイメージ側で固定されているため、
`Dockerfile` の `FROM` が指す devenviron のバージョンだけで環境が一意に定まる。

## 同梱しているもの

- **Claude Code** … ネイティブインストーラで導入。バックグラウンドで自動更新される。
- **Serena** … セマンティックなコード検索・編集ツールを提供する MCP サーバ。
  ツール本体のみ同梱している。MCP としての登録はセットアップ手順6で行う。
- **tmux** … booth がセッションを作る器。ベースイメージに含まれるため追加のビルドは要らない。

## 前提

- Docker および Docker Compose が利用できること
- booth を実行する側で `pnpx`（pnpm）が使えること。
  booth はコンテナの外から `docker compose exec` するため、
  ホストか、docker socket を持つ devcontainer のどちらかで動かす
- Claude Code を利用できるプラン（Pro / Max / Team / Enterprise / Console）のアカウント
  - 無料プランでは Claude Code を利用できない
- Team / Enterprise の場合、管理者が Remote Control を有効化していること

## セットアップ

### 1. ワークスペースの場所を指定する

`WORKSPACES_ROOT` に開発用フォルダのパスを指定する。未指定時は `/root/workspaces`。

このフォルダの下に置いたプロジェクトが、コンテナの `/workspaces` から見える。

```bash
export WORKSPACES_ROOT=/root/workspaces
```

毎回指定するのが面倒であれば、このディレクトリの `.env` に書いておく。
`.env` はリポジトリで管理しないため、書いてもコミットされない。

```
WORKSPACES_ROOT=/root/workspaces
```

### 2. 設定の置き場所をホスト側に用意する

Claude Code の設定と認証情報はホスト側へ保存する。
**bind mount のソースが存在しないと Docker がディレクトリとして作ってしまう**ため、
先に正しい型で実体を作っておくこと。

```bash
denv=$WORKSPACES_ROOT/.devcontainer/denv

mkdir -p $denv/.claude $denv/.ssh $denv/.aws $denv/.config
touch $denv/.gitconfig $denv/.git-credentials $denv/.npmrc
[ -s $denv/.claude.json ] || echo '{}' > $denv/.claude.json
```

`.claude.json` は空ファイルだと JSON として不正になるため `{}` で初期化する。

`.ssh` `.aws` `.gitconfig` `.git-credentials` `.npmrc` `.config` は
devcontainer 側と同じものを共有する。
**両者のマウント一覧は必ず揃えること。**
どちらから作業しても同じ環境になることを担保している以上、
参照する設定が環境によって変わるのは筋が通らない。

devenviron の `setup.sh` を実行済みであれば、これらは作成されている。
**逆に、この環境だけをセットアップした場合は用意されない。**
新規のマシンで cc-remote だけを立てる場合は必ず実施すること
（構造的な整理は TODO.md の 4.7 で扱う）。

### 3. 起動定義を確認する

`docker-compose.yaml` はそのまま使える。**コピーも編集も要らない。**

```yaml
services:
  denv:
    extends:
      file: compose.base.yaml
      service: denv-cc-remote
    hostname: denv

volumes:
  serena-data:
```

`command` と `working_dir` は書かない。待機はイメージの `CMD`（`sleep infinity`）が
担い、作業ディレクトリは booth がセッションごとに指定する。
**プロジェクトが増えてもこのファイルは触らない。**

`hostname` は**モバイルや claude.ai に表示されるデバイス名**になる。
指定しないと Docker が既定でコンテナ ID を hostname にするため、
16進の羅列が表示されて判別できない。サービスの識別にあたるものなので、
サービスを定義するこのファイルに書く。

環境ごとに変わる値は `compose.base.yaml` が環境変数から読むため、`.env` で与える。

| 変数 | 用途 | 既定 |
| --- | --- | --- |
| `WORKSPACES_ROOT` | 開発用フォルダの場所 | `/root/workspaces` |
| `TZ` | タイムゾーン | `Asia/Tokyo` |
| `DENV_BUILD_NETWORK` | ビルド中の RUN が使うネットワーク | `default` |

マウントを足すなど構成そのものを変える場合は `compose.base.yaml` を編集する。

ファイルは以下のように分かれている。

| ファイル | 内容 |
| --- | --- |
| `compose.base.yaml` | 共通設定（イメージ・マウント・環境変数） |
| `docker-compose.yaml` | 起動定義。そのまま使える |
| `.env` | 各自の環境の値。リポジトリでは管理しない |

デバイス名をプロジェクトごとに分けたい場合だけ、サービスを増やす選択肢がある。
詳しくは「複数プロジェクトを扱う」を参照。

### 4. イメージをビルドする

```bash
docker compose build
```

このイメージはレジストリへ公開していない。各利用者が手元でビルドして使う。
環境の実体はベースイメージ `tamuto/devenviron` 側で固定されているため、
誰がいつビルドしても同じ開発環境になる。

### 5. 初回のログインとワークスペース信頼の承認

ログインが済んでいないと booth は起動しきらず、
ワークスペースの信頼も一度承認しておく必要がある。
いずれも対話操作が必要なため、初回のみ手元で claude を起動して済ませる。

```bash
docker compose run --rm -w /workspaces/myproject denv claude
```

`-w` で対象のプロジェクトディレクトリを指定する。
信頼はディレクトリ単位で記録されるため、承認したい場所で起動する必要がある。

起動したら以下を行う。

1. ワークスペースの信頼を確認するダイアログを承認する
2. `/login` を実行し、ブラウザでサインインする
3. `/exit` で終了する

**ログインはアカウント単位で一度だけでよい**が、
**ワークスペースの信頼はディレクトリごとに承認が必要**である。
プロジェクトを増やしたら、そのディレクトリを `-w` に指定して同じ手順を一度実施する。
承認していない状態で `booth open` すると、booth が信頼ダイアログで止まっていることを
検出して報告するため、気づかないまま進むことはない。

認証情報と組織情報はホスト側の `.devcontainer/denv/.claude` および
`.devcontainer/denv/.claude.json` に保存されるため、次回以降このやり取りは不要になる。

### 6. MCP サーバを登録する

MCP の登録内容はイメージには含めていない。
ログインと同じく初回のみの手作業とし、
**利用者が好きな MCP を自由に入れられる**ようにしてある。

登録内容はホスト側の `.claude.json` に保存されるため、
一度登録すればコンテナを作り直しても残る。

**`--scope user` で登録すれば全プロジェクトで有効になる。**
`.claude.json` はすべてのサービスが同じファイルを bind mount しているため、
どのプロジェクトのコンテナからでも同じ MCP が使える。
プロジェクトごとに登録し直す必要はない。

同梱している Serena を登録する場合は以下。

```bash
docker compose run --rm denv \
  claude mcp add --scope user serena -- \
  serena start-mcp-server --context claude-code --project-from-cwd
```

任意の MCP を追加する場合も同じ要領で登録できる。

```bash
docker compose run --rm denv \
  claude mcp add --scope user <name> -- npx -y <package>
```

登録済みの一覧は以下で確認できる。

```bash
docker compose run --rm denv claude mcp list
```

**注意**: 永続化されるのは登録内容であってツール本体ではない。
コンテナ内で `uv tool install` や `npm install -g` を実行しても
`/root/.local` は永続化していないため、コンテナを作り直すと消える。
`npx -y <package>` や `uvx <package>` のように
起動のたびにコマンドが解決される形であれば問題なく使える。
常設したいツールがある場合は `Dockerfile` に追加する。

### 7. コンテナを起こす

```bash
docker compose up -d
```

コンテナは `sleep` で待機するだけで、この時点では Claude Code は動いていない。

### 8. セッションを開始する

セッションは [booth](../../tools/booth/README_ja.md) が作る。設定を一度だけ書く。

```bash
pnpx @infodb/booth init             # カレントに雛形を書き出す
mkdir -p ~/.config/booth
mv booth.toml ~/.config/booth/      # どこからでも使えるようにする
```

この環境に合わせるのは `compose_file` と `service` の 2 つだけでよい。

```toml
[targets.denv]
# WORKSPACES_ROOT を展開する仕組みは無いため、絶対パスで書く
compose_file = "/root/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
service = "denv"
```

セッションを起こす。名前は `/workspaces` 直下のフォルダ名を指定する。

```bash
pnpx @infodb/booth open myproject
```

[claude.ai/code](https://claude.ai/code) またはスマートフォンの Claude アプリの
セッション一覧に現れるので、そこから開く。

送る・見る・状態を確認するといった操作は
[tools/booth](../../tools/booth/README_ja.md) を参照。

### 9. セッションを終了する

```bash
pnpx @infodb/booth close myproject
```

コンテナごと落とす場合は以下。認証情報はホスト側に保存されているため保持される。

```bash
docker compose down
```

## 注意事項

### 設定してはいけない環境変数

remote-control は機能フラグの評価結果に依存しているため、
以下を設定すると利用できなくなる。

- `DISABLE_TELEMETRY`
- `DO_NOT_TRACK`
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
- `DISABLE_GROWTHBOOK`

また `ANTHROPIC_BASE_URL` を `api.anthropic.com` 以外へ向けている場合も利用できない。
Amazon Bedrock / Google Cloud's Agent Platform / Microsoft Foundry 経由でも利用できない。

### ポート公開は不要

remote-control は claude.ai への外向き接続で成立する。
コンテナ側で待ち受けるポートはないため、ポートの公開設定は不要。

### コンテナ内からの docker 利用

ベースイメージに docker CLI が入っており、
`compose.base.yaml` でホストの `/var/run/docker.sock` をマウントしている。
コンテナ内から `docker` / `docker compose` をそのまま使えるが、
起動するのはホスト上の兄弟コンテナであり、
`-v` のパスがホスト基準で解釈される点に注意する。
`/workspaces` に対応するホスト側のパスは `DENV_HOST_WORKSPACES` で参照できる。

詳細は [docs/docker.md](../../docs/docker.md) を参照。

### Serena MCP について

ツール本体のみイメージに同梱している。
**MCP としての登録は利用者が行う**（セットアップ手順6）。

イメージ側で登録しないのは、ユーザスコープの MCP 登録先が `~/.claude.json` であり、
このファイルを組織情報の永続化のためホスト側から bind mount しているためである。
イメージへ焼き込んでも覆い隠されて効かない。
また登録内容を利用者が自由に決められる方が都合がよい。

接続状態は Claude Code 内で `/mcp` を実行すると確認できる。

```
serena start-mcp-server --context claude-code --project-from-cwd
```

`--project-from-cwd` により、起動時のカレントディレクトリが対象プロジェクトになる。
コンテナの作業ディレクトリは `/workspaces` である。

初回利用時は対象言語の language server を取得するため、起動に時間がかかることがある。
このため `MCP_TIMEOUT=60000` を設定してある。
取得したものとプロジェクトのインデックスは名前付きボリューム `serena-data`
（`/root/.serena`）に保存されるため、次回以降は速くなる。

登録内容を確認したい場合は以下。

```bash
docker compose exec denv claude mcp list
docker compose exec denv claude mcp get serena
```

### モバイルでの表示名

表示名には2種類ある。混同しやすいので整理しておく。

| 表示 | 決まり方 | 指定方法 |
| --- | --- | --- |
| デバイス名 | コンテナの hostname | compose の `hostname:` |
| セッション名 | booth 名。booth が `claude --remote-control <名前>` に渡す | `booth open <名前>` |

セッション名は booth 名がそのまま入るため、compose 側で指定するものは無い。
デバイス名は hostname のままなので、`hostname:` を指定しないとコンテナ ID が表示される。

**1 コンテナに複数の booth を同居させると、デバイス名は全セッションで同じになる。**
区別はセッション名で行う。デバイス名でも分けたい場合は「複数プロジェクトを扱う」を参照。

### バージョンについて

**このイメージ自身はバージョン番号を持たない。**
基準となるのは `Dockerfile` の `FROM` が指す devenviron のバージョンだけである。
派生イメージ側にも番号を振ると、どちらがどの環境を指すのか読み取れなくなるため。

Claude Code のネイティブインストーラは
バックグラウンドで自動更新するため、バージョンは固定していない。
「常に最新を導入する」という本プロジェクトの方針とも一致する。

Serena は自動更新されないため、ビルドした時期によってバージョンが変わる。
利用者間で揃える必要が生じた場合は、`Dockerfile` で
`serena-agent==<version>` のように指定すればよい。

このためこのイメージにビルドマニフェストは用意していない。
記録が必要な構成はベースイメージ側が `/etc/devenviron/manifest.txt` に持つ。

```bash
docker compose exec denv cat /etc/devenviron/manifest.txt
```

## トラブルシューティング

### 起動時に `not a directory` / `Are you trying to mount a directory onto a file`

```
error mounting ".../.devcontainer/denv/.claude.json" to rootfs at "/root/.claude.json":
create mountpoint for /root/.claude.json mount: cannot create subdirectories in
".../merged/root/.claude.json": not a directory
```

bind mount のソースとマウント先で型が食い違っている。
ホスト側の `.claude.json` が**ディレクトリ**になっているのが原因である。

実体を用意する前にコンテナを起動すると、Docker はソースを
**ディレクトリとして**作る。一方イメージ側の `/root/.claude.json` は
ファイルであり（claude のインストーラがビルド時に生成する）、
そこへディレクトリを被せられないため起動に失敗する。

```bash
denv=$WORKSPACES_ROOT/.devcontainer/denv
ls -la $denv      # ファイルであるべきものが d で始まっていないか

for f in .claude.json .gitconfig .git-credentials .npmrc; do
  [ -d "$denv/$f" ] && rmdir "$denv/$f" && echo "removed dir: $f"
done

mkdir -p $denv/.claude $denv/.ssh $denv/.aws $denv/.config
touch $denv/.gitconfig $denv/.git-credentials $denv/.npmrc
[ -s $denv/.claude.json ] || echo '{}' > $denv/.claude.json
```

`rmdir` は中身があると失敗する。失敗した場合は
Docker が作った空ディレクトリではないため、中身を確認してから判断すること。

**`.gitconfig` / `.git-credentials` / `.npmrc` も併せて確認すること。**
これらはイメージ側に実体が無いためディレクトリのままでもマウントが通ってしまい、
git が認証情報を読めないという形で後から表面化する。

### ビルド中に `Temporary failure in name resolution`

```
error: Failed to fetch: `https://.../serena-agent/`
  Caused by: dns error: failed to lookup address information: Temporary failure in name resolution
```

ビルド中のコンテナから名前解決ができていない。
取得先のホストの問題ではなく、docker の bridge ネットワーク側で
DNS が引けていない状態である（NXDOMAIN ではなく resolver への到達失敗）。
**Jetson で発生する。** ベースイメージ側のJetson向けビルドスクリプトが
`--network host` を付けているのも同じ理由である。

まず切り分ける。前者だけ失敗するなら bridge の DNS の問題である。

```bash
docker run --rm <ベースイメージ> getent hosts pypi.org
docker run --rm --network host <ベースイメージ> getent hosts pypi.org
```

該当する場合は、ビルド時のネットワークに host を指定する。
`compose.base.yaml` の `build.network` を環境変数で切り替えられるようにしてある。

```bash
DENV_BUILD_NETWORK=host docker compose build
```

毎回指定するのが面倒であれば、`.env` に書いておく。

```
DENV_BUILD_NETWORK=host
```

なお、この設定が効くのは**ビルド中**だけである。
起動後のコンテナのネットワークには影響しない。

### `Unable to determine your organization for Remote Control eligibility`

ログインには成功しているのに remote-control が起動できない場合、
**`~/.claude.json` が永続化されていない**ことが原因である可能性が高い。

Claude Code は認証トークンを `~/.claude/.credentials.json` に、
組織情報（`oauthAccount`）と Remote Control の可否判定に使う機能フラグのキャッシュを
`~/.claude.json` に、それぞれ別々に保存する。
後者が失われると、トークンはあるのに組織が判定できない状態になる。

以下を確認する。

```bash
# ホスト側に実体があるか。ディレクトリになっていたら誤り
ls -la $WORKSPACES_ROOT/.devcontainer/denv/.claude.json

# コンテナ内から中身が見えているか
docker compose exec denv sh -c 'ls -la /root/.claude.json; wc -c /root/.claude.json'
```

`.claude.json` が 0 バイトのままであれば、セットアップ手順5のログインをやり直す。

なお以下を設定していると、機能フラグの評価自体が止まって同様に利用できなくなる。

- `DISABLE_TELEMETRY` / `DO_NOT_TRACK`
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` / `DISABLE_GROWTHBOOK`
- `ANTHROPIC_BASE_URL` を `api.anthropic.com` 以外へ向けている

### セッションが信頼ダイアログで止まる

`booth open` が `blocked on the trust dialog` で終わる場合、
そのディレクトリの**ワークスペース信頼が未承認**である。

信頼はディレクトリ単位で管理され、親ディレクトリの承認も、
同じリポジトリの別 worktree の承認も引き継がれない。
たとえば `/workspaces/foo` を承認済みでも、
その worktree である `/workspaces/foo.feature-xxx` は別途承認が必要になる。

承認済みかどうかは `.claude.json` で確認できる。

```bash
python3 -c "
import json
d = json.load(open('$WORKSPACES_ROOT/.devcontainer/denv/.claude.json'))
for path, v in d.get('projects', {}).items():
    print(v.get('hasTrustDialogAccepted'), path)
"
```

対象のディレクトリが一覧に無い、または `False` であれば未承認である。
一度だけ対話で起動して承認する。

```bash
docker compose run --rm -w /workspaces/myproject denv claude
#   → ワークスペースの信頼を承認 → /exit
```

**ダイアログの既定の選択は「No, exit」である。** Enter を押すと承認ではなく終了する。

### MCP サーバが認識されない

まず登録されているかを確認する。

```bash
docker compose exec denv claude mcp list
```

何も出てこない場合はセットアップ手順6を実施していない。

登録したのに残らない場合は、`.claude.json` の永続化が効いていない。
ユーザスコープの登録内容はこのファイルに保存されるため、
永続化されていないとコンテナを作り直すたびに消える。

```bash
# ホスト側。ディレクトリになっていたら誤り。{} だけなら未登録
cat $WORKSPACES_ROOT/.devcontainer/denv/.claude.json | head -c 200

# コンテナ内から同じ内容が見えているか
docker compose exec denv head -c 200 /root/.claude.json
```

MCP は登録されているが起動に失敗する場合は、
そのコマンドがコンテナ内で解決できるかを確認する。

```bash
docker compose exec denv which serena
```

`/root/.local` は永続化していないため、
コンテナ内で後から `uv tool install` や `npm install -g` で入れたツールは
コンテナを作り直すと消える。常設したいものは `Dockerfile` に追加すること。

## 複数プロジェクトを扱う

**compose を編集する必要はない。** booth 名を変えて開くだけで、
1 つのコンテナの中に tmux セッションが並ぶ。

```bash
pnpx @infodb/booth open myproject
pnpx @infodb/booth open another
```

**claude のプロセス数は減らない。** 1 セッションにつき 1 プロセスなので、
常用するものだけ開いておき、使い終わったら `booth close` で落とすとよい。

**プロジェクトを追加したら、そのディレクトリの信頼承認を行うこと。**
未承認のまま `open` すると booth が信頼ダイアログで止まっていることを報告する。

全コンテナがワークスペースのツリー全体をマウントしているため、
別のセッションでも同じフォルダを指していれば当然衝突する。
booth 名がフォルダ名と一対一である限り同じ場所を二重に開くことはないが、
書き込み自体はツリー全体に届く。並行して作業する場合は
先に git worktree でフォルダを分け、それぞれに booth を開くとよい。

### デバイス名をプロジェクトごとに分ける

claude.ai 上の**デバイス名はコンテナの hostname** なので、
1 つのコンテナに同居させると全セッションで同じ名前になる。
デバイス名でも見分けたい場合は、プロジェクトごとにサービスを立てる。
**この場合だけ `docker-compose.yaml` を編集する。**

```yaml
services:
  myproject:
    extends:
      file: compose.base.yaml
      service: denv-cc-remote
    hostname: myproject

  another:
    extends:
      file: compose.base.yaml
      service: denv-cc-remote
    hostname: another
```

booth 側は `service` に `{name}` と書く。booth 名と同じ名前のサービスへ入る。

```toml
[targets.denv]
compose_file = "/root/workspaces/.devcontainer/denv-cc-remote/docker-compose.yaml"
service = "{name}"
```

コンテナが増えるぶんメモリを使う。デバイス名を分ける必要が無ければ、
1 コンテナに同居させる形で足りる。
