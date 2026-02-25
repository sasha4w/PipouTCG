import { IsEnum, IsNumber, IsNotEmpty, Min } from 'class-validator';
import { ProductType } from '../enums/product-type.enum';

export class CreateListingDto {
  @IsEnum(ProductType)
  @IsNotEmpty()
  productType: ProductType;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  productId: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  quantity: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  unitPrice: number;
}
