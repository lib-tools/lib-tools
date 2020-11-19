/* eslint-env node*/

const path = require('path');

module.exports = (config) => {
    // const puppeteer = require('puppeteer');
    // process.env.CHROME_BIN = puppeteer.executablePath();

    config.set({
        basePath: '',
        frameworks: ['jasmine', 'lib-tools'],
        plugins: [
            require('karma-jasmine'),
            require('karma-chrome-launcher'),
            require('karma-jasmine-html-reporter'),
            require('karma-coverage'),
            require('karma-junit-reporter'),
            require(path.resolve(__dirname, '../../dist/karma-plugin'))
        ],
        client: {
            clearContext: false
        },
        coverageReporter: {
            dir: path.join(__dirname, 'coverage'),
            subdir: '.',
            reporters: [{ type: 'html' }, { type: 'lcovonly' }, { type: 'text-summary' }, { type: 'cobertura' }]
        },
        reporters: ['progress', 'kjhtml'],
        junitReporter: {
            outputDir: './junit'
        },
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        browsers: ['Chrome'],
        customLaunchers: {
            ChromeHeadlessCI: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox']
            }
        },
        singleRun: false,
        restartOnFileChange: true
    });
};
