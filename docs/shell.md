# コンテナ内のシェル環境

devenvironは、コンテナ内のbashへ共通の設定を用意している。
プロンプトのgitブランチ表示や補完がそれである。

その実体は **`/etc/devenviron/bashrc.sh`** で、リポジトリ上は
`template/container/resources/bashrc.sh` にある。

## 読み込みのされ方

ファイルを置いただけでは読まれない。
ビルド時に`/root/.bashrc`の**末尾へ以下を追記**しており、これが呼び出し口になる。

```bash
# devenviron が用意する共通のシェル設定。
if [ -f /etc/devenviron/bashrc.sh ]; then
    . /etc/devenviron/bashrc.sh
fi
```

bashは起動の仕方によって読むファイルが変わる。経路ごとの流れは以下。

### 対話・非ログインシェル

`docker exec -it` / `docker compose exec` / VSCodeのターミナルなど、
**普段の作業で使うのはこの経路**である。

```
bash
  → /etc/bash.bashrc              システム全体の設定（ベースイメージのもの）
  → ~/.bashrc                     ベースイメージのものがそのまま残っている
      …ベース由来の内容…
      …voltaのインストーラが追記したPATH…
      . /etc/devenviron/bashrc.sh ← 末尾に追記した3行から呼ばれる
```

この経路でbashが読む利用者側のファイルは`~/.bashrc`だけである。
`/etc/profile.d/`はログインシェル専用のため、ここでは読まれない。
**`~/.bashrc`へ書き込む以外に手段がない**のはこのためである。

### ログインシェル

`bash -l`やsshでの接続。

```
bash -l
  → /etc/profile → /etc/profile.d/*
  → ~/.profile
      if [ "$BASH" ]; then . ~/.bashrc; fi   Debianの.profileが.bashrcを呼ぶ
  → ~/.bashrc → /etc/devenviron/bashrc.sh
```

### 非対話

`docker run <image> node -v`のようなコマンド直接実行や、
Dockerfileの`RUN`、シェルスクリプトの実行。

**この経路では何も読まれない。** これは想定どおりである。
非対話でも必要な`PATH`はDockerfileの`ENV`が持っているため、
`docker run <image> node -v`はシェル設定なしで成立する。

### まとめ

| 起動の仕方 | 例 | `/etc/devenviron/bashrc.sh` |
| --- | --- | --- |
| 対話・非ログイン | `docker exec -it`, VSCodeのターミナル | 読まれる |
| ログイン | `bash -l`, ssh | 読まれる（`~/.profile`経由） |
| 非対話 | `docker run <image> node -v`, `RUN` | 読まれない |

実際にどちらなのかは`$-`で判別できる。`i`が含まれていれば対話シェルである。

```bash
echo $-                       # himBCHc なら対話
shopt -q login_shell && echo login
```

## 設定している内容

| 内容 | 目的 |
| --- | --- |
| `PS1` | カレントディレクトリとgitブランチを表示する（`__git_ps1`） |
| bash補完 | `bash-completion`のフレームワークを読み込む |
| volta の`PATH` | `ENV`を持たないベースイメージ向けのフォールバック |
| `set -o noclobber` | `>`による既存ファイルの上書きを防ぐ。上書きしたい場合は`>|` |
| `alias ncu` | `pnpx npm-check-updates` |

いずれも存在確認をしてから適用しているため、
ベースイメージを差し替えて対象が無くなってもシェルの起動は壊れない。

### bash補完について

Debianの`/etc/bash.bashrc`は、bash-completionを読み込む箇所が
**コメントアウトされたまま**配布されている。
そのためパッケージを導入するだけでは補完は有効にならず、
`bashrc.sh`から明示的にフレームワークを読み込んでいる。

フレームワークさえ読み込めば`/usr/share/bash-completion/completions/`配下は
遅延ロードされるため、コマンドごとに個別の`source`は要らない。

## 個人の設定を足す

`/etc/devenviron/bashrc.sh`は**編集しない**。
イメージに焼かれているため、コンテナを作り直すと元に戻る。

利用者個人の設定のために`~/.bashrc`と`~/.bash_aliases`を空けてある。
`~/.bashrc`の末尾に以下を足しておくと、追記の入り口が分かれて扱いやすい。

```bash
if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi
```

devenviron側の読み込みは`~/.bashrc`の末尾にあるため、
そこより後に書いたものが最終的に優先される。
`PS1`を自分の好みへ変えたい場合もここで上書きすればよい。

**ただし`~/.bashrc`は永続化していない。**
bind mountしているのは`.ssh` / `.aws` / `.gitconfig` / `.config`などであり、
`.bashrc`はその一覧に入っていない（`envs/devcontainer/devcontainer.json`の`mounts`と
各remote環境の`compose.base.yaml`の`volumes`を参照）。
`docker restart`や`exec`では残るが、**コンテナを作り直すと消える**。

残したい場合の選択肢は2つ。

1. マウント一覧へ`.bashrc`を追加する。ただし全環境で揃える必要がある。
2. 個人設定ではなく環境の共通設定と判断し、`bashrc.sh`へ入れてイメージを作り直す。

## 経緯

もともとは`resources/bash_aliases`というファイルを`/root/.bashrc`として
COPYしていた。これには2つの問題があった。

- **ベースイメージの`.bashrc`を丸ごと消していた。**
  voltaのインストーラが`.bashrc`へ追記したPATH設定も一緒に失われていた。
- **ファイル名が中身と一致していなかった。**
  aliasだけでなくPATH / PS1 / 補完を設定しており、実態はシェル設定そのものだった。

`/etc/devenviron/`へ移したのは、`manifest.txt`と同じく
「devenvironが持ち込んだもの」を集める場所であり、所有が明確になるため。
`~/.bash_aliases`へ置く案もあったが、そこは利用者個人の拡張点であり、
devenvironが占有すると各自が自分の設定を置けなくなるため採らなかった。

読み込みを`~/.bashrc`の**末尾**にしているのにも理由がある。
Ubuntu系のベースイメージは`/root/.bashrc`自身が`PS1`を設定するため、
`/etc/bash.bashrc`側へ置くとgitブランチ表示のプロンプトが上書きで消える。
