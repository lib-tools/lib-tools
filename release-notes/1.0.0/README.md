## Features

* The `lib-tools` helps you simplify the build/bundle, test and npm packaging workflows for Typescript/JavaScript library projects, Angular library projects and Assets module projects (e.g. sass, scss, css or icons).
* Workflow project configuration can be extended by `extends` options.

### Library Build Features

* Buult-in cli (`lib`) or webpack cli (`webpack`) can be used to build or bundle the projects.
* For zero-configuration, `lib build --workflow=auto` command can be used to detect project structure and run build tasks automatically.
* For customizable build configuration, `workflow.json` configuration file can be used.
* Build workflow configuration includes:
  * `outputPath: string` - The output directory for build results. Default to `dist/packages/{package-name}`
  * `clean: CleanOptions | boolean` - Clean object options or boolean value for deleting build output files. By default, output directory will be deleted when build command started. You can set `false` to disable cleaning of output directory.
  * `copy: (string | AssetEntry)[]` - List of asset entries to copy to output directory. By default README, LICENSE/LICENCE, CHANGELOG/CHANGES/HISTORY, NOTICE files are copied to output directory automatically.
  * `style: StyleOptions` - Style compilation options for sass, scss or css files.
  * `script: ScriptOptions` - Script compilation and bundle options for javascript and typescript files.
  * `banner: string` - Banner text to add at the top of each generated files. It can be file path or raw text.
  * `skip: boolean` - Set true to skip the task.
  * `envOverrides: {[name: string]: BuildConfig}` - Override build configuration based on environment.

### Library Test Features

* Buult-in cli (`lib`) or karma cli (`karma`) can be used to run tests
* For zero-configuration, `lib test --workflow=auto` command can be used to detect project structure and run tests automatically.
* For customizable test configuration, `workflow.json` configuration file can be used.
* Test workflow configuration includes:
  * `testIndexFile: string` - Index file for test.
  * `polyfills: string | string[]` - Polyfill entries.
  * `tsConfig: string` - Typescript configuration file.
  * `karmaConfig: string` - Karma configuration file.
  * `browsers: string[]` - A list of browsers to launch and capture.
  * `reporters: string[]` - A list of reporters to use.
  * `codeCoverageExclude: string[]` - A list of minimatch pattern to exclude files from code coverage report.
  * `vendorSourceMap: boolean` - If true, extract and include source maps from existing vendor module source map files.
  * `singleRun: boolean` - If true, test runner will stop watching and exit when run completed.
  * `skip: boolean` - Set true to skip the task.
  * `envOverrides: {[name: string]: BuildConfig}` - Override test configuration based on environment.

npm packages are available on:

* [lib-tools @npm registry](https://www.npmjs.com/package/lib-tools)
