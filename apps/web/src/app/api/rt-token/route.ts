import { AUTH, signToken } from '@barlandia/shared';
import { env, json, requireUser } from '@/lib/server';

/**
 * Rilascia un token a vita breve (60s) per aprire il WebSocket verso il
 * worker realtime. Il client non parla mai col Durable Object: il worker
 * verifica questo token prima dell'upgrade.
 */
export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const token = await signToken(
    {
      uid: user.id,
      usr: user.username,
      cs: user.colorScheme,
      top: user.outfit,
      scp: 'rt',
      exp: Math.floor(Date.now() / 1000) + AUTH.rtTokenTtlSeconds,
    },
    env().SESSION_SECRET,
  );
  return json({ token, url: `${env().REALTIME_WS_URL}/connect` });
}
