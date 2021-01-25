# Lib Tools – Build, Test and NPM Package Workflows Make Easy

[![GitHub Actions Status](https://github.com/lib-tools/lib-tools/workflows/Main%20Workflow/badge.svg)](https://github.com/lib-tools/lib-tools/actions)
[![Azure Pipelines Status](https://dev.azure.com/lib-tools/lib-tools/_apis/build/status/lib-tools.lib-tools?branchName=master)](https://dev.azure.com/lib-tools/lib-tools/_build/latest?definitionId=1&branchName=master)
[![npm version](https://badge.fury.io/js/lib-tools.svg)](https://www.npmjs.com/package/lib-tools)

The `lib-tools` helps you simplify the build/bundle, test and npm packaging workflows for Typescript/JavaScript/Angular library projects and Assets module projects (e.g. sass, scss, css or icons). This tool can automatically set up for your projects without the time spent with webpack, rollup, karma, postcss, autoprefixer or clean-css configuration files. You can start from zero-configuration to fully customizable options!

## Getting Started

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

### Build the Project(s)

To build the project(s) using `workflow.json` configuration file

```bash
lib build
```

Or, to automatically detect and build the project(s) without  `workflow.json` configuration file

```bash
lib build --workflow=auto
```

To learn more about build command options, see [Build Command Usage](https://github.com/lib-tools/lib-tools/wiki/Build-Command-Usage) wiki, or run

```bash
lib build --help
```

### Test the Project(s)

To run the test(s) using `workflow.json` configuration file.

```bash
lib test
```

Or, to automatically detect and run the test(s) without  `workflow.json` configuration file.

```bash
lib test --workflow=auto
```

To learn more about build command options, see [Test Command Usage](https://github.com/lib-tools/lib-tools/wiki/Test-Command-Usage) wiki, or run

```bash
lib test --help
```

### Configuration (workflow.json file)

The following is an example `workflow.json` configuration for building and testing the Typescript library project.

```json
{
  "projects": {
    "demo-project": {
      "root": "./",
      "tasks": {
        "build": {
          "outputPath": "dist/demo-project",
          "script": {
            "compilations": [
              {
                "declaration": true,
                "target": "ES2015",
                "outDir": "esm2015",
                "esBundle": {
                  "outputFile": "fesm2015/demo-project.js"
                }
              },
              {
                "declaration": false,
                "target": "es5",
                "outDir": "esm5",
                "esBundle": true,
                "umdBundle": {
                  "outputFile": "bundles/demo-project.umd.js"
                }
              }
            ],
            "tsConfig": "tsconfig.build.json",
            "entry": "public_api.ts",
            "umdId": "demo",
            "peerDependenciesAsExternals": true,
            "dependenciesAsExternals": true,
            "externals": {
              "tslib": "tslib"
            }
          }
        },
        "test": {
          "karmaConfig": "karma.conf.js",
          "testIndexFile": "test/test.ts",
          "tsConfig": "tsconfig.test.json",
          "envOverrides": {
            "ci": {
              "reporters": [
                "junit",
                "coverage"
              ],
              "codeCoverageExclude": [
                "**/test.ts",
                "**/index.ts",
                "**/public_api.ts"
              ],
              "browsers": [
                "ChromeHeadlessCI"
              ],
              "singleRun": true
            }
          }
        }
      }
    }
  }
}
```

To learn more about workflow configuration, see [Build Workflow Configuration](https://github.com/lib-tools/lib-tools/wiki/Build-Workflow-Configuration) and [Test Workflow Configuration](https://github.com/lib-tools/lib-tools/wiki/Test-Workflow-Configuration).

## Docs

* Build
  * [Build Command Usage](https://github.com/lib-tools/lib-tools/wiki/Build-Command-Usage)
  * [Build Workflow Configuration](https://github.com/lib-tools/lib-tools/wiki/Build-Workflow-Configuration)

* Test
  * [Test Command Usage](https://github.com/lib-tools/lib-tools/wiki/Test-Command-Usage)
  * [Test Workflow Configuration](https://github.com/lib-tools/lib-tools/wiki/Test-Workflow-Configuration)

## Examples

* [Typescript Library Project Demo](https://github.com/lib-tools/lib-tools/tree/master/samples/typescript-library-project-demo)

* [Angular Library Project Demo](https://github.com/lib-tools/lib-tools/tree/master/samples/angular-library-project-demo)

* [Style Module Demo](https://github.com/lib-tools/lib-tools/tree/master/samples/style-module-demo)

## Some Projects Using Lib Tools

* Angular Projects
  * [ng-entity-change-checker][https://github.com/DagonMetric/ng-entity-change-checker] - Object dirty checker and modified properties detector for Angular
  * [ng-config](https://github.com/DagonMetric/ng-config) - Configuration and options service for Angular
  * [ng-log](https://github.com/DagonMetric/ng-log) - Vendor-agnostic logging, analytics and telemetry service abstractions and some implementations for Angular
  * [ng-cache](https://github.com/DagonMetric/ng-cache) - Caching service for Angular
  * [ng-zawgyi-detector](https://github.com/myanmartools/ng-zawgyi-detector) - Zawgyi-One and standard Myanmar Unicode detector library for Angular

* Typescript/JavaScript Projects
  * [translit-js](https://github.com/DagonMetric/translit-js) - General purpose transliterate service for JavaScript applications
  * [myanmar-text-extractor-js](https://github.com/myanmartools/myanmar-text-extractor-js) - Burmese language (Myanmar text) extractor JavaScript library for word segmentation, text extraction or syllable break
  * [zawgyi-unicode-translit-rules](https://github.com/myanmartools/zawgyi-unicode-translit-rules) - Zawgyi Unicode transliterate / convert regular expression rules in JavaScript


## General Discussions

We’re using the following discussion channels as a place to connect with other members of our community.

* [GitHub Discussions Channel](https://github.com/lib-tools/lib-tools/discussions)

## Feedback and Contributing

Check out our [Contributing](https://github.com/lib-tools/lib-tools/blob/master/CONTRIBUTING.md) page.

## License

This repository is licensed with the [MIT](https://github.com/lib-tools/lib-tools/blob/master/LICENSE) license.
