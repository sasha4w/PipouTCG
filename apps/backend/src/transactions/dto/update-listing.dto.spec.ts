import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateListingDto } from './update-listing.dto';

const errorsFor = async (body: object) =>
  validate(plainToInstance(UpdateListingDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('UpdateListingDto', () => {
  it('accepts a quantity-only update', async () => {
    expect(await errorsFor({ quantity: 4 })).toHaveLength(0);
  });

  it('accepts a price-only update', async () => {
    expect(await errorsFor({ unitPrice: 50 })).toHaveLength(0);
  });

  // Régression : le front renvoyait le prix BIGINT tel que lu en BDD ("500")
  it('rejects a price sent as a string', async () => {
    const errors = await errorsFor({ quantity: 4, unitPrice: '500' });
    expect(errors.map((e) => e.property)).toEqual(['unitPrice']);
  });

  it('rejects an empty body', async () => {
    expect(await errorsFor({})).not.toHaveLength(0);
  });
});
