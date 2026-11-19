import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { usernameFor } from './utils/username';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar');
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const existingUsernames = await this.prisma.user.findMany({
      select: { username: true },
    });
    const used = new Set(
      existingUsernames
        .map((u) => u.username?.toLowerCase())
        .filter((value): value is string => Boolean(value)),
    );

    const username = dto.username
      ? dto.username.toLowerCase()
      : usernameFor(dto.email, used);
    if (used.has(username.toLowerCase())) {
      throw new ConflictException('Username sudah terdaftar');
    }

    const user = await this.prisma.user.create({
      data: { email: dto.email, password: hashed, username },
    });

    return { id: user.id, email: user.email, username: user.username };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const passwordMatch =
      user && (await bcrypt.compare(dto.password, user.password));

    if (!user || !passwordMatch) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken };
  }
}