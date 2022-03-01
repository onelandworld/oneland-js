# Usage

## Create `.npmrc` for your project

```
@onelandworld:registry=https://npm.pkg.github.com
```

## Authenticate to Github Package

### Github workflows

Create a Github personal access token with `read:packages` permission, and use it in workflow.

For example:

```yml
- name: Run install
  run: |
    npm config set //npm.pkg.github.com/:_authToken=${ONELAND_PACKAGES_NPM_AUTH_TOKEN}
    npm i
  env:
    ONELAND_PACKAGES_NPM_AUTH_TOKEN: ${{ secrets.PAT_MAXM_READ_PACKAGES }}
```

### Local

Create a Github personal access token with `read:packages` permission, and add to your `~/.npmrc`.
```
$ echo "//npm.pkg.github.com/:_authToken=<your access token>" >> ~/.npmrc
```

## Add dependency

```sh
$ yarn add @onelandworld/oneland-js
```

# Development

## Install Dependencies

```sh
$ npm ci
```

## Build

### Lint

```sh
$ npm run lint
```

### Auto fix lint errors

```sh
$ npm run fix
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
