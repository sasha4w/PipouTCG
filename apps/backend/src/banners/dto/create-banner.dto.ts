import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  ValidateIf,
} from 'class-validator';
import { BannerItemType } from '../banner.entity';

export class CreateBannerDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsEnum(BannerItemType)
  itemType!: BannerItemType;

  @IsNumber()
  itemId!: number;

  @IsString()
  itemName!: string;

  @IsNumber()
  @Min(0)
  originalPrice!: number;

  @IsNumber()
  @Min(0)
  bannerPrice!: number;

  @IsDateString()
  startDate!: string;

  /** Obligatoire uniquement si isPermanent est false/absent */
  @ValidateIf((o) => !o.isPermanent)
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isPermanent?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
