import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  status: number;
  message: string | string[];
}

// Registered globally in main.ts so every endpoint - auth today,
// specialties/consultants/appointments later - returns the same error
// shape, per the spec's Definition of Done. Anything that isn't a known
// HttpException (a raw Prisma error, a bug) collapses to a generic 500
// instead of leaking internals to the client.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return { status, message: body };
      }

      // Nest's built-in ValidationPipe throws a BadRequestException whose
      // response body already has this { message } shape (message is an
      // array of per-field errors) - reuse it instead of re-wrapping it.
      const message = (body as { message?: string | string[] }).message ?? exception.message;
      return { status, message };
    }

    return { status: 500, message: 'Internal server error' };
  }
}
