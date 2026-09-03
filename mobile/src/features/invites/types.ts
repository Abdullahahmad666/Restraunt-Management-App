/** An invite code, as seen by the admin who issued it. */
import type {Role} from '../../types/roles';

export type InviteCode = {
  id: string;
  code: string;
  /** Prebuilt `invisiko://join?code=...` - share this, not the bare code. */
  invite_link: string;
  role: Role;
  restaurant: string;
  expires_at: string;
  used_at: string | null;
  is_usable: boolean;
  created_at: string;
};
