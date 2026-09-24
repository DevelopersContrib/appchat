import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getSession } from '@/lib/auth.js';
import { findInvite, acceptInvite, INVITE_COOKIE } from '@/lib/invites.js';

export const metadata = { title: 'Join workspace' };

// Invite link landing page: signed in → join now; otherwise remember the invite and sign in first.
export default async function JoinPage({ params }) {
  const { token } = await params;
  const invite = await findInvite(token);
  if (!invite) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-950 text-gray-200 p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-semibold">This invite link isn’t valid</h1>
          <p className="text-sm text-gray-400">It may have expired, been used up, or been turned off. Ask for a new one.</p>
          <Link href="/login" className="inline-block px-4 py-2 rounded-lg bg-gray-800 text-sm">Go to sign in</Link>
        </div>
      </div>
    );
  }

  const user = await getSession();
  if (user) {
    const { url } = await acceptInvite(invite, user.id);
    redirect(url);
  }

  // Not signed in: the sign-in page reads this cookie and joins them to the workspace after login.
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-950 text-gray-200 p-6">
      <div className="max-w-sm w-full rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center space-y-4">
        <img src={`https://www.brandidentity.com/logo/${invite.tenant_domain || `${invite.slug}.com`}`} alt="" className="h-10 mx-auto" />
        <h1 className="text-lg font-semibold">You’re invited to {invite.tenant_name}</h1>
        <p className="text-sm text-gray-400">Sign in with your email to join. No password needed.</p>
        <form action={`/join/${token}/accept`} method="post">
          <button className="w-full py-2.5 rounded-lg bg-[#d63031] hover:bg-[#c0392b] text-sm font-medium text-white">Continue</button>
        </form>
      </div>
    </div>
  );
}
