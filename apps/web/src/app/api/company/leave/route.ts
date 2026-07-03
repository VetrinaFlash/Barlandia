import { leaveCompany } from '@barlandia/shared';
import { env, errorJson, json, requireUser } from '@/lib/server';

/** Lascia la propria compagnia (scioglie se si era l'ultimo membro). */
export async function POST(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const result = await leaveCompany(env().DB, user.id);
  if (!result.ok) {
    return errorJson(400, result.error, 'Non fai parte di nessuna compagnia');
  }
  return json({ ok: true, disbanded: result.disbanded });
}
