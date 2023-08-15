#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const destDir = path.resolve(__dirname, '../dist');
const distStartRegExp = /^\.?\/?dist\//;

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
}

// copy package.json
const content = fs.readFileSync(path.resolve(__dirname, '../package.json'), { encoding: 'utf-8' });
const packageJson = JSON.parse(content);

if (packageJson.main) {
    packageJson.main = packageJson.main.replace(distStartRegExp, './');
}
if (packageJson.exports) {
    packageJson.exports = packageJson.exports.replace(distStartRegExp, './');
}
if (packageJson.types) {
    packageJson.types = packageJson.types.replace(distStartRegExp, './');
}

if (packageJson.devDependencies) {
    delete packageJson.devDependencies;
}

if (packageJson.scripts) {
    delete packageJson.scripts;
}

fs.writeFileSync(path.resolve(destDir, 'package.json'), JSON.stringify(packageJson, null, 2));

// copy files
fs.copyFileSync(path.resolve(rootDir, 'README.md'), path.resolve(destDir, 'README.md'));
fs.copyFileSync(path.resolve(rootDir, 'LICENSE'), path.resolve(destDir, 'LICENSE'));
fs.copyFileSync(path.resolve(rootDir, 'bin/lib.js'), path.resolve(destDir, 'bin/lib.js'));

// TODO:
// fs.copySync(
//     path.resolve(rootDir, 'src/karma-plugin/karma-context.html'),
//     path.resolve(destDir, 'karma-plugin/karma-context.html')
// );
// fs.copySync(
//     path.resolve(rootDir, 'src/karma-plugin/karma-debug.html'),
//     path.resolve(destDir, 'karma-plugin/karma-debug.html')
// );
