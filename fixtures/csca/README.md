# CSCA trust anchors

Drop PEM-encoded BCA Country Signing CA root certificates here.

For **dev / test**, we ship `dev-csca.pem` — a self-signed cert whose private key sits in `dev-csca.key`. The fixture chip dumps in `packages/nfc-parser/test/` are signed against this CA.

For **production**, fetch the real BCA CSCA roots from the [ICAO Public Key Directory](https://pkddownloadsg.icao.int) and mount them in via your secret manager. Never commit production trust anchors to git.

The dev key is **not** secret and **must not** be deployed.
