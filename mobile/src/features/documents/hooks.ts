/** react-query wrappers for compliance paperwork. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';
import type {NewDocument} from './types';
import type {PreparedFile} from '../../utils/media';

const keys = {
  categories: ['documents', 'categories'] as const,
  // The filter is part of the key, so switching category refetches rather
  // than showing the last one's documents under the new heading.
  documents: (category?: string) => ['documents', 'list', category ?? 'all'] as const,
};

export function useDocumentCategories() {
  return useQuery({queryKey: keys.categories, queryFn: api.listCategories});
}

export function useDocuments(category?: string) {
  return useQuery({
    queryKey: keys.documents(category),
    queryFn: () => api.listDocuments(category ? {category} : undefined),
  });
}

/** Everything that changes a document also changes a category's count, so both
 * lists are invalidated together rather than leaving "3 documents" under a
 * category holding four. */
function useRefreshAll() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({queryKey: ['documents']});
  };
}

export function useCreateCategory() {
  const refresh = useRefreshAll();
  return useMutation({mutationFn: api.createCategory, onSuccess: refresh});
}

export function useDeleteCategory() {
  const refresh = useRefreshAll();
  return useMutation({mutationFn: api.deleteCategory, onSuccess: refresh});
}

export function useUploadDocument() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({file, details}: {file: PreparedFile; details: NewDocument}) =>
      api.uploadDocument(file, details),
    onSuccess: refresh,
  });
}

export function useUpdateDocument() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: Partial<NewDocument>}) =>
      api.updateDocument(id, input),
    onSuccess: refresh,
  });
}

export function useDeleteDocument() {
  const refresh = useRefreshAll();
  return useMutation({mutationFn: api.deleteDocument, onSuccess: refresh});
}
