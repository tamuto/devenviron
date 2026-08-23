# Dockerイメージのビルド

- ./scriptsの下にビルド用のコマンドが用意されているため、こちらをカスタマイズして利用する。
- スクリプトの基本的な内容としては、Dockerfile内の文字を置き換えてビルドを行っている。
- ベースイメージおよびアーキテクチャを置き換えるなどのカスタマイズが可能。

**イメージのビルドはローカル実行に統一している。CIによるビルドは採用していない。**
Jetson(L4T)系のイメージは実機でのビルドが前提でCI環境では再現できず、
x86系だけをCI化するとビルド経路が二系統に分かれて管理が破綻するため。
この他の方針については[TODO.md](../TODO.md)の「0. 前提方針」を参照。

## ビルドの実行

```bash
./scripts/build_py3_13.sh <image-tag>
```

## 環境別の設定

ベースイメージやアーキテクチャ以外にも、ターゲットごとに変えたい設定がある。
これらは`Dockerfile.tmpl`に`ARG`として口を用意し、
ビルドスクリプト側から`--build-arg`で渡す。

テンプレートの`{{...}}`置換とは使い分ける。
置換は「Dockerfileの記述そのものが変わるもの」（ベースイメージ名・アーキテクチャ）に使い、
`ARG`は「値だけが変わるもの」に使う。値のためにsedを増やすと、
未指定のターゲットで空文字が埋め込まれる事故が起きる。

### pipインデックス（`DENV_PIP_INDEX_URL`）

