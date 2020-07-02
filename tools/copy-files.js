#!/usr/bin/env node

'use strict';

const fs = require('fs-extra');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const destDir = path.resolve(__dirname, '../dist');

fs.ensureDirSync(destDir);

// copy package.json
const packageJson = require('../package.json');
packageJson.main = 'src/index.js';
packageJson.typings = 'src/index.d.ts';

if (packageJson.devDependencies) {
    delete packageJson.devDependencies;
}

if (packageJson.scripts) {
    delete packageJson.scripts;
}

fs.writeFileSync(path.resolve(destDir, 'package.json'), JSON.stringify(packageJson, null, 2));

// copy files
fs.copySync(path.resolve(rootDir, 'README.md'), path.resolve(destDir, 'README.md'));
fs.copySync(path.resolve(rootDir, 'LICENSE'), path.resolve(destDir, 'LICENSE'));

fs.copySync(path.resolve(rootDir, 'bin/lib'), path.resolve(destDir, 'bin/lib'));
fs.copySync(path.resolve(rootDir, 'bin/lib-cli.js'), path.resolve(destDir, 'bin/lib-cli.js'));
