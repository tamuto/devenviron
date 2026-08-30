# コンテナ内からのdocker利用

devenvironのコンテナ内で`docker`コマンドが使える。
コンテナの中でデーモンを動かしているわけではなく、
**ホスト側のdockerデーモンを操作している**（docker-outside-of-docker）。

- イメージに入れているのはクライアントだけ（`docker-ce-cli` / buildx / compose plugin）。
- ホストの`/var/run/docker.sock`をコンテナへマウントし、これ経由でホストのデーモンへ指示を出す。
- そのため、コンテナ内から起動したコンテナは**ホスト上の兄弟コンテナ**になる。
  devenvironの内側にできるわけではない。

デーモンをコンテナ内で動かす方式（docker-in-docker）は採っていない。
特権コンテナが必要になるうえ、ホスト側とイメージキャッシュを共有できず、
開発中のビルドを毎回やり直すことになるため。

## 有効化

`envs/`配下の各環境とも設定済みで、追加の作業は不要。

- devcontainer … `devcontainer.json`の`mounts`
- denv-cc-remote … `compose.base.yaml`の`volumes`

動作確認は以下で行う。

```bash
docker version    # Client / Server の両方が表示されればソケットが通っている
docker compose version
```

`Cannot connect to the Docker daemon` となる場合はソケットがマウントされていない。
ホスト側でdockerが起動しているか、
rootlessモードなどで`/var/run/docker.sock`以外のパスを使っていないかを確認する。
rootlessの場合はマウント元を`/run/user/$(id -u)/docker.sock`へ読み替える。

## 注意点

### 1. パスはすべてホスト基準で解釈される

`-v`のソースや`docker compose`が読むビルドコンテキストは、
コンテナ内のパスではなく**ホストのパス**としてデーモンへ渡る。
`/workspaces`はコンテナ内だけの見え方なので、そのままでは意図した場所にならない。

`/workspaces`に対応するホスト側のパスを`DENV_HOST_WORKSPACES`として渡している。

```bash
# 誤り。ホスト側の /workspaces/myproject を探しに行く
docker run --rm -v /workspaces/myproject:/app alpine ls /app

# 正しい
docker run --rm -v "$DENV_HOST_WORKSPACES/myproject:/app" alpine ls /app
```

`docker build`のコンテキストも同様に、ホストから見えるパスである必要がある。
ワークスペース配下であればホストにも同じ実体があるため、
上記の読み替えさえすれば問題なく通る。

### 2. 起動したコンテナはホストのネットワークにいる

兄弟コンテナのため、devenviron側から`localhost`では届かない。
`host.docker.internal`（両環境とも引けるようにしてある）を使うか、
ポートを公開して`host.docker.internal:<port>`で接続する。

### 3. ソケットのマウントはホストのroot権限に等しい

dockerデーモンへ接続できるということは、
ホストの任意のパスをマウントしたコンテナを起動できるということであり、
実質的にホストのroot権限を持つことと同じである。

devenvironは元々「自分の開発機で自分の権限で動かす」前提の環境であり、
コンテナも`remoteUser: root`で動かしている。その前提の上での機能である。
共有マシンや、第三者のコードを検証する用途では、この点を理解した上で使うこと。