Jetson向けのイメージでは、Jetson用にビルドされたwheelを取得するため
[jetson-ai-lab](https://pypi.jetson-ai-lab.io/)のインデックスを指定する。

```sh
# scripts/build_torch_2.7-r36.4.0-cu128-24.04.sh
DENV_PIP_INDEX_URL="https://pypi.jetson-ai-lab.io/jp6/cu128"
```

未指定ならPyPIを使う。x86向けのスクリプトでは空にしてある。

このインデックスはdevpiで動いており**PyPIをミラーしている**。
このためJetson固有のwheelも通常のパッケージも同じインデックスから取得できる。
`PIP_EXTRA_INDEX_URL`ではなく`PIP_INDEX_URL`で足りるのはこのためである。

インデックスは`jp6/cu126`と`jp6/cu128`が存在する（`cu122`は無い）。
**実機のCUDAバージョンと一致するものを指定すること。**
一致しないwheelを掴むと実行時に初めて問題が出る。

指定した値は`ENV`としてイメージに残るため、コンテナ内での`pip install`にも効く。
ビルドマニフェストの`pip index`にも記録される。

### パッケージマネージャごとの対応状況

**`uv`は`PIP_INDEX_URL`を読まない。** uvが見るのは`UV_DEFAULT_INDEX`
（旧`UV_INDEX_URL`）である。このため同じ値を両方へ設定して揃えている。

```dockerfile
ENV PIP_INDEX_URL="${DENV_PIP_INDEX_URL:-https://pypi.org/simple}"
ENV UV_DEFAULT_INDEX="${DENV_PIP_INDEX_URL:-https://pypi.org/simple}"
```

未指定時の`https://pypi.org/simple`はpipとuvの既定値そのものであるため、
指定しない場合の挙動は変わらない。

**`poetry`は対象外である。** イメージ側から参照先PyPIを差し替える手段が無い。
Poetry 1.x にあった`POETRY_PYPI_MIRROR_URL`は2.x で廃止されており、
2.x に残る`POETRY_REPOSITORIES_<NAME>_URL`は**公開（publish）先**の指定であって
取得元ではない。`PyPiRepository`の参照先URLは実装内で固定されている。

Poetryで別のインデックスを使う場合はプロジェクト側で指定する。

```bash
poetry source add --priority=primary jetson https://pypi.jetson-ai-lab.io/jp6/cu128
```

これは`pyproject.toml`に`[[tool.poetry.source]]`として記録されるため、
そのプロジェクトを扱う全員に効く。イメージ側で面倒を見るより筋がよい。

## イメージの系統

現在2系統を併走させている。バージョン体系が異なるため取り違えないこと。

**レジストリへ公開するイメージは`tamuto/devenviron`だけである。**

`envs/`配下の各環境（devcontainer / denv-cc-remote）は、
このベースイメージを継承して各利用者の手元でビルドする。公開はしない。

### 公開するのはx86向けのみ

**Docker Hubへ公開するのは`linux/amd64`のイメージだけである。**
Jetson(L4T)向けは実機でのビルドが前提のため、レジストリには置かない。

このため**Jetson上で作業する場合は、まずベースイメージを実機でビルドする**必要がある。
ビルドスクリプトは`docker.io/tamuto/devenviron:<tag>`のタグを付けるため、
実機のローカルイメージがレジストリのタグを覆う形になる。

```bash
./scripts/build_torch_2.7-r36.4.0-cu128-24.04.sh <image-tag>
```

ローカルに該当タグが無い状態で`envs/`配下をビルドすると、
`FROM tamuto/devenviron:<tag>`がレジストリのamd64イメージを取得してしまう。
Jetson上ではエミュレーション実行になり、原因の分かりにくい失敗につながる。
迷ったらアーキテクチャを確認する。

```bash
docker image inspect tamuto/devenviron:<tag> --format '{{.Architecture}}'
```

この結果、**バージョン番号を持つのはベースイメージだけ**になる。
派生イメージ側にも番号を振ると、
どちらがどの環境を指すのか読み取れなくなるため持たせていない。
「どのdevenvironの上に構築されたか」で環境が一意に定まる。

**バージョン体系はCalVer `YYYY.MM.<patch>`（例 `2026.08.1`）である。**
`<patch>`は同一月内に再ビルドした場合の区別に使う。

CalVerを採るのは、「常に最新を導入する」方針では
イメージの中身が実質ビルド時期で決まるためである。
SemVerの`0.42.0`は中身について何も語らないが、
`2026.08.0`という番号自体が「2026年8月時点の最新構成」を表すことになり、方針と意味が一致する。

`0.41.0`以前のdevenvironはSemVerで発行されている。
`2026.08.1`以降がCalVerとなるが、日付形式が明らかに異なるため新旧の区別は付く。
過去のタグを振り直すことはしない（タグ不変ポリシーのため）。

**本ドキュメントのビルド・リリース手順は既存系統（`tamuto/devenviron`）を対象とする。**
新系統はdevcontainerを前提とせず、セットアップ手順そのものが別系統となるため、
実装時に別途ドキュメントを用意する。

## タグの運用ルール

- **一度pushしたイメージタグは上書きしない。**
  中身を変える場合は必ず新しいタグを発行する。
  メンバー間の環境統一は「同じタグ = 同じイメージ」で担保しているため。
- **`latest`タグは使用しない。**
  マルチアーキ構成のため、別アーキのイメージが既存の`latest`を上書きする事故が起きる。
  またタグ不変ポリシーとも本質的に相容れない。

`deploy.sh`はこれらを機械的にチェックし、違反する場合はpushせずに停止する。

## リリース手順

権限を持っている場合に実行可能。

### 1. イメージをビルドする

```bash
./scripts/build_py3_13.sh 2026.09.0
```

### 2. ビルドマニフェストをコミットする

ビルド時に`manifests/devenviron-2026.09.0.txt`が自動生成される。
バージョン固定を行わない方針のため、この記録が実質的な唯一の変更履歴となる。

```bash
git add manifests/devenviron-2026.09.0.txt
git commit -m "2026.09.0のビルドマニフェストを追加"
```

### 3. Docker Hubへpushする

```bash
./deploy.sh 2026.09.0
```

以下をすべて満たさない場合はpushせずに停止する。

- ローカルに対象イメージが存在すること
- `manifests/devenviron-<image-tag>.txt` が存在すること
- レジストリに同名タグが**存在しないこと**（タグ不変ポリシー）

やむを得ず上書きする場合のみ`./deploy.sh --force 2026.09.0`を使う。原則使用しない。

### 4. 配布するバージョンを更新する

devenviron を土台とする派生イメージ側の`FROM`を、新しいタグへ書き換える。
**両方を必ず同じバージョンに揃えること。**
VSCode から作業しても remote-control から作業しても同じ環境になることを、
これで担保している。

- `envs/devcontainer/Dockerfile` … VSCode devcontainer 用
- `envs/denv-cc-remote/Dockerfile` … remote-control 用

```dockerfile
FROM tamuto/devenviron:2026.09.0
```

**この2ファイル以外にバージョン番号を書かないこと。**
README・TODO.md・その他ドキュメントには記載しない。
過去に複数箇所へ記載した結果、実際に乖離が発生している。

### 5. リポジトリにタグを打つ

イメージタグとgitタグを一致させ、
「そのイメージがどのコミットの定義から作られたか」を追えるようにする。
イメージ側にも`org.opencontainers.image.revision`としてコミットハッシュが記録されている。

```bash
git commit -am "配布バージョンを2026.09.0へ更新"
git tag v2026.09.0
git push && git push --tags
```

## ビルドマニフェスト

DevEnvironは「常に最新を導入する」方針のため、ソフトウェアのバージョン固定を行わない。
そのため、あるタグに何が入っているかは**ビルドした時点の状況で決まる**。
その情報を失わないよう、ビルド時点の構成を記録している。

### 記録先

- イメージ内: `/etc/devenviron/manifest.txt`
- リポジトリ: `manifests/devenviron-<image-tag>.txt` （ビルドスクリプトが自動生成）

記録内容は、OS情報・主要ツールチェインのバージョン・pipパッケージ一覧・aptパッケージ一覧。

### 確認方法

```bash
# コンテナ内から
cat /etc/devenviron/manifest.txt

# タグ間の差分（何のバージョンが上がったか）
git diff --no-index manifests/devenviron-2026.08.1.txt manifests/devenviron-2026.09.0.txt

# イメージのラベル（バージョン・コミット・ベースイメージ・ビルド日時）
docker inspect --format '{{json .Config.Labels}}' docker.io/tamuto/devenviron:<image-tag>
```

### 手動での取り出し

```bash
./scripts/manifest.sh <image-tag>
```

生成された `manifests/` 配下のファイルは、ビルドのたびにコミットすること。
この記録は「一度pushしたイメージタグは上書きしない」というタグ不変ポリシーと
セットで機能する。
