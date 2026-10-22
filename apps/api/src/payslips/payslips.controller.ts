import { Body, Controller, Get, Post, UploadedFile, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { UPLOAD_LIMITS } from '../imports/imports.controller';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import { PayslipsService } from './payslips.service';

const validate = new ValidationPipe({ whitelist: true, transform: true });

@Controller()
export class PayslipsController {
  constructor(private readonly payslips: PayslipsService) {}

  /** multipart `file` (PDF) ou JSON `{month, gross, net, items}`. */
  @Post('imports/holerite')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) return this.payslips.importFile(user.id, file, typeof body?.month === 'string' ? body.month : undefined);
    const dto = (await validate.transform(body ?? {}, { type: 'body', metatype: CreatePayslipDto })) as CreatePayslipDto;
    return this.payslips.save(user.id, dto);
  }

  @Get('payslips')
  list(@CurrentUser() user: AuthUser) {
    return this.payslips.list(user.id);
  }

  @Get('payslips/latest')
  latest(@CurrentUser() user: AuthUser) {
    return this.payslips.latest(user.id);
  }
}
