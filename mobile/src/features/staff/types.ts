/** Staff-account shape, as seen by an admin managing their restaurant's team. */
import type {Role} from '../../types/roles';

export type StaffAccount = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: Role;
  is_active: boolean;
  created_at: string;
};
