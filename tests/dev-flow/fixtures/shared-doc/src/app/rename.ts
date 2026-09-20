import { normalize } from '../domain/title';
import { Note } from './create';

export function renameNote(n: Note, raw: string): Note {
  return { title: normalize(raw), body: n.body };
}
