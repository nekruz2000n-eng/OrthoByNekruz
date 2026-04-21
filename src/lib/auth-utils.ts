export const validateKey = (key: string): boolean => {
  if (key.length !== 8 || !/^\d+$/.test(key)) return false;

  const digits = key.split('').map(Number);
  
  // Rule 1: Sum of 1st, 2nd, and 8th digits must be 15
  const sumCheck = digits[0] + digits[1] + digits[7] === 15;
  
  // Rule 2: 8-digit number % 7 must be 3
  const numericKey = parseInt(key, 10);
  const modCheck = numericKey % 7 === 3;

  return sumCheck && modCheck;
};

export const getLockoutStatus = () => {
  if (typeof window === 'undefined') return { isLocked: false, remaining: 0 };

  const attempts = parseInt(localStorage.getItem('auth_attempts') || '0', 10);
  const lockUntil = parseInt(localStorage.getItem('auth_lock_until') || '0', 10);
  const now = Date.now();

  if (lockUntil > now) {
    return { isLocked: true, remaining: Math.ceil((lockUntil - now) / 1000) };
  }

  return { isLocked: false, remaining: 0, attempts };
};

export const recordFailedAttempt = () => {
  if (typeof window === 'undefined') return;

  const currentAttempts = parseInt(localStorage.getItem('auth_attempts') || '0', 10) + 1;
  localStorage.setItem('auth_attempts', currentAttempts.toString());

  let lockDuration = 0;
  if (currentAttempts >= 5) {
    lockDuration = 24 * 60 * 60 * 1000; // 24 hours
  } else if (currentAttempts >= 2) {
    lockDuration = 60 * 1000; // 1 minute
  }

  if (lockDuration > 0) {
    localStorage.setItem('auth_lock_until', (Date.now() + lockDuration).toString());
  }
};

export const clearAttempts = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_attempts');
  localStorage.removeItem('auth_lock_until');
};
