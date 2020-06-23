// MIT License http://www.opensource.org/licenses/mit-license.php
// Author Gajus Kuizinas @gajus
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */

import * as Ajv from 'ajv';
const ajv = new Ajv({
    errorDataPath: 'configuration',
    allErrors: true,
    verbose: true
});

require('ajv-keywords')(ajv, ['instanceof']);

export function validateSchema(
    schema: { [key: string]: unknown },
    data: { [key: string]: unknown }
): Ajv.ErrorObject[] {
    if (Array.isArray(data)) {
        const errors = data.map((opts: any) => validateObject(schema, opts));
        errors.forEach((list, idx) => {
            list.forEach(function applyPrefix(err: Ajv.ErrorObject): void {
                err.dataPath = `[${idx}]${err.dataPath}`;
                if ((err as any).children) {
                    (err as any).children.forEach(applyPrefix);
                }
            });
        });

        return errors.reduce((arr, items) => {
            return arr.concat(items);
        }, []);
    } else {
        return validateObject(schema, data);
    }
}

function validateObject(schema: Object, data: any): Ajv.ErrorObject[] {
    const validate = ajv.compile(schema);
    const valid = validate(data);

    return valid ? [] : filterErrors(validate.errors || []);
}

function filterErrors(errors: Ajv.ErrorObject[]): Ajv.ErrorObject[] {
    let newErrors: Ajv.ErrorObject[] = [];
    errors.forEach((err: Ajv.ErrorObject) => {
        const dataPath = err.dataPath;
        let children: Ajv.ErrorObject[] = [];
        newErrors = newErrors.filter((oldError: Ajv.ErrorObject) => {
            if (oldError.dataPath.includes(dataPath)) {
                if ((oldError as any).children) {
                    children = children.concat((oldError as any).children.slice(0));
                }
                (oldError as any).children = undefined;
                children.push(oldError);

                return false;
            }

            return true;
        });
        if (children.length) {
            (err as any).children = children;
        }
        newErrors.push(err);
    });

    return newErrors;
}

// // Ref: from webpack
export function formatValidationError(sourceSchema: Object, err: Ajv.ErrorObject): string {
    const dataPath = `configuration${err.dataPath}`;
    if (err.keyword === 'additionalProperties') {
        return `${dataPath} has an unknown property '${
            (err.params as any).additionalProperty
        }'.\nThese properties are valid:\n${getSchemaPartText(sourceSchema, err.parentSchema)}`;
    }
    if (err.keyword === 'oneOf' || err.keyword === 'anyOf') {
        if ((err as any).children && (err as any).children.length > 0) {
            return (
                `${dataPath} should be one of these:\n${getSchemaPartText(sourceSchema, err.parentSchema)}\n` +
                `Details:\n${(err as any).children
                    .map((e: Ajv.ErrorObject) => `${formatValidationError(sourceSchema, e)}`)
                    .join('\n')}`
            );
        }

        return `${dataPath} should be one of these:\n${getSchemaPartText(sourceSchema, err.parentSchema)}`;
    }
    if (err.keyword === 'enum') {
        if (err.parentSchema && (err.parentSchema as any).enum && (err.parentSchema as any).enum.length === 1) {
            return `${dataPath} should be ${getSchemaPartText(sourceSchema, err.parentSchema)}`;
        }

        return `${dataPath} should be one of these:\n${getSchemaPartText(sourceSchema, err.parentSchema)}`;
    }
    if (err.keyword === 'allOf') {
        return `${dataPath} should be:\n${getSchemaPartText(sourceSchema, err.parentSchema)}`;
    }
    if (err.keyword === 'type' && (err.params as any).type) {
        return `${dataPath} should be ${(err.params as any).type}:\n${getSchemaPartText(
            sourceSchema,
            err.parentSchema
        )}`;
    }
    if (err.keyword === 'instanceof') {
        return `${dataPath} should be an instance of ${getSchemaPartText(sourceSchema, err.parentSchema)}.`;
    }
    if (err.keyword === 'required' && (err.params as any).missingProperty) {
        const missingProperty: string = (err.params as any).missingProperty.replace(/^\./, '');

        return `${dataPath} misses the property '${missingProperty}'.\n${getSchemaPartText(
            sourceSchema,
            err.parentSchema,
            ['properties', missingProperty]
        )}`;
    }
    if (err.keyword === 'minLength' || err.keyword === 'minItems') {
        if ((err.params as any).limit === 1) {
            return `${dataPath} should not be empty.`;
        } else {
            return `${dataPath} ${err.message}`;
        }
    }

    return `${dataPath} ${err.message} (${JSON.stringify(err, null, 2)}).\n${getSchemaPartText(
        sourceSchema,
        err.parentSchema
    )}`;
}

