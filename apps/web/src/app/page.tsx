import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server';

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? '/bar' : '/login');
}
