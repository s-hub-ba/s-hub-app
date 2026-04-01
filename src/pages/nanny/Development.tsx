import { useEffect, useMemo, useState } from 'react';
import { Bot, Coins, Sparkles, TrendingUp } from 'lucide-react';
import {
  captureNannyPaypalOrder,
  createNannyDevelopmentSession,
  getNannyCreditWallet,
  getNannyDevelopmentSessions,
  getNannyGrowthProgress,
  getNannyOfficialShiftScore,
  getNannyPremiumAnalytics,
  startNannyCreditsCheckout,
  startNannyPremiumCheckout,
  submitNannyWeeklyQuiz,
  updateNannyGrowthTask,
} from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const QUICK_PROMPTS = [
  'How can I improve my acceptance rate this month?',
  'Give me a better profile bio structure for premium jobs.',
  'What should I do in the next 7 days to increase interviews?'
];

const FREE_GROWTH_TASKS = [
  {
    id: 'free-apply-3',
    title: 'Apply to 3 new shifts this week',
    description: 'Consistent applications increase visibility in agency and family search results.',
    points: 15,
  },
  {
    id: 'free-refresh-calendar',
    title: 'Refresh calendar and availability',
    description: 'Accurate availability improves match quality and reduces declines.',
    points: 10,
  },
  {
    id: 'free-fast-reply',
    title: 'Reply to offers within 12 hours',
    description: 'Fast response behavior improves your reliability and interview conversion.',
    points: 10,
  },
  {
    id: 'free-profile-proof',
    title: 'Add one proof point to your profile',
    description: 'Update your bio with one measurable childcare achievement this week.',
    points: 8,
  },
];

const WEEKLY_COURSES = [
  {
    id: 'course-interview',
    title: 'Interview Messaging Mastery',
    materials: [
      'Use a 3-part opener: greeting, availability, and one family-fit example.',
      'Close every response with one clear next step and two time options.',
      'Mirror family priorities using their exact wording from the post.',
    ],
    question: 'What is the best closing line for a high-conversion reply?',
    options: [
      'Let me know if this works whenever.',
      'I can chat Tue at 5:30 PM or Wed at 7:00 PM. Which is best for you?',
      'Please review my profile and message me if interested.',
    ],
    correctIndex: 1,
    points: 20,
  },
  {
    id: 'course-retention',
    title: 'Reliability and Shift Retention',
    materials: [
      'Confirm shifts at 24h and 3h checkpoints to reduce no-show risk.',
      'Log any lateness risks early and propose a mitigation plan.',
      'Track repeat-family notes so transitions stay smooth week to week.',
    ],
    question: 'Which habit most directly protects your ShiftScore reliability?',
    options: [
      'Waiting until shift start to report issues.',
      'Confirming shifts at 24h and 3h checkpoints.',
      'Applying only on weekends.',
    ],
    correctIndex: 1,
    points: 20,
  },
  {
    id: 'course-profile',
    title: 'Profile Positioning for Premium Matches',
    materials: [
      'Lead with one sentence that states your care style and experience years.',
      'Add two trust signals: certification and a measurable family outcome.',
      'Use concise pay and schedule preferences to reduce mismatch.',
    ],
    question: 'Which profile change usually improves hiring conversion fastest?',
    options: [
      'Adding specific outcomes and trust signals.',
      'Keeping your bio broad and generic.',
      'Removing schedule details.',
    ],
    correctIndex: 0,
    points: 20,
  },
];

