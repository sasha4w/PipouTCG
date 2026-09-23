import { ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';
import { ForeignKeyViolationFilter } from './foreign-key.filter';

function queryError(errno: number) {
  const driverError = Object.assign(new Error('mysql'), { errno });
  return new QueryFailedError('INSERT ...', [], driverError);
}

function httpHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('ForeignKeyViolationFilter', () => {
  const filter = new ForeignKeyViolationFilter();

  afterEach(() => jest.restoreAllMocks());

  it('should answer 400 when a referenced row does not exist (MySQL 1452)', () => {
    const { host, status, json } = httpHost();

    filter.catch(queryError(1452), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: "Référence invalide : l'élément lié n'existe pas.",
      error: 'Bad Request',
    });
  });

  it('should leave any other database error to the default handler', () => {
    const { host, status } = httpHost();
    const fallback = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation();
    const error = queryError(1062);

    filter.catch(error, host);

    expect(fallback).toHaveBeenCalledWith(error, host);
    expect(status).not.toHaveBeenCalled();
  });
});
