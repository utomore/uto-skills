import { HttpReq, HttpRes, createNote, noteTitle } from '../app/create';
import { renameNote } from '../app/rename';

export function createHandler(req: HttpReq): HttpRes {
  return { status: 200, body: noteTitle(createNote(req.title, req.body)) };
}

export function renameHandler(req: HttpReq): HttpRes {
  return { status: 200, body: noteTitle(renameNote(createNote('', req.body), req.title)) };
}
