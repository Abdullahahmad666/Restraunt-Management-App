/** The paperwork a manager produces when an inspector asks for it. */

export type DocumentCategory = {
  id: string;
  /** The restaurant's own word for this kind of paperwork. */
  name: string;
  sort_order: number;
  is_active: boolean;
  document_count: number;
};

export type ComplianceDocument = {
  id: string;
  category: string | null;
  category_name: string | null;
  title: string;
  /** A signed URL that expires. Always use one fresh from the API rather than
   * remembering it - see the storage settings for why these are not public. */
  file: string;
  content_type: string;
  /** Whether to draw it or hand it to the phone's own viewer. Decided by the
   * server from the file's own bytes, not from its name. */
  is_image: boolean;
  notes: string;
  expires_on: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

export type NewDocument = {
  title: string;
  category?: string | null;
  notes?: string;
  expires_on?: string | null;
};
