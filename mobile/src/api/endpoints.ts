/**
 * Every backend path in one place, mirroring backend/config/urls.py.
 *
 * The staff/admin split is not cosmetic - the backend rejects a staff token on
 * an /admin/ path with a 403. Calling the wrong namespace is a bug, so the
 * shape here makes the namespace impossible to forget.
 */
const STAFF = '/staff';
const ADMIN = '/admin';

export const endpoints = {
  // Role-agnostic: you have no role until you have logged in.
  auth: {
    register: '/auth/register/',
    login: '/auth/login/',
    refresh: '/auth/refresh/',
    logout: '/auth/logout/',
    me: '/auth/me/',
  },

  staff: {
    restaurants: {
      list: `${STAFF}/restaurants/`,
      detail: (id: string) => `${STAFF}/restaurants/${id}/`,
    },
    tables: {
      list: `${STAFF}/tables/`,
      detail: (id: string) => `${STAFF}/tables/${id}/`,
    },
    orders: {
      list: `${STAFF}/orders/`,
      detail: (id: string) => `${STAFF}/orders/${id}/`,
    },
    inventory: {
      list: `${STAFF}/inventory/`,
      detail: (id: string) => `${STAFF}/inventory/${id}/`,
    },
  },

  admin: {
    restaurants: {
      list: `${ADMIN}/restaurants/`,
      detail: (id: string) => `${ADMIN}/restaurants/${id}/`,
    },
    tables: {
      list: `${ADMIN}/tables/`,
      detail: (id: string) => `${ADMIN}/tables/${id}/`,
    },
    orders: {
      list: `${ADMIN}/orders/`,
      detail: (id: string) => `${ADMIN}/orders/${id}/`,
    },
    inventory: {
      list: `${ADMIN}/inventory/`,
      detail: (id: string) => `${ADMIN}/inventory/${id}/`,
    },
    payments: {
      list: `${ADMIN}/payments/`,
      detail: (id: string) => `${ADMIN}/payments/${id}/`,
    },
  },
} as const;
