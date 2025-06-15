# gaussdb-node

<!-- TODO: 打包后再恢复 -->
<!-- ![Build Status](https://github.com/HuaweiCloudDeveloper/gaussdb-node/actions/workflows/ci.yml/badge.svg)
<span class="badge-npmversion"><a href="https://npmjs.org/package/gaussdb" title="View this project on NPM"><img src="https://img.shields.io/npm/v/gaussdb.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/gaussdb" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/gaussdb.svg" alt="NPM downloads" /></a></span> -->

Non-blocking GaussDB client for Node.js. Pure JavaScript and optional native libpq bindings.

## Monorepo

This repo is a monorepo which contains the core [gaussdb](https://github.com/HuaweiCloudDeveloper/gaussdb-node/tree/master/packages/gaussdb) module as well as a handful of related modules.

- [gaussdb](https://github.com/HuaweiCloudDeveloper/gaussdb-node/tree/master/packages/gaussdb)
- [gaussdb-pool](https://github.com/HuaweiCloudDeveloper/gaussdb-node/tree/master/packages/gaussdb-pool)
- [pg-native](https://github.com/HuaweiCloudDeveloper/gaussdb-node/tree/master/packages/pg-native)
- [gaussdb-cursor](https://github.com/HuaweiCloudDeveloper/gaussdb-node/tree/master/packages/gaussdb-cursor)
- [gaussdb-query-stream](https://github.com/HuaweiCloudDeveloper/gaussdb-node/tree/master/packages/gaussdb-query-stream)
- [gaussdb-connection-string](https://github.com/HuaweiCloudDeveloper/gaussdb-node/tree/master/packages/gaussdb-connection-string)
- [gaussdb-protocol](https://github.com/HuaweiCloudDeveloper/gaussdb-node/tree/master/packages/gaussdb-protocol)

## Install

```
npm install gaussdb
```

## Documentation

Each package in this repo should have its own readme more focused on how to develop/contribute. 
<!-- TODO: 构建文档后恢复 -->
<!-- For overall documentation on the project and the related modules managed by this repo please see: -->

### :star: Documentation:star:

The source repo for the documentation is available for contribution [here](https://github.com/HuaweiCloudDeveloper/gaussdb-node/tree/master/docs).

### Features

- Pure JavaScript client and native libpq bindings share _the same API_
- Connection pooling
- Extensible JS ↔ GaussDB data-type coercion
- Supported GaussDB features
  - Parameterized queries
  - Named statements with query plan caching
  - Bulk import & export with `COPY TO/COPY FROM`

### Extras

gaussdb-node is by design pretty light on abstractions. These are some handy modules we've been using over the years to complete the picture.
<!-- TODO: 构建后恢复 -->
<!-- The entire list can be found on our [wiki](https://github.com/HuaweiCloudDeveloper/gaussdb-node/wiki/Extras). -->

## Support

gaussdb-node is free software. If you encounter a bug with the library please open an issue on the [GitHub repo](https://github.com/HuaweiCloudDeveloper/gaussdb-node). If you have questions unanswered by the documentation please open an issue pointing out how the documentation was unclear & I will do my best to make it better!

When you open an issue please provide:

- version of Node
- version of GaussDB
- smallest possible snippet of code to reproduce the problem


## Contributing

**:heart: contributions!**

I will **happily** accept your pull request if it:

- **has tests**
- looks reasonable
- does not break backwards compatibility

If your change involves breaking backwards compatibility please please point that out in the pull request & we can discuss & plan when and how to release it and what type of documentation or communication it will require.

### Setting up for local development

1. Clone the repo
2. Ensure you have installed libpq-dev in your system.
3. From your workspace root run `yarn` and then `yarn lerna bootstrap`
4. Ensure you have a GaussDB instance running with SSL enabled and an empty database for tests
5. Ensure you have the proper environment variables configured for connecting to the instance
6. Run `yarn test` to run all the tests

## License

Copyright (c) 2010-2020 Brian Carlson (brian.m.carlson@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
