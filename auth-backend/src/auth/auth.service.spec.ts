import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService — login', () => {
  const password = 'secret123';
  let hashed: string;
  let prisma: any;
  let jwt: any;
  let service: AuthService;

  beforeEach(async () => {
    hashed = await bcrypt.hash(password, 10);
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  const userRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'user@example.com',
    password: hashed,
    isActive: true,
    ...overrides,
  });

  it('rejects an inactive user without signing a token', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow({ isActive: false }));

    const attempt = service.login({ email: 'user@example.com', password });
    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(attempt).rejects.toThrow('Email atau password salah');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('lets an active user with the right password log in', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());

    await expect(
      service.login({ email: 'user@example.com', password }),
    ).resolves.toEqual({ accessToken: 'signed-token' });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'user-1' });
  });

  it('rejects a wrong password with the same generic message', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());

    await expect(
      service.login({ email: 'user@example.com', password: 'wrong-password' }),
    ).rejects.toThrow('Email atau password salah');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects an unknown email with the same generic message', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@example.com', password }),
    ).rejects.toThrow('Email atau password salah');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
