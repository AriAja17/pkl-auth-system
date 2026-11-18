    import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class ArticleDto {
  @IsString({ message: 'Judul wajib diisi' })
  @IsNotEmpty({ message: 'Judul wajib diisi' })
  @Matches(/\S/, { message: 'Judul wajib diisi' })
  @MaxLength(150, { message: 'Judul maksimal 150 karakter' })
  title: string;

  @IsString({ message: 'Isi artikel wajib diisi' })
  @IsNotEmpty({ message: 'Isi artikel wajib diisi' })
  @Matches(/\S/, { message: 'Isi artikel wajib diisi' })
  content: string;
}