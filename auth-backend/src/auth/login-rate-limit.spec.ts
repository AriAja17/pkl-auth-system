import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { loginThrottlerOptions } from './login-rate-limit.config';
import { AuthorizationService } from '../authorization/authorization.service';

const dto = { email: 'user@example.com', password: 'secret123' };

describe('POST /auth/login rate limiting', () => {
  const originalLimit = process.env.AUTH_LOGIN_RATE_LIMIT;
  const originalTtl = process.env.AUTH_LOGIN_RATE_TTL_MS;
  let app: INestApplication | undefined;
  let authService: { login: jest.Mock; register: jest.Mock };

  const createApp = async (throttlers: { limit: number; ttl: number }[]) => {
    authService = {
      login: jest.fn().mockResolvedValue({ accessToken: 'signed-token' }),
      register: jest
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'new@example.com', username: 'newuser' }),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers })],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AuthorizationService, useValue: { visibleMenus: jest.fn() } },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn().mockRejectedValue(new Error('invalid token')) },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    return app;
  };

  const login = () => request(app!.getHttpServer()).post('/auth/login').send(dto);

  beforeEach(() => {
    delete process.env.AUTH_LOGIN_RATE_LIMIT;
    delete process.env.AUTH_LOGIN_RATE_TTL_MS;
  });

  afterEach(async () => {
    if (app) await app.close();
    app = undefined;
    if (originalLimit === undefined) delete process.env.AUTH_LOGIN_RATE_LIMIT;
    else process.env.AUTH_LOGIN_RATE_LIMIT = originalLimit;
    if (originalTtl === undefined) delete process.env.AUTH_LOGIN_RATE_TTL_MS;
    else process.env.AUTH_LOGIN_RATE_TTL_MS = originalTtl;
  });

  it('uses 10 requests per 900000 ms by default', () => {
    expect(loginThrottlerOptions()).toEqual({
      throttlers: [{ limit: 10, ttl: 900_000 }],
    });
  });

  it('accepts valid custom environment configuration', () => {
    process.env.AUTH_LOGIN_RATE_LIMIT = '3';
    process.env.AUTH_LOGIN_RATE_TTL_MS = '60000';

    expect(loginThrottlerOptions()).toEqual({
      throttlers: [{ limit: 3, ttl: 60_000 }],
    });
  });

  it('rejects invalid environment configuration clearly', () => {
    for (const value of ['0', '-1', '1.5', 'abc']) {
      process.env.AUTH_LOGIN_RATE_LIMIT = value;
      expect(() => loginThrottlerOptions()).toThrow('AUTH_LOGIN_RATE_LIMIT');
      process.env.AUTH_LOGIN_RATE_LIMIT = '10';

      process.env.AUTH_LOGIN_RATE_TTL_MS = value;
      expect(() => loginThrottlerOptions()).toThrow('AUTH_LOGIN_RATE_TTL_MS');
    }
  });

  it('allows requests under the limit and returns HTTP 429 above it', async () => {
    await createApp([{ limit: 2, ttl: 5_000 }]);

    const first = await login();
    const second = await login();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual({ accessToken: 'signed-token' });
    expect(authService.login).toHaveBeenCalledTimes(2);
    expect(authService.login).toHaveBeenCalledWith(dto);

    const blocked = await login();
    expect(blocked.status).toBe(429);
    expect(authService.login).toHaveBeenCalledTimes(2);
  });

  it('does not throttle other endpoints', async () => {
    await createApp([{ limit: 1, ttl: 5_000 }]);

    for (let index = 0; index < 4; index += 1) {
      const response = await request(app!.getHttpServer())
        .post('/auth/register')
        .send({ email: 'new@example.com', password: 'secret123' });
      expect(response.status).toBe(201);
    }
    expect(authService.register).toHaveBeenCalledTimes(4);
  });

  it('forgets hits once the TTL expires', async () => {
    await createApp([{ limit: 1, ttl: 50 }]);

    expect((await login()).status).toBe(200);
    expect((await login()).status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect((await login()).status).toBe(200);
  });

  it('does not trust X-Forwarded-For as the rate limit tracker', async () => {
    await createApp([{ limit: 2, ttl: 5_000 }]);

    const statuses: number[] = [];
    for (const forwarded of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
      const response = await request(app!.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', forwarded)
        .send(dto);
      statuses.push(response.status);
    }

    expect(statuses).toEqual([200, 200, 429]);
  });

  it('keeps the generic authentication error and JWT response shape', async () => {
    await createApp([{ limit: 5, ttl: 5_000 }]);
    authService.login.mockRejectedValueOnce(
      new UnauthorizedException('Email atau password salah'),
    );

    const failed = await login();
    expect(failed.status).toBe(401);
    expect(failed.body.message).toBe('Email atau password salah');

    const success = await login();
    expect(success.status).toBe(200);
    expect(success.body).toEqual({ accessToken: 'signed-token' });
  });

  it('leaves JWT-protected routes and authorization untouched', async () => {
    await createApp([{ limit: 1, ttl: 5_000 }]);

    for (let index = 0; index < 3; index += 1) {
      const response = await request(app!.getHttpServer()).get('/auth/me');
      expect(response.status).toBe(401);
    }
    expect(authService.login).not.toHaveBeenCalled();
  });
});