const formatSchema = (
    sourceSchema: Object,
    curSchema: { [key: string]: any },
    prevSchemas?: { [key: string]: any }[]
): string => {
    const schema = curSchema as any;
    prevSchemas = prevSchemas || [];

    const formatInnerSchema: any = (innerSchema: { [key: string]: any }, addSelf?: boolean): any => {
        if (!addSelf) {
            return formatSchema(sourceSchema, innerSchema, prevSchemas);
        }

        prevSchemas = prevSchemas || [];
        if (prevSchemas.indexOf(innerSchema) >= 0) {
            return '(recursive)';
        }

        return formatSchema(sourceSchema, innerSchema, prevSchemas.concat(schema));
    };

    if (schema.type === 'string' && schema.minLength === 1) {
        return 'non-empty string';
    }
    if (schema.type === 'string' && schema.minLength > 1) {
        return `string (min length ${schema.minLength})`;
    }
    if (schema.type === 'string') {
        return 'string';
    }

    if (schema.type === 'boolean') {
        return 'boolean';
    }
    if (schema.type === 'number') {
        return 'number';
    }
    if (schema.type === 'object') {
        if (schema.properties) {
            const required: any[] = schema.required || [];

            return `object { ${Object.keys(schema.properties)
                .map((property: string) => {
                    if (required.indexOf(property) < 0) {
                        return `${property}?`;
                    }

                    return property;
                })
                .concat(schema.additionalProperties ? ['...'] : [])
                .join(', ')} }`;
        }
        if (schema.additionalProperties) {
            return `object { <key>: ${formatInnerSchema(schema.additionalProperties)} }`;
        }

        return 'object';
    }

    if (schema.type === 'array') {
        return `[${formatInnerSchema(schema.items)}]`;
    }

    switch (schema.instanceof) {
        case 'Function':
            return 'function';
        case 'RegExp':
            return 'RegExp';
    }

    if (schema.$ref) {
        return formatInnerSchema(getSchemaPart(sourceSchema, schema.$ref), true);
    }
    if (schema.allOf) {
        return schema.allOf.map(formatInnerSchema).join(' & ');
    }
    if (schema.oneOf) {
        return schema.oneOf.map(formatInnerSchema).join(' | ');
    }
    if (schema.anyOf) {
        return schema.anyOf.map(formatInnerSchema).join(' | ');
    }
    if (schema.enum) {
        return schema.enum.map((item: any) => JSON.stringify(item)).join(' | ');
    }

    return JSON.stringify(schema, null, 2);
};

function getSchemaPartText(sourceSchema: Object, schemaPart: any, additionalPath?: string[]): any {
    if (additionalPath) {
        for (const inner of additionalPath) {
            if (inner) {
                schemaPart = inner;
            }
        }
    }

    while (schemaPart.$ref) {
        schemaPart = getSchemaPart(sourceSchema, schemaPart.$ref);
    }

    let schemaText = formatSchema(sourceSchema, schemaPart);
    if (schemaPart.description) {
        schemaText += `\n${schemaPart.description}`;
    }

    return schemaText;
}

function getSchemaPart(sourceSchema: Object, path: string, parents?: number, additionalPath?: string): any {
    parents = parents || 0;
    let pathArrary = path.split('/');
    pathArrary = pathArrary.slice(0, pathArrary.length - parents);
    if (additionalPath) {
        pathArrary = pathArrary.concat(additionalPath.split('/'));
    }

    let schemaPart: any = sourceSchema;
    for (const inner of pathArrary) {
        if (inner) {
            schemaPart = inner;
        }
    }

    return schemaPart;
}
