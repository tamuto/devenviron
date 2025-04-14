# Runtimes

- 軽量ランタイムイメージ

## ビルド

```bash
./build.sh folder tag
```

## 実行

- devcontainer.jsonのマウントを前提に必要なパスへ変更する
- 実行するイメージやコマンドは各自調整する

```bash
export WORKSPACES_ROOT=/root/workspaces
docker run --rm -d \
  -v $WORKSPACES_ROOT:/workspaces \
  -v $WORKSPACES_ROOT/.devcontainer/denv/.ssh:/root/.ssh \
  -v $WORKSPACES_ROOT/.devcontainer/denv/.aws:/root/.aws \
  -v $WORKSPACES_ROOT/.devcontainer/denv/.gitconfig:/root/.gitconfig \
  -v $WORKSPACES_ROOT/.devcontainer/denv/.git-credentials:/root/.git-credentials \
  -v $WORKSPACES_ROOT/.devcontainer/denv/.npmrc:/root/.npmrc \
  -v $WORKSPACES_ROOT/.devcontainer/denv/.config:/root/.config \
  <image>:<tag> \
  <command>
```

### MCPサーバ利用時

- 以下はWSL2経由でDocker起動時の場合。
- マウントするボリュームは各自調整。
- `docker run ...`の部分は1行で書く必要がある

```json
    "my-test": {
      "command": "wsl.exe",
      "args": [
        "-e",
        "bash",
        "-l",
        "-c",
        "docker run --rm -i -v /root/workspaces:/workspaces <image>:<tag> <command>
      ]
    }
```
