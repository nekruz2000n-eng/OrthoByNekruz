/**
 * Явные переходы состояния preview при групповом доступе и сброс полей воронки.
 */
import { normalizePreviewModules } from '@/lib/previewModules';
import { ensureModuleStatusMap } from '@/lib/previewModuleStatus';

export type PreviewStatus = 'selecting' | 'active' | 'expired' | 'confirmed';

/** Пробник завершён админом: доступ выдан, сессия витрины снята. */
export function hasFinalizedPreviewAccess(user: any): boolean {
  if (!user) return false;
  if (user.previewStatus === 'confirmed') return true;
  return !!user.previewConfirmedAt;
}

/** Идёт проба или незавершённая оплата — нельзя сбрасывать витрину/таймер. */
export function isPreviewFlowInProgress(user: any): boolean {
  if (!user) return false;
  if (user._catalogBrowse === true && user.previewStatus === 'selecting' && !user.previewChosenSubject) {
    return true;
  }
  const chosen = user.previewChosenSubject;
  if (!chosen) return false;
  const modules = normalizePreviewModules(user.previewChosenModules);
  if (modules.length === 0) return false;
  const statuses = ensureModuleStatusMap(user, chosen);
  if (modules.some(m => statuses[m] === 'receipt_pending')) return true;
  if (modules.some(m => statuses[m] === 'trial')) return true;
  if (user.previewStatus === 'active') return true;
  if (user.receiptClaimedAt) return true;
  if (user.previewStatus === 'expired') {
    return modules.some(m => statuses[m] !== 'confirmed');
  }
  return false;
}

/** Снять поля пробника / оплаты без пометки «аккаунт финализирован». */
export function clearPreviewFlowFields(user: Record<string, unknown>): void {
  delete user.previewStatus;
  delete user.previewChosenSubject;
  delete user.previewChosenModules;
  delete user.previewStartedAt;
  delete user.previewExpiredAt;
  delete user.previewPickedAt;
  delete user.previewFacultyRecordedAt;
  delete user.previewQuotedPrice;
  delete user.receiptClaimedAt;
  delete user.previewModuleStatuses;
  delete user.previewModuleTrustExpiresAt;
  delete user.previewActiveMsConsumed;
  delete user.previewActiveMsByModule;
  delete user.previewModuleRealSince;
  delete user.previewPaymentSelection;
  delete user._subjectsBeforePreview;
  delete user._navHiddenBeforePreview;
  delete user._previewSnapshotBeforeAddon;
  delete user._previewStatusBeforeCatalog;
  delete user._catalogBrowse;
  delete user._adminPaymentOnlyLock;
}

/** Групповой доступ не должен прерывать активную пробу или незавершённую оплату. */
export function shouldPreservePreviewFlowOnGroupGrant(
  user: any,
  options?: { grantedSubjects?: string[] },
): boolean {
  // Админ открыл предмет группе — это полный доступ, пробник сбрасываем.
  if (options?.grantedSubjects?.length) return false;
  if (isPreviewFlowInProgress(user)) return true;
  if (user?._catalogBrowse === true && user?.previewStatus === 'selecting') {
    const hasPurchased = hasFinalizedPreviewAccess(user) || user?.paid === true;
    return hasPurchased;
  }
  return false;
}

/**
 * После merge группового доступа: убрать только «зависшую» витрину.
 * Не выставляет previewConfirmedAt новым пользователям с бесплатной группой.
 */
export function applyGroupGrantPreviewSideEffects(
  next: Record<string, unknown>,
  user: any,
  grantedSubjects?: string[],
): boolean {
  if (shouldPreservePreviewFlowOnGroupGrant(user, { grantedSubjects })) {
    return false;
  }

  const hadPreviewFields = !!user?.previewStatus;
  clearPreviewFlowFields(next);

  if (hasFinalizedPreviewAccess(user) || user?.paid === true) {
    if (!next.previewConfirmedAt && user?.previewConfirmedAt) {
      next.previewConfirmedAt = user.previewConfirmedAt;
    }
  } else {
    delete next.previewConfirmedAt;
  }

  return hadPreviewFields;
}
