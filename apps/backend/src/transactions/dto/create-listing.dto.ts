import { IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
import { ProductType } from '@pipou/shared';

export class CreateListingDto {
  @IsEnum(ProductType)
  @IsNotEmpty()
  productType!: ProductType;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  productId!: number;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  quantity!: number;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  unitPrice!: number;
}
