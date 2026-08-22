/**
 * Every backend path in one place, mirroring backend/config/urls.py.
 *
 * When the API changes, this file changes - not a dozen call sites.
 */
export const endpoints = {
  auth: {
    register: '/auth/register/',
    login: '/auth/login/',
    refresh: '/auth/refresh/',
    logout: '/auth/logout/',
    me: '/auth/me/',
  },
  restaurants: {
    list: '/restaurants/',
    detail: (id: string) => `/restaurants/${id}/`,
  },
  orders: {
    list: '/orders/',
    detail: (id: string) => `/orders/${id}/`,
  },
  inventory: {
    list: '/inventory/',
    detail: (id: string) => `/inventory/${id}/`,
  },
  payments: {
    list: '/payments/',
    detail: (id: string) => `/payments/${id}/`,
  },
} as const;
