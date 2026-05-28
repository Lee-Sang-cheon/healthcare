module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // worklets-core plugin powers vision-camera frame processors.
    // reanimated's plugin is auto-included by babel-preset-expo when reanimated is installed.
    plugins: ['react-native-worklets-core/plugin'],
  };
};
