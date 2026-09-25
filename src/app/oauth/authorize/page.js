import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { parseAuthRequest, withParams } from '@/lib/oauth-request.js';

export const metadata = { title: 'Connect an app to AppChat' };

const ABILITIES = [
  'See your workspaces, channels and direct messages',
  'Read and search messages you can see',
  'Post messages as you (marked “via …”)',
  'See who’s online',
  'Search VNOC sprints and add tasks you have access to',
];

export default async function AuthorizePage({ searchParams }) {
  const p = await searchParams;
  const req = await parseAuthRequest(p);
  if (req.redirectError) redirect(withParams(req.redirectUri, { error: req.redirectError, state: req.state }));

  const user = await getSession();
  if (!user && !req.error) {
    redirect(`/oauth/login?next=${encodeURIComponent(`/oauth/authorize?${new URLSearchParams(p)}`)}`);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-950 text-gray-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-5">
        <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-8" />
        {req.error ? (
          <>
            <h1 className="text-lg font-semibold">Can’t connect this app</h1>
            <p className="text-sm text-gray-400">{req.error}</p>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-semibold">Allow <span className="text-[#fdcb6e]">{req.client.client_name}</span> to use AppChat as you?</h1>
              <p className="text-sm text-gray-400 mt-1">Signed in as {user.email}</p>
            </div>
            <ul className="space-y-1.5 text-sm text-gray-300">
              {ABILITIES.map((a) => <li key={a} className="flex gap-2"><span className="text-[#00b894]">✓</span>{a}</li>)}
            </ul>
            <p className="text-xs text-gray-500">It only sees what you can see. Disconnect any time: sidebar → Connect Claude / AI → Revoke.</p>
            <form action="/oauth/authorize/decision" method="post" className="flex gap-2">
              <input type="hidden" name="client_id" value={req.client.client_id} />
              <input type="hidden" name="redirect_uri" value={req.redirectUri} />
              <input type="hidden" name="state" value={req.state} />
              <input type="hidden" name="code_challenge" value={req.codeChallenge} />
              <input type="hidden" name="response_type" value="code" />
              <button name="decision" value="allow" className="flex-1 py-2.5 rounded-lg bg-[#00b894] hover:bg-[#00a383] text-sm font-medium text-white">Allow</button>
              <button name="decision" value="deny" className="px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm">Cancel</button>
            </form>
            <p className="text-[11px] text-gray-600 break-all">Returns to: {new URL(req.redirectUri).origin}</p>
          </>
        )}
      </div>
    </div>
  );
}
