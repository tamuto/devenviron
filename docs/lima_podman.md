# Lima + Podman

## インストール

```
brew install lima
```

## VMの作成

* 本プロジェクト内のmac/default.yamlを使用しLima VMを作成する。

```
limactl start default.yaml
```

## 実行

```
limactl shell --workdir /home/(id).linux default
```
