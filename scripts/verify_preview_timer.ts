/**
 * Smoke tests for preview trial expiry and heal logic.
 * Run: npx tsx scripts/verify_preview_timer.ts
 */
import {
  PREVIEW_TEST_REAL_WINDOW_MS,
  applyModuleTrialExpiries,
  buildActivePreviewUser,
  healStalePreviewForFinalizedUser,
  isPreviewFlowInProgress,
  syncPreviewActiveMs,
} from '../src/lib/preview';

const ADMIN_TG = '978243325';
const STUDENT_TG = '123456789';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function basePaidUser() {
  return {
    paid: true,
    previewConfirmedAt: '2025-01-01T00:00:00.000Z',
    subjects: { bio: true, anatomy: true },
    navHidden: { bio: ['tests', 'tasks', 'materials'] },
    studyGroup: '108',
  };
}

// Paid user with module addon trial must not be healed away
{
  const user = buildActivePreviewUser(
    basePaidUser(),
    'bio',
    ['tests'],
    { catalogAddon: true },
  );
  assert(user.previewStatus === 'active', 'trial should be active');
  assert(user.paid === false, 'paid must be false during trial');
  assert(isPreviewFlowInProgress(user), 'flow in progress');
  const healed = healStalePreviewForFinalizedUser(user);
  assert(healed.previewStatus === 'active', 'heal must not wipe active trial');
}

// Test account: wall clock expiry after 30s of sync
{
  const user = buildActivePreviewUser({ subjects: { bio: false } }, 'bio', ['questions']);
  const since = new Date(Date.now() - PREVIEW_TEST_REAL_WINDOW_MS - 100).toISOString();
  const withSince = {
    ...user,
    previewModuleRealSince: { questions: since },
    previewActiveMsByModule: { questions: 0 },
  };
  const expired = applyModuleTrialExpiries(withSince, ADMIN_TG);
  assert(
    expired.previewModuleStatuses?.questions === 'awaiting_payment',
    'test account module should expire by wall clock',
  );
}

// Student: active ms consumption expires module
{
  const user = buildActivePreviewUser({ subjects: { bio: false } }, 'bio', ['questions']);
  const limit = 5 * 60 * 1000;
  const synced = syncPreviewActiveMs(
    user,
    'questions',
    60_000,
    STUDENT_TG,
  );
  let expired = synced;
  for (let i = 0; i < 6; i++) {
    expired = syncPreviewActiveMs(expired, 'questions', 60_000, STUDENT_TG);
  }
  assert(
    expired.previewModuleStatuses?.questions === 'awaiting_payment',
    'student module should expire after 5 min active',
  );
  assert(limit > 0, 'sanity');
}

console.log('OK: preview timer smoke tests passed');
