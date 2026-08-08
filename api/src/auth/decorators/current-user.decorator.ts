import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Pulls the user JwtStrategy.validate() attached to the request, so
// controllers never have to reach into the raw Express request themselves.
// Reused by every future @UseGuards(JwtAuthGuard) route, not just /me.
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