const getIsoWeekKey = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

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
  const [growthProgress, setGrowthProgress] = useState<any>(null);
  const [officialShiftScore, setOfficialShiftScore] = useState<number>(0);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [autoCompletedTaskIds, setAutoCompletedTaskIds] = useState<string[]>([]);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  const currentWeekKey = useMemo(() => getIsoWeekKey(new Date()), []);
  const weeklyCourse = useMemo(() => {
    const hash = currentWeekKey.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return WEEKLY_COURSES[hash % WEEKLY_COURSES.length];
  }, [currentWeekKey]);

  const isPremium = Boolean(analytics?.is_premium);
  const premiumTaskId = `premium-course-${currentWeekKey}`;

  const loadData = async () => {
    if (!nannyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [premiumAnalytics, creditWallet, history, progress, scoreData] = await Promise.all([
        getNannyPremiumAnalytics(nannyId),
        getNannyCreditWallet(nannyId),
        getNannyDevelopmentSessions(nannyId),
        getNannyGrowthProgress(currentWeekKey),
        getNannyOfficialShiftScore(currentWeekKey),
      ]);
      setAnalytics(premiumAnalytics);
      setWallet(creditWallet);
      setSessions(history);
      setGrowthProgress(progress);
      setCompletedTaskIds(Array.isArray(progress?.completedTaskIds) ? progress.completedTaskIds : []);
      setAutoCompletedTaskIds(Array.isArray(progress?.autoCompletedTaskIds) ? progress.autoCompletedTaskIds : []);
      setOfficialShiftScore(Number(scoreData?.score || progress?.officialShiftScore || 0));
      setQuizFeedback(progress?.quiz?.passed ? 'Course completed. Weekly points awarded.' : null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [nannyId]);

  const lowCredits = useMemo(() => Number(wallet?.balance_credits || 0) < 2, [wallet]);

  const isWeeklyCourseCompleted = useMemo(
    () => completedTaskIds.includes(premiumTaskId),
    [completedTaskIds, premiumTaskId],
  );

  const growthTasks = useMemo(() => {
    const freeTasks = FREE_GROWTH_TASKS.map((task) => ({
      ...task,
      locked: false,
      type: 'free' as const,
    }));

    const premiumTask = {
      id: premiumTaskId,
      title: `Weekly Coaching Course: ${weeklyCourse.title}`,
      description: 'Complete this week\'s coaching material and pass the mini test to earn bonus points.',
      points: weeklyCourse.points,
      locked: !isPremium,
      type: 'premium' as const,
    };

    return [...freeTasks, premiumTask];
  }, [isPremium, premiumTaskId, weeklyCourse]);

  const availableGrowthPoints = useMemo(
    () => Number(growthProgress?.points?.available || growthTasks.filter((task) => !task.locked).reduce((sum, task) => sum + task.points, 0)),
    [growthProgress, growthTasks],
  );

  const earnedGrowthPoints = useMemo(
    () => Number(growthProgress?.points?.earned || growthTasks.filter((task) => completedTaskIds.includes(task.id)).reduce((sum, task) => sum + task.points, 0)),
    [growthProgress, growthTasks, completedTaskIds],
  );

  const progressPct = useMemo(() => {
    if (typeof growthProgress?.points?.progressPct === 'number') {
      return growthProgress.points.progressPct;
    }
    if (!availableGrowthPoints) return 0;
    return Math.min(100, Math.round((earnedGrowthPoints / availableGrowthPoints) * 100));
  }, [growthProgress, availableGrowthPoints, earnedGrowthPoints]);

  const positionLabel = useMemo(() => {
    if (progressPct >= 85) return 'Top Candidate';
    if (progressPct >= 55) return 'Rising Candidate';
    if (progressPct >= 25) return 'Active Candidate';
    return 'Getting Started';
  }, [progressPct]);

  const toggleTask = async (taskId: string) => {
    if (!nannyId) return;
    const nextCompleted = !completedTaskIds.includes(taskId);
    setError(null);
    try {
      await updateNannyGrowthTask({
        weekKey: currentWeekKey,
        taskId,
        completed: nextCompleted,
      });
      const [progress, scoreData] = await Promise.all([
        getNannyGrowthProgress(currentWeekKey),
        getNannyOfficialShiftScore(currentWeekKey),
      ]);
      setGrowthProgress(progress);
      setCompletedTaskIds(Array.isArray(progress?.completedTaskIds) ? progress.completedTaskIds : []);
      setAutoCompletedTaskIds(Array.isArray(progress?.autoCompletedTaskIds) ? progress.autoCompletedTaskIds : []);
      setOfficialShiftScore(Number(scoreData?.score || progress?.officialShiftScore || 0));
    } catch (taskError: any) {
      setError(taskError?.message || 'Unable to update growth task right now.');
    }
  };

  const submitWeeklyQuiz = async () => {
    if (!isPremium || selectedQuizAnswer === null) return;

    const passed = selectedQuizAnswer === weeklyCourse.correctIndex;
    setError(null);
    try {
      await submitNannyWeeklyQuiz({
        weekKey: currentWeekKey,
        courseId: weeklyCourse.id,
        selectedAnswer: selectedQuizAnswer,
        passed,
      });
      const [progress, scoreData] = await Promise.all([
        getNannyGrowthProgress(currentWeekKey),
        getNannyOfficialShiftScore(currentWeekKey),
      ]);
      setGrowthProgress(progress);
      setCompletedTaskIds(Array.isArray(progress?.completedTaskIds) ? progress.completedTaskIds : []);
      setAutoCompletedTaskIds(Array.isArray(progress?.autoCompletedTaskIds) ? progress.autoCompletedTaskIds : []);
      setOfficialShiftScore(Number(scoreData?.score || progress?.officialShiftScore || 0));
      setQuizFeedback(passed
        ? 'Passed. You earned weekly coaching points. Next course unlocks next week.'
        : 'Not quite. Review the material and try again.');
    } catch (quizError: any) {
      setError(quizError?.message || 'Unable to submit weekly quiz.');
    }
  };

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
          <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">ShiftScore Growth Track</p>
                <h2 className="mt-2 text-2xl font-bold text-stone-900">Weekly progress to get hired faster</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Complete growth tasks to improve your in-app ranking, hiring visibility, and ShiftScore momentum.
                </p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-white px-4 py-3 min-w-[220px]">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-[0.14em]">Current Position</p>
                <p className="text-lg font-bold text-stone-900 mt-1">{positionLabel}</p>
                <p className="text-sm text-emerald-700 mt-1">Official ShiftScore: {officialShiftScore.toFixed(1)}</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-600 mb-2">
                <span>{earnedGrowthPoints} / {availableGrowthPoints} growth points</span>
                <span>{progressPct}% complete</span>
              </div>
              <div className="h-3 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {growthTasks.map((task) => {
                const done = completedTaskIds.includes(task.id);
                const autoTracked = autoCompletedTaskIds.includes(task.id);
                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-4 ${task.locked ? 'border-stone-200 bg-stone-50' : done ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{task.title}</p>
                        <p className="text-xs text-stone-600 mt-1">{task.description}</p>
                        <p className="text-xs font-semibold text-sky-700 mt-2">+{task.points} points</p>
                      </div>
                      {task.locked ? (
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700 bg-amber-100 rounded-full px-2 py-1">
                          Premium
                        </span>
                      ) : autoTracked ? (
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-700 bg-sky-100 rounded-full px-2 py-1">
                          Auto
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void toggleTask(task.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${done ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                        >
                          {done ? 'Completed' : 'Mark Done'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Weekly Coaching Course</p>
                <h3 className="mt-2 text-xl font-bold text-stone-900">{weeklyCourse.title}</h3>
                <p className="text-sm text-stone-600 mt-1">One course per week. Pass the mini test to unlock your weekly premium points.</p>
              </div>
              <p className="text-xs font-semibold text-stone-500">Week {currentWeekKey}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-semibold text-stone-900 mb-2">Coaching materials</p>
              <ul className="space-y-2">
                {weeklyCourse.materials.map((material) => (
                  <li key={material} className="text-sm text-stone-700">• {material}</li>
                ))}
              </ul>
            </div>

            {!isPremium ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <p className="text-sm">Upgrade to premium to take this weekly test and earn bonus ranking points.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold text-stone-900">Mini test: {weeklyCourse.question}</p>
                <div className="space-y-2">
                  {weeklyCourse.options.map((option, index) => (
                    <label key={option} className="flex items-start gap-2 rounded-xl border border-stone-200 p-3 cursor-pointer hover:bg-stone-50">
                      <input
                        type="radio"
                        name="weekly-course-answer"
                        checked={selectedQuizAnswer === index}
                        onChange={() => setSelectedQuizAnswer(index)}
                        disabled={isWeeklyCourseCompleted}
                        className="mt-1"
                      />
                      <span className="text-sm text-stone-700">{option}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void submitWeeklyQuiz()}
                    disabled={selectedQuizAnswer === null || isWeeklyCourseCompleted}
                    className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
                  >
                    {isWeeklyCourseCompleted ? 'Weekly Course Completed' : 'Submit Weekly Test'}
                  </button>
                  <p className="text-xs text-stone-500">Passing score awards +{weeklyCourse.points} points.</p>
                </div>
                {quizFeedback && <p className="text-sm text-stone-700">{quizFeedback}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Reliability</p>
              <p className="mt-3 text-3xl font-bold text-stone-900">{Number(growthProgress?.officialShiftScoreDetails?.averageReliability || 0).toFixed(1)}</p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Review Signal</p>
              <p className="mt-3 text-3xl font-bold text-stone-900">{officialShiftScore.toFixed(1)}</p>
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
                  onChange={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
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
