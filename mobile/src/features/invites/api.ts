/** Calls to /admin/invite-codes/ - issuing and revoking staff invite links. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import {ROLES} from '../../types/roles';
import type {Paginated} from '../../types/api';
import type {InviteCode} from './types';

export async function listInviteCodes(): Promise<Paginated<InviteCode>> {
  const {data} = await apiClient.get<Paginated<InviteCode>>(endpoints.admin.inviteCodes.list);
  return data;
}

/** Always STAFF: the "Set up your takeaway" screen is how an admin account
 * gets made, so there is no admin-inviting-admin flow to build here. */
export async function createStaffInvite(): Promise<InviteCode> {
  const {data} = await apiClient.post<InviteCode>(endpoints.admin.inviteCodes.list, {
    role: ROLES.STAFF,
  });
  return data;
}

export async function revokeInviteCode(id: string): Promise<void> {
  await apiClient.delete(endpoints.admin.inviteCodes.detail(id));
}
