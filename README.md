# Publish to npmjs

```sh
$ npm login --registry=https://registry.npmjs.org
$ npm whoami
# Publish package via `np` command (Version number in package.json will be auto updated and committed).
$ yarn np 1.0.0
```

# Development

## Install Dependencies

```sh
$ yarn
```

## Steps to generate TypeChain ABI classes
```sh
$ yarn add --dev typechain
$ yarn add --dev @typechain/ethers-v5

# Copy whole or part of ABI definitions from etherscan, and put to src/abi/**/*.abi.json

$ npx typechain --target ethers-v5 --out-dir src/typechain --show-stack-traces src/abi/**/*.abi.json
```

## Build

### Lint

```sh
$ yarn lint
```

### Auto fix lint errors

```sh
$ yarn fix
```

# Develop and Use Locally (Recommended)

## Create global symbol link

```sh
$ cd <oneland-js>
$ yarn link
```

## Use local package

```sh
$ cd <other project>
$ yarn link @onelandworld/oneland-js
```

## Remove global symbol link

```sh
# Under oneland-js directory
$ yarn unlink
# Under the project that uses oneland-js locally
$ yarn unlink @onelandworld/oneland-js
```
