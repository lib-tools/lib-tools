#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';
import spawn from 'cross-spawn';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function modifySchemaJsonFile(schemaFilePath) {
    const schemaJson = fs.readJSONSync(schemaFilePath);
    if (schemaJson.$schema) {
        delete schemaJson.$schema;
    }

    fs.writeFileSync(schemaFilePath, JSON.stringify(schemaJson, null, 2));
}

function generateSchemaJsonFile() {
    const schemaOutDir = path.resolve(__dirname, '../dist/schemas');
    const tsConfigFile = path.resolve(__dirname, '../tsconfig.schema.json');
    const schemaOutputFilePath = path.resolve(schemaOutDir, 'schema.json');

    fs.ensureDirSync(schemaOutDir);

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
