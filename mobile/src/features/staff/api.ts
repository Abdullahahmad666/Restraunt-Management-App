/** Calls to /admin/staff-accounts/ - adding, editing and deactivating staff. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Paginated} from '../../types/api';
import type {StaffAccount} from './types';

export async function listStaff(): Promise<Paginated<StaffAccount>> {
  const {data} = await apiClient.get<Paginated<StaffAccount>>(endpoints.admin.staffAccounts.list);
  return data;
}

export type CreateStaffInput = {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  password?: string;
};

export async function createStaff(input: CreateStaffInput): Promise<StaffAccount> {
  const {data} = await apiClient.post<StaffAccount>(endpoints.admin.staffAccounts.list, input);
  return data;
}

export type UpdateStaffInput = Partial<
  Pick<StaffAccount, 'first_name' | 'last_name' | 'phone' | 'is_active'>
> & {password?: string};

export async function updateStaff(id: string, input: UpdateStaffInput): Promise<StaffAccount> {
  const {data} = await apiClient.patch<StaffAccount>(
    endpoints.admin.staffAccounts.detail(id),
    input,
  );
  return data;
}
