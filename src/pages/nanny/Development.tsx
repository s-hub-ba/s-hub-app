import { useEffect, useMemo, useState } from 'react';
import { Bot, Coins, Sparkles, TrendingUp } from 'lucide-react';
import {
  captureNannyPaypalOrder,
  createNannyDevelopmentSession,
  getNannyCreditWallet,
  getNannyDevelopmentSessions,
  getNannyPremiumAnalytics,
  startNannyCreditsCheckout,
  startNannyPremiumCheckout,
} from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const QUICK_PROMPTS = [
  'How can I improve my acceptance rate this month?',
  'Give me a better profile bio structure for premium jobs.',
  'What should I do in the next 7 days to increase interviews?'
];

export default function NannyDevelopment() {
  const { user } = useAuth();
  const nannyId = user?.uid || '';

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  const loadData = async () => {
    if (!nannyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [premiumAnalytics, creditWallet, history] = await Promise.all([
        getNannyPremiumAnalytics(nannyId),
        getNannyCreditWallet(nannyId),
        getNannyDevelopmentSessions(nannyId)
      ]);
      setAnalytics(premiumAnalytics);
      setWallet(creditWallet);
      setSessions(history);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [nannyId]);

  const lowCredits = useMemo(() => Number(wallet?.balance_credits || 0) < 2, [wallet]);

  const handleRunAgent = async () => {
    if (!nannyId || !prompt.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      await createNannyDevelopmentSession({
        nannyId,
        prompt: prompt.trim()
      });
      setPrompt('');
      await loadData();
    } catch (runError: any) {
      setError(runError?.message || 'Unable to run development agent right now.');
    } finally {
      setRunning(false);
    }
  };

  const handleTopUpCredits = async () => {
    if (!nannyId || !user?.uid || toppingUp) return;
    setToppingUp(true);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}/nanny/development?paypal_checkout=nanny_order_success`;
      const cancelUrl = `${window.location.origin}/nanny/development?paypal_checkout=nanny_order_cancelled`;
      const result = await startNannyCreditsCheckout({ nannyId, userId: user.uid, credits: 5, returnUrl, cancelUrl });
      if (result?.simulatedApplied) {
        await loadData();
        return;
      }
      if (result?.approvalUrl) {
        window.location.href = result.approvalUrl;
        return;
      }
      throw new Error('No approval URL returned for credit purchase.');
    } catch (checkoutError: any) {
      setError(checkoutError?.message || 'Unable to top up credits right now.');
    } finally {
      setToppingUp(false);
    }
  };

  const handleUpgradePremium = async () => {
    if (!nannyId || !user?.uid || toppingUp) return;
    setToppingUp(true);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}/nanny/development?paypal_checkout=nanny_order_success`;
      const cancelUrl = `${window.location.origin}/nanny/development?paypal_checkout=nanny_order_cancelled`;
      const result = await startNannyPremiumCheckout({ nannyId, userId: user.uid, months: 1, returnUrl, cancelUrl });
      if (result?.simulatedApplied) {
        await loadData();
        return;
      }
      if (result?.approvalUrl) {
        window.location.href = result.approvalUrl;
        return;
      }
      throw new Error('No approval URL returned for premium checkout.');
    } catch (checkoutError: any) {
      setError(checkoutError?.message || 'Unable to start premium checkout right now.');
    } finally {
      setToppingUp(false);
    }
  };

  useEffect(() => {
    const completePayPalReturn = async () => {
      if (!nannyId || !user?.uid) return;
      const params = new URLSearchParams(window.location.search);
      const checkoutState = params.get('paypal_checkout');
      const orderId = params.get('token');

      if (checkoutState === 'nanny_order_cancelled') {
        setError('Checkout was cancelled before payment completed.');
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      if (checkoutState !== 'nanny_order_success' || !orderId) return;

      setToppingUp(true);
      try {
        await captureNannyPaypalOrder({ orderId, nannyId, userId: user.uid });
        await loadData();
      } catch (captureError: any) {
        setError(captureError?.message || 'Unable to finalize your PayPal payment.');
      } finally {
        setToppingUp(false);
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    completePayPalReturn();
  }, [nannyId, user]);

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  if (!nannyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to use the development agent.</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Development Agent</h1>
          <p className="text-stone-500 mt-1">Premium coaching powered by your live profile analytics and credits.</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-8 text-stone-500">Loading premium analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Premium Access</p>
              <p className={`mt-3 text-xl font-bold ${analytics?.is_premium ? 'text-emerald-700' : 'text-amber-700'}`}>
                {analytics?.is_premium ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Credits</p>
              <p className="mt-3 text-3xl font-bold text-stone-900 inline-flex items-center gap-2">
                <Coins className="h-6 w-6 text-amber-500" />
                {Number(wallet?.balance_credits || 0)}
              </p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Acceptance Rate</p>
              <p className="mt-3 text-3xl font-bold text-stone-900">{analytics?.acceptance_rate_pct || 0}%</p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">30d Application Velocity</p>
              <p className="mt-3 text-3xl font-bold text-stone-900 inline-flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
                {analytics?.application_velocity_30d || 0}
              </p>
            </div>
          </div>

          {!analytics?.is_premium ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
              <p>Development Agent is available for premium nannies. Upgrade premium access to unlock credit-based coaching sessions.</p>
              <button
                type="button"
                onClick={handleUpgradePremium}
                disabled={toppingUp}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-60"
              >
                {toppingUp ? 'Starting checkout...' : 'Upgrade to Premium ($19/mo)'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-stone-900 inline-flex items-center gap-2">
                    <Bot className="h-5 w-5 text-emerald-600" />
                    Ask Development Agent
                  </h2>
                  <button
                    type="button"
                    onClick={handleTopUpCredits}
                    disabled={toppingUp}
                    className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 disabled:opacity-60"
                  >
                    {toppingUp ? 'Starting checkout...' : 'Buy 5 credits ($10)'}
                  </button>
                </div>

                {lowCredits && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Low credits: top up to keep running sessions.
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPrompt(item)}
                      className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50"
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt((e.target as HTMLInputElement).value)}
                  rows={6}
                  placeholder="Example: Help me improve my conversion from interview invites to accepted placements."
                  className="w-full rounded-2xl border border-stone-200 p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="button"
                  onClick={handleRunAgent}
                  disabled={running || !prompt.trim() || Number(wallet?.balance_credits || 0) < 1}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {running ? 'Running...' : 'Run Agent (1 credit)'}
                </button>
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-stone-900 mb-4">Recent Agent Sessions</h2>
                <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                  {sessions.length === 0 ? (
                    <div className="text-sm text-stone-500">No sessions yet. Ask the agent for your first personalized growth plan.</div>
                  ) : (
                    sessions.slice(0, 10).map((session) => (
                      <div key={session.id} className="rounded-2xl border border-stone-200 p-4">
                        <p className="text-xs font-semibold text-stone-500">{toDate(session.created_at)?.toLocaleString() || 'Unknown time'}</p>
                        <p className="text-sm font-semibold text-stone-900 mt-2">Prompt</p>
                        <p className="text-sm text-stone-700 whitespace-pre-wrap">{session.prompt}</p>
                        <p className="text-sm font-semibold text-stone-900 mt-3">Response</p>
                        <p className="text-sm text-stone-700 whitespace-pre-wrap">{session.response}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
