#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import spawn from 'cross-spawn';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function modifySchemaJsonFile(schemaFilePath) {
    const schemaContent = fs.readFileSync(schemaFilePath, { encoding: 'utf-8' });
    const schemaJson = JSON.parse(schemaContent);
    if (schemaJson.$schema) {
        delete schemaJson.$schema;
    }

    fs.writeFileSync(schemaFilePath, JSON.stringify(schemaJson, null, 2));
}

function generateSchemaJsonFile() {
    const schemaOutDir = path.resolve(__dirname, '../dist/schemas');
    const tsConfigFile = path.resolve(__dirname, '../tsconfig.schema.json');
    const schemaOutputFilePath = path.resolve(schemaOutDir, 'schema.json');

    if (!fs.existsSync(schemaOutDir)) {
        fs.mkdirSync(schemaOutDir, {
            mode: 0o777,
            recursive: true
        });
    }

    spawn.sync(
        path.join(process.cwd(), 'node_modules/.bin/typescript-json-schema'),
        [tsConfigFile, 'WorkflowConfig', '--out', schemaOutputFilePath],
        {
            cwd: __dirname,
            stdio: 'inherit'
        }
    );

    modifySchemaJsonFile(schemaOutputFilePath);
}

// if (process.argv.length >= 2 && process.argv[1] === path.resolve(__filename)) {
//     generateSchemaJsonFile();
// }

generateSchemaJsonFile();
