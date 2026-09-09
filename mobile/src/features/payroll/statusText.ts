/**
 * Plain-language versions of the OPEN/LOCKED/PAID pay period status codes.
 * The codes themselves stay as the backend defines them (see
 * apps.payroll.models.PayPeriod.Status) - only the words shown on screen
 * change, in one place, so both the manager and staff pay screens explain
 * the same three-step lifecycle the same way instead of each screen
 * inventing its own wording for it.
 */
import type {PayPeriodStatus} from './types';

export const PAY_PERIOD_STATUS_LABEL: Record<PayPeriodStatus, string> = {
  OPEN: 'In progress',
  LOCKED: 'Ready to pay',
  PAID: 'Paid',
};

/** Shown to the manager, who is the one who moves a period through the
 * three steps. */
export const PAY_PERIOD_MANAGER_HINT: Record<PayPeriodStatus, string> = {
  OPEN: 'Still collecting hours. Once the two weeks are up, finish it below to work out the pay.',
  LOCKED:
    "Pay is worked out and hours are locked in. Once you've actually paid your staff, mark it as paid.",
  PAID: 'Done - this one is finished and your staff have been paid.',
};

/** Shown to staff, who can only watch a period move through the steps. */
export const PAY_PERIOD_STAFF_HINT: Record<PayPeriodStatus, string> = {
  OPEN: 'Still being worked - the total below will keep changing.',
  LOCKED: 'Hours are final and pay is worked out. Waiting on your manager to pay it.',
  PAID: 'Paid.',
};
