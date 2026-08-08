/** A catalogue category. Response element of `GET /categories`. */
export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  /** How many products the category currently holds. */
  productCount: number;
};
