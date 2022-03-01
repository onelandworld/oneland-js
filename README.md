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
$ npm link
```

## Use local package

```sh
$ cd <other project>
$ npm link @onelandworld/oneland-js --save
```

## Remove global symbol link

```sh
$ npm ls --global @onelandworld/oneland-js
$ npm rm --global @onelandworld/oneland-js
```
