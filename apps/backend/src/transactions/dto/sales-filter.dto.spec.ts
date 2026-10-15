import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecentSalesQueryDto } from './recent-sales-query.dto';
import { SalesStatsQueryDto } from './sales-stats-query.dto';

const errorsFor = async (query: object) =>
  (
    await validate(plainToInstance(RecentSalesQueryDto, query), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('RecentSalesQueryDto', () => {
  it('accepts a player and the both role from the query string', async () => {
    expect(await errorsFor({ userId: '7', role: 'both' })).toEqual([]);
  });

  it('rejects an invalid player id', async () => {
    expect(await errorsFor({ userId: '0' })).toEqual(['userId']);
    expect(await errorsFor({ userId: 'abc' })).toEqual(['userId']);
  });

  it('rejects an unknown role', async () => {
    expect(await errorsFor({ role: 'admin' })).toEqual(['role']);
  });
});
describe('SalesStatsQueryDto', () => {
  const statsErrors = async (query: object) =>
    (
      await validate(plainToInstance(SalesStatsQueryDto, query), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).map((e) => e.property);

  it('accepts an empty query (whole market)', async () => {
    expect(await statsErrors({})).toEqual([]);
  });

  it('accepts a player with a role', async () => {
    expect(await statsErrors({ userId: '3', role: 'seller' })).toEqual([]);
  });

  it('rejects pagination params and unknown roles', async () => {
    expect(await statsErrors({ page: '2' })).toEqual(['page']);
    expect(await statsErrors({ role: 'both ' })).toEqual(['role']);
  });
});
