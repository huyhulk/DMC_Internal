/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/.claude/worktrees/',
    '<rootDir>/.worktrees/',
  ],
  transform: {
    '^.+\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
}
