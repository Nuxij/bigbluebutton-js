## 0.3.0-beta.0

- Added BBB 3.0 compatibility mode options in API initialization (`compat.joinPasswordMode`).
- Added role-first join support while preserving legacy join password behavior in compatibility mode.
- Added `sendChatMessage` and `getJoinUrl` administration endpoint wrappers.
- Updated `end` handling to support optional password parameter.
- Added filtering/warnings for removed BBB 3.0 `create` parameters.
- Extended HTTP client to support both URL strings and request descriptor objects.
- Added `createRequest` and `createPost` helper methods for BBB 3.0-compatible POST create flows.
- Added response parsing for both XML and JSON payloads.
- Replaced live BBB-dependent tests with deterministic offline tests.

## 0.2.0

- (Fix) XML parser is now consistent no matter how many meetings or recordings are returned (Used to return single object or array for two or more objects)
- Added examples of usage

## 0.1.0

- node native crpyto module replaced with hash.js
- added browser-compatible build
- utils are now available to external libraries

## 0.0.8

- URL normalizer added
- Updated documentation

## 0.0.5

- WebHooks support added

## 0.0.1

- Forked bbb-promise
- requests replaced with axios
- sha1 replaced with node native crpyto module
- xml2js-es6-promise replaced with fast-xml-parser 