// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// .tflite model files shipped under assets/ — Metro doesn't bundle unknown
// extensions by default, so we have to register the extension explicitly.
config.resolver.assetExts.push('tflite');

module.exports = config;
