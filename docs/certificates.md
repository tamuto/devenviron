# 信頼ストアへ追加している証明書

`ca-certificates` にまだ収録されていないルート証明書を、
イメージ側で信頼ストアへ追加している場合がある。
何をどの理由で信頼させているかをここに記録する。

追加している証明書の実体は `template/container/resources/certs/` にあり、
ビルド時に `/usr/local/share/ca-certificates/` へ配置して
`update-ca-certificates` で登録している。

コンテナ内では以下で確認できる。ビルドマニフェストにも記録される。

```bash
cat /etc/devenviron/manifest.txt | sed -n '/Extra CA certificates/,/^====/p'
```

## SECOM TLS RSA Root CA 2024（クロスルート証明書）

**暫定措置である。** `ca-certificates` が新ルートを収録した時点で削除する。

### 経緯

JPRSは2026年6月17日以降に発行するサーバー証明書を、
新しい中間CA（`JPRS DV RSA CA 2024 G1` / `JPRS OV RSA CA 2024 G1`）へ切り替えた。
これらの中間CAの発行元は新ルート **`SECOM TLS RSA Root CA 2024`** である。

このルートはまだ `ca-certificates` に収録されていないため、
そのままでは2026年6月17日以降に発行された証明書を検証できない。

```
error 20 at 0 depth lookup: unable to get local issuer certificate
```

JPRSは新ルートの配布が完了するまでの措置としてクロスルート証明書を配布している。
これは新ルートを、既に広く配布されている
`Security Communication RootCA2` で署名し直したものである。
これを信頼ストアへ加えることで、既存のルートを起点に検証できるようになる。

- JPRSの案内: https://jprs.jp/pubcert/service/certificate/
- 配布元: https://repository.secomtrust.net/SC-Root2/tlsrsarootca2024cross-pem.cer

### 収録している証明書

| 項目 | 値 |
| --- | --- |
| ファイル | `template/container/resources/certs/SECOM_TLS_RSA_Root_CA_2024_cross.crt` |
| Subject | `C=JP, O=SECOM Trust Systems Co., Ltd., CN=SECOM TLS RSA Root CA 2024` |
| Issuer | `C=JP, O=SECOM Trust Systems CO.,LTD., OU=Security Communication RootCA2` |
| シリアル番号 | `22 b9 b1 ad 80 e6 58 82 56 d0 70 53 0f 78 52 2d` |
| SHA-1 | `86 3b 41 07 ce fb 4c 92 27 fe de 62 0e a7 28 6d 23 72 5c 52` |
| 有効期間 | 2025/04/09 〜 2029/05/29 |

シリアル番号とフィンガープリントはJPRSの案内ページに掲載されている値と一致することを
確認済みである。差し替える場合も必ず掲載値と照合すること。

```bash
openssl x509 -in template/container/resources/certs/SECOM_TLS_RSA_Root_CA_2024_cross.crt \
  -noout -subject -issuer -serial -dates -fingerprint -sha1
```

### 動作確認

2026年6月17日以降の中間CA証明書が検証できるかで判定できる。

```bash
curl -fsSL https://jprs.jp/pubcert/service/certificate/2026/JPRS_OV_RSA_CA_2024_G1_PEM.cer -o /tmp/jprs.pem
openssl verify /tmp/jprs.pem
# 追加前: error 20 ... unable to get local issuer certificate
# 追加後: /tmp/jprs.pem: OK
```

### node / python について

node と python（requests系）はOSの信頼ストアを見ず、
それぞれ独自の証明書バンドルを持っている。
証明書を追加しただけでは効かないため、参照先をOS側へ揃えている。

```
SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/SECOM_TLS_RSA_Root_CA_2024_cross.crt
```

certifi のバンドルではなくOSの信頼ストアを使うことになる点に注意する。

### 削除する条件

`ca-certificates` が `SECOM TLS RSA Root CA 2024` を収録したら、
このクロスルート証明書は不要になる。

```bash
# 収録されていれば SECOM_TLS_RSA_Root_CA_2024.pem が現れる
ls /etc/ssl/certs/ | grep -i secom
```

収録を確認できたら、以下を削除する。

- `template/container/resources/certs/SECOM_TLS_RSA_Root_CA_2024_cross.crt`
- `Dockerfile.tmpl` の `NODE_EXTRA_CA_CERTS`
- 本ドキュメントの本節

`certs/` が空になる場合は、`Dockerfile.tmpl` の `COPY` と
`RUN update-ca-certificates` も併せて削除する。
