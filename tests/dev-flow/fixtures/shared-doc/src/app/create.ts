import { Title, normalize, titleText } from '../domain/title';

export type Note = { readonly title: Title; readonly body: string };
export type HttpReq = { readonly path: string; readonly title: string; readonly body: string };
export type HttpRes = { readonly status: number; readonly body: string };

export function createNote(raw: string, body: string): Note {
  return { title: normalize(raw), body };
}

export function noteTitle(n: Note): string {
  return titleText(n.title);
}
