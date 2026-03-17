import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CustomNamingStrategy } from './naming.strategy';
import { Buffer } from 'buffer';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  namingStrategy: new CustomNamingStrategy(),
  ssl: process.env.DB_SSL_CA_BASE64
    ? {
        ca: Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64'),
        rejectUnauthorized: true,
      }
    : undefined,
});

