# Lib Tools – Build, Test and NPM Package Workflows Make Easy

[![GitHub Actions Status](https://github.com/DagonMetric/lib-tools/workflows/Main%20Workflow/badge.svg)](https://github.com/DagonMetric/lib-tools/actions)
[![npm version](https://badge.fury.io/js/lib-tools.svg)](https://www.npmjs.com/package/lib-tools)
[![Gitter](https://badges.gitter.im/DagonMetric/general.svg)](https://gitter.im/DagonMetric/general?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

The `Lib Tools` helps you simplify the build/bundle, test and npm packaging workflows for common library project types such as Typescript/JavaScript library projects, Angular library projects and Assets module projects (e.g. sass, scss, css or icons). This tool will automatically set up for you without the time spent with webpack, rollup, postcss, autoprefixer or clean-css configuration files. You can start from zero-configuration to fully configurable options!

**Note: This project is still working in progess and coming soon!**

## Get Started

### Installation

You can install lib-tools cli either globally or locally.

```bash
npm install -D lib-tools
```

or install globally

```bash
npm install -g lib-tools
```

Latest npm package is [![npm version](https://badge.fury.io/js/lib-tools.svg)](https://www.npmjs.com/package/lib-tools)

### Build Project for NPM Package Publish with Zero-Configuration

The following command automatically detects your project structure and make it ready for npm package publish.

```bash
lib build --auto
```

### Build Project(s) with Fully Configurable Options

You can customize your build/test workflows with `workflows.json` configuration file.

```json
{
  "$schema": "./node_modules/lib-tools/schemas/schema.json#",
  "projects": {
    "demo-project": {
      "root": "./",
      "actions": {
        "build": {
          "outputPath": "dist",
          "clean": {
            "beforeBuild": {
              "cleanOutDir": true
            }
          },
          "copy": [
            {
              "from": "src/scss",
              "to": "scss/"
            },
            "README.md",
            "LICENSE"
          ],
          "style": {
            "entries": [
              {
                "input": "src/scss/pure-css.scss",
                "output": "css/pure-css.css"
              }
            ],
            "minify": true,
            "vendorPrefixes": true
          },
          "scriptTranspilation": {
            "entries": [
              {
                "target": "ES2015",
                "declaration": true
              },
              {
                "target": "ES5"
              }
            ],
            "tsConfig": "tsconfig-build.json"
          },
          "scriptBundle": {
            "entries": [
              {
                "libraryTarget": "esm",
                "entryRoot": "transpilationOutput"
              },
              {
                "libraryTarget": "umd",
                "entryRoot": "prevBundleOutput"
              }
            ],
            "peerDependenciesAsExternals": true,
            "banner": "../banner.txt"
          }
        }
      }
    }
  }
}
```

## Examples and Docs

[WIP]

## Features

[WIP]

## Feedback and Contributing

Check out our [Contributing](https://github.com/DagonMetric/lib-tools/blob/master/CONTRIBUTING.md) page.

## License

This repository is licensed with the [MIT](https://github.com/DagonMetric/lib-tools/blob/master/LICENSE) license.
