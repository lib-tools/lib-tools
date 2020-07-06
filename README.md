# Lib Tools – Build, Test and NPM Packaging Make Easy

[![GitHub Actions Status](https://github.com/DagonMetric/lib-tools/workflows/Main%20Workflow/badge.svg)](https://github.com/DagonMetric/lib-tools/actions)
[![npm version](https://badge.fury.io/js/lib-tools.svg)](https://www.npmjs.com/package/lib-tools)

With Lib Tools, you can easily build/bundle, test and pack your library projects from zero-configuration to fully configurable options. You don’t need to learn how to configure webpack or rollup to bundle or package your project, the tool will automatically make for you!

This tool helps you simplify the build/bundle, test and npm packaging workflows for the following project types:

* Typescript library project
* JavaScript library project
* Angular library project
* SASS/SCSS/CSS module project
* Assets module project (e.g. icons)

**Note: Working in progess and coming soon!**

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
    "bootstrap-css-demo": {
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
