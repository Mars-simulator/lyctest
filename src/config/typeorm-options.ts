const isProduction = process.env.NODE_ENV === 'production';

/**
 * 生成 TypeORM 连接配置（供拆分后的各服务复用）。
 * 敏感配置优先走环境变量；开发默认值仅为便于本地启动。
 */
export function createTypeOrmOptions(entities: (string | Function)[]) {
  return {
    type: 'mysql' as const,
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? 'faben123',
    database: process.env.DB_DATABASE ?? 'nest_crud_demo',
    entities,
    // 生产默认关闭自动同步；容器/CI 首次初始化用 DB_SYNC=true 显式开启
    synchronize:
      process.env.DB_SYNC === 'true' || (!isProduction && process.env.DB_SYNC !== 'false'),
    logging: false,
  };
}
