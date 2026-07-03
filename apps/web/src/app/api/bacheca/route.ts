import { eventoDelGiorno } from '@barlandia/shared';
import { json, requireUser } from '@/lib/server';

export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return json({ oggi: eventoDelGiorno(new Date()) });
}
