/** An invite code, as seen by the admin who issued it. */
import type {Role} from '../../types/roles';

export type InviteCode = {
  id: string;
  code: string;
  /**
   * Prebuilt `invisiko://join?code=...`. Share this AND the bare code: the
   * custom scheme does nothing on a phone that does not have the app yet,
   * which is most of an invite's audience.
   */
  invite_link: string;
  role: Role;
  restaurant: string;
  expires_at: string;
  used_at: string | null;
  is_usable: boolean;
  created_at: string;
};
