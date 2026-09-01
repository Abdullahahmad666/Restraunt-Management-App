/**
 * Every backend path in one place, mirroring backend/config/urls.py.
 *
 * config/urls.py mounts every domain's staff_urlpatterns/admin_urlpatterns at
 * a bare "" prefix under /api/v1/staff/ and /api/v1/admin/ - there is no
 * per-app URL segment, only each router's own resource prefix. So it's
 * `/staff/shifts/`, not `/staff/attendance/shifts/`. Get this wrong and every
 * call 404s even though the backend feature is real.
 *
 * The staff/admin split is not cosmetic - the backend answers a staff token on
 * an /admin/ path with a 403. Calling the wrong namespace is a bug, so the
 * shape here makes the namespace impossible to forget.
 *
 * Compliance, Equipment and Audit have no endpoints below: those Django apps
 * have no models or routes yet (see backend/apps/{compliance,equipment,audit}),
 * so there is nothing real to call.
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
    changePassword: '/auth/change-password/',
    passwordReset: '/auth/password-reset/',
    passwordResetConfirm: '/auth/password-reset/confirm/',
  },

  staff: {
    attendance: {
      // One endpoint for both directions - the server decides which it is
      // from whether an open check-in already exists today.
      scan: `${STAFF}/scan/`,
      shifts: `${STAFF}/shifts/`,
      logs: `${STAFF}/logs/`,
    },
    payroll: {
      entries: `${STAFF}/entries/`,
      entry: (id: string) => `${STAFF}/entries/${id}/`,
      summary: `${STAFF}/summary/`,
    },
    notifications: {
      devices: `${STAFF}/devices/`,
      list: `${STAFF}/notifications/`,
      markRead: (id: string) => `${STAFF}/notifications/${id}/mark-read/`,
    },
  },

  admin: {
    staffAccounts: {
      list: `${ADMIN}/staff-accounts/`,
      detail: (id: string) => `${ADMIN}/staff-accounts/${id}/`,
    },
    attendance: {
      shifts: `${ADMIN}/shifts/`,
      shift: (id: string) => `${ADMIN}/shifts/${id}/`,
      logs: `${ADMIN}/logs/`,
      log: (id: string) => `${ADMIN}/logs/${id}/`,
      live: `${ADMIN}/logs/live/`,
      qrCodes: `${ADMIN}/qr-codes/`,
      qrCode: (id: string) => `${ADMIN}/qr-codes/${id}/`,
      regenerateQrCode: (id: string) => `${ADMIN}/qr-codes/${id}/regenerate/`,
    },
    payroll: {
      rates: `${ADMIN}/rates/`,
      rate: (id: string) => `${ADMIN}/rates/${id}/`,
      periods: `${ADMIN}/periods/`,
      period: (id: string) => `${ADMIN}/periods/${id}/`,
      closePeriod: (id: string) => `${ADMIN}/periods/${id}/close/`,
      markPeriodPaid: (id: string) => `${ADMIN}/periods/${id}/mark-paid/`,
      periodEntries: (id: string) => `${ADMIN}/periods/${id}/entries/`,
      entries: `${ADMIN}/entries/`,
      reallocateEntry: (id: string) => `${ADMIN}/entries/${id}/reallocate/`,
      costReport: `${ADMIN}/cost-report/`,
      staffSummary: (staffId: string) => `${ADMIN}/staff-summary/${staffId}/`,
    },
    notifications: {
      list: `${ADMIN}/notifications/`,
    },
  },
} as const;
