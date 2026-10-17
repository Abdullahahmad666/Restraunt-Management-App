/** Admin-only calls for compliance paperwork. There is no staff equivalent of
 * any of this - the backend has no route for one. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Paginated} from '../../types/api';
import type {PreparedFile} from '../../utils/media';
import type {ComplianceDocument, DocumentCategory, NewDocument} from './types';

export async function listCategories(): Promise<Paginated<DocumentCategory>> {
  const {data} = await apiClient.get<Paginated<DocumentCategory>>(
    endpoints.admin.compliance.documentCategories,
  );
  return data;
}

export async function createCategory(name: string): Promise<DocumentCategory> {
  const {data} = await apiClient.post<DocumentCategory>(
    endpoints.admin.compliance.documentCategories,
    {name},
  );
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(endpoints.admin.compliance.documentCategory(id));
}

export async function listDocuments(params?: {
  category?: string;
}): Promise<Paginated<ComplianceDocument>> {
  const {data} = await apiClient.get<Paginated<ComplianceDocument>>(
    endpoints.admin.compliance.documents,
    {params},
  );
  return data;
}

/** Uploading can be slow on restaurant wifi and a certificate is a photograph,
 * so this gets a longer timeout than the shared default. */
const UPLOAD_TIMEOUT_MS = 60_000;

export async function uploadDocument(
  file: PreparedFile,
  details: NewDocument,
): Promise<ComplianceDocument> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
  form.append('title', details.title);
  if (details.category) {
    form.append('category', details.category);
  }
  if (details.notes) {
    form.append('notes', details.notes);
  }
  if (details.expires_on) {
    form.append('expires_on', details.expires_on);
  }

  const {data} = await apiClient.post<ComplianceDocument>(
    endpoints.admin.compliance.documents,
    form,
    {
      headers: {'Content-Type': 'multipart/form-data'},
      transformRequest: value => value,
      timeout: UPLOAD_TIMEOUT_MS,
    },
  );
  return data;
}

export async function updateDocument(
  id: string,
  input: Partial<NewDocument>,
): Promise<ComplianceDocument> {
  const {data} = await apiClient.patch<ComplianceDocument>(
    endpoints.admin.compliance.document(id),
    input,
  );
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(endpoints.admin.compliance.document(id));
}
