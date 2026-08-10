import { IsIn, IsOptional } from 'class-validator';
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  LOCALES,
  type Currency,
  type Locale,
  type LocalisedQuery,
  type PricedQuery,
} from '@imix/types';

/**
 * The two knobs every catalogue request carries. Both default rather than
 * fail, so a bare `GET /products` still answers — in Russian roubles, which is
 * what the shop is.
 *
 * `@IsIn` over the exported const arrays means adding a locale or a currency to
 * `@imix/types` is all it takes for the API to accept it.
 */
export class LocalisedQueryDto implements LocalisedQuery {
  @IsOptional()
  @IsIn(LOCALES, { message: `locale must be one of: ${LOCALES.join(', ')}` })
  locale?: Locale = DEFAULT_LOCALE;
}

export class PricedQueryDto extends LocalisedQueryDto implements PricedQuery {
  @IsOptional()
  @IsIn(CURRENCIES, {
    message: `currency must be one of: ${CURRENCIES.join(', ')}`,
  })
  currency?: Currency = DEFAULT_CURRENCY;
}
