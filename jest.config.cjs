/**
 * Jest 单元测试配置
 *
 * 项目为 ESM（package.json 的 "type": "module"），因此：
 * - 需要通过 `--experimental-vm-modules` 运行（见 package.json 的 test 脚本）
 * - ts-jest 使用 ESM 模式，.ts 视为 ESM
 * - 源码里的相对导入带 .js 后缀（nodenext 要求），用 moduleNameMapper 映射回 .ts
 *
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // 每个用例前自动清理 mock 调用记录（保留 mock 实现）
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.entity.ts',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
};
