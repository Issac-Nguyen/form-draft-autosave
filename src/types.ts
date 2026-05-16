export type FieldType = 'text' | 'textarea' | 'contenteditable';

export interface DraftField {
  sig: string;
  value: string;
  type: FieldType;
  truncated?: boolean;
  label?: string;
}

export interface DraftRecord {
  origin: string;
  path: string;
  fields: Record<string, DraftField>;
  ts: number; // last write, epoch ms
}

export const DRAFT_PREFIX = 'draft:';
export const draftKey = (origin: string, path: string) => `${DRAFT_PREFIX}${origin}${path}`;
