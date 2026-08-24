/** Shapes returned by the DRF backend. Keep in sync with /api/schema/. */
import type {Role} from './roles';

/** Re-exported so callers can get every API type from this one module. */
export type {Role};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: Role;
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
