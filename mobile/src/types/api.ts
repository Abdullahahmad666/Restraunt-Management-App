/** Shapes returned by the DRF backend. Keep in sync with /api/schema/. */

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type UserRole = 'OWNER' | 'MANAGER' | 'CHEF' | 'WAITER' | 'CASHIER';

export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: UserRole;
  restaurant: string | null;
};

export type TokenPairResponse = {
  access: string;
  refresh: string;
};

/** DRF validation errors: {"field": ["message"], "detail": "message"} */
export type ApiErrorBody = {
  detail?: string;
} & Record<string, string[] | string | undefined>;
