/**
 * Pure-TS test config — no React Native or Expo runtime required.
 * Targets the math / state-machine / pure-helper modules.
 *
 * Hooks and screens that pull in React Native or vision-camera need a
 * different setup (e.g. jest-expo with proper module mocking) — those tests
 * aren't covered here yet.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          target: 'ES2020',
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          skipLibCheck: true,
          jsx: 'react',
          rootDir: '.',
        },
      },
    ],
  },
};
