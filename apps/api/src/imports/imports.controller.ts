import { BadRequestException, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { ImportsService } from './imports.service';

export const UPLOAD_LIMITS = { limits: { fileSize: 10 * 1024 * 1024 } };

@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.imports.list(user.id);
  }

  @Post('extrato')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  extrato(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Envie o arquivo no campo "file"');
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.imports.importExtratoFile(user.id, name, file.buffer);
  }
}
