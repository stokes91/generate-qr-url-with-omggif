/*
   Copyright 2021 Alexander Stokes
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at
     http://www.apache.org/licenses/LICENSE-2.0
   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

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
