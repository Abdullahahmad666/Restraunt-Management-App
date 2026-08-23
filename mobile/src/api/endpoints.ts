/**
 * Every backend path in one place, mirroring backend/config/urls.py.
 *
 * The staff/admin split is not cosmetic - the backend answers a staff token on
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
    attendance: {
      // One endpoint for both directions - the server decides which it is
      // from whether an open check-in already exists today.
      scan: `${STAFF}/attendance/scan/`,
      myLogs: `${STAFF}/attendance/logs/`,
    },
    payroll: {
      mySummary: `${STAFF}/payroll/summary/`,
    },
    compliance: {
      myTasks: `${STAFF}/compliance/tasks/`,
      task: (id: string) => `${STAFF}/compliance/tasks/${id}/`,
      complete: (id: string) => `${STAFF}/compliance/tasks/${id}/complete/`,
      correctiveAction: (id: string) => `${STAFF}/compliance/tasks/${id}/corrective-action/`,
    },
    equipment: {
      list: `${STAFF}/equipment/`,
    },
  },

  admin: {
    staff: {
      list: `${ADMIN}/staff/`,
      detail: (id: string) => `${ADMIN}/staff/${id}/`,
      barcode: (id: string) => `${ADMIN}/staff/${id}/barcode/`,
    },
    attendance: {
      live: `${ADMIN}/attendance/live/`,
      logs: `${ADMIN}/attendance/logs/`,
      log: (id: string) => `${ADMIN}/attendance/logs/${id}/`,
    },
    payroll: {
      periods: `${ADMIN}/payroll/periods/`,
      summary: `${ADMIN}/payroll/summary/`,
    },
    compliance: {
      dashboard: `${ADMIN}/compliance/dashboard/`,
      tasks: `${ADMIN}/compliance/tasks/`,
      history: `${ADMIN}/compliance/history/`,
      templates: `${ADMIN}/compliance/templates/`,
    },
    equipment: {
      list: `${ADMIN}/equipment/`,
      detail: (id: string) => `${ADMIN}/equipment/${id}/`,
    },
    notifications: {
      list: `${ADMIN}/notifications/`,
    },
    audit: {
      list: `${ADMIN}/audit/`,
    },
  },
} as const;
