import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** ER_NO_REFERENCED_ROW_2 : la clé étrangère pointe vers une ligne inexistante. */
const MYSQL_FOREIGN_KEY_MISSING = 1452;

/**
 * Un id inexistant envoyé par le client (cardSetId, cardId…) est une erreur
 * client (400), pas une erreur serveur. Les autres erreurs SQL gardent le
 * traitement par défaut de Nest.
 */
@Catch(QueryFailedError)
export class ForeignKeyViolationFilter extends BaseExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const { errno } = exception.driverError as { errno?: number };
    if (errno !== MYSQL_FOREIGN_KEY_MISSING) {
      return super.catch(exception, host);
    }

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Référence invalide : l'élément lié n'existe pas.",
        error: 'Bad Request',
      });
  }
}
