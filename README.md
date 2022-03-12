# Publish to npmjs

```sh
$ yarn build
$ npm login --registry=https://registry.npmjs.org/
$ npm whoami
$ npm publish --access public
```

# Development

## Install Dependencies

```sh
$ yarn
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
