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
            require('karma-coverage-istanbul-reporter'),
            require('karma-junit-reporter'),
            // require('lib-tools/karma-plugin'),
            require(path.resolve(__dirname, '../../dist/karma-plugin'))
        ],
        client: {
            clearContext: false
        },
        coverageIstanbulReporter: {
            dir: path.join(__dirname, 'coverage'),
            reports: ['html', 'lcovonly', 'text-summary', 'cobertura'],
            fixWebpackSourcePaths: true
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
