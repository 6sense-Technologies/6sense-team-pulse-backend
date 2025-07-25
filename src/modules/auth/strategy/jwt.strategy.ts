import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Organization } from 'src/schemas/Organization.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: new ConfigService().get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    console.log(payload);
    return {
      userId: payload.userId,
      email: payload.email,
      organizationId: payload.organizationId,
    };
  }
}
