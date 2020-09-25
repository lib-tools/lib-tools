import { AngularCompilerPlugin, NgToolsLoader } from '@ngtools/webpack';

import { Plugin, RuleSetRule } from 'webpack';

import { TestConfigInternal } from '../models';

export function getWebpackTestRulesAndPluginsForAngular(
    testConfig: TestConfigInternal
): { rules: RuleSetRule[]; plugins: Plugin[] } {
    const rules: RuleSetRule[] = [];
    const plugins: Plugin[] = [];

    rules.push({
        test: /\.tsx?$/,
        loader: NgToolsLoader,
        options: {
            mainPath: testConfig._testIndexFilePath,
            configFile: testConfig._tsConfigPath,
            skipCodeGeneration: true,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            contextElementDependencyConstructor: require('webpack/lib/dependencies/ContextElementDependency'),
            directTemplateLoading: true
        }
    });

    plugins.push(
        new AngularCompilerPlugin({
            tsConfigPath: testConfig._tsConfigPath || ''
        })
    );

    return {
        rules,
        plugins
    };
}
