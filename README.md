# generate-qr-url-with-omggif

## Encoding

```
const fs = require('fs');

const Ver1QR = require('../main');

const ver1qr = new Ver1QR({
  scale: 2,
  quietZone: 2
});

ver1qr.encodeShortUrl23('HTTP://WWW.EXAMPLE.COM/');

fs.writeFile('test-ShortUrl23.gif', ver1qr.renderGif(), function(err) {
  console.log(err);
});
```

## Resulting test-ShortUrl23.gif
![Hello World!](https://github.com/stokes91/generate-qr-url-with-omggif/blob/main/examples/test-ShortUrl23.gif?raw=true)

## Two dependencies

It's just a few hundred lines of clear, readable, code; and relies on rs-finite-field and omggif.

## Also Free

Licensed under Apache 2.0

