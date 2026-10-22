import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  faceEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  privacyMode?: boolean;

  @IsOptional()
  @IsBoolean()
  notifications?: boolean;
}
