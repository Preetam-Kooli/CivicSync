// Every request to our backend goes through this file.

// A hint, not a credential: it only tells the UI whether a refresh is worth
// trying. It grants no access. The real session lives in httpOnly cookies
// that JavaScript cannot see.
const HINT_KEY = 'civicsync_session';
export const setSessionHint = () => {
  try { localStorage.setItem(HINT_KEY, '1'); } catch { /* storage unavailable */ }
};
export const clearSessionHint = () => {
  try { localStorage.removeItem(HINT_KEY); } catch { /* storage unavailable */ }
};
const hasSessionHint = () => {
  try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; }
};

// These never trigger a refresh attempt (it would make no sense or loop forever)
const NO_REFRESH_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
];

export class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors; // field-level validation messages, when the server sends them
  }
}

async function rawRequest(method, path, body) {
  // The CSRF guard on the server requires this header on every non-GET request
  const headers = { 'X-Requested-With': 'CivicSync' };
  const options = { method, headers, credentials: 'same-origin' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* the response had no JSON body */
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.message || 'Something went wrong', data?.errors);
  }
  return data;
}

// If several requests fail at once, they share ONE refresh call. Two refreshes
// at the same moment would look like token theft to the server.
let refreshPromise = null;
function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = rawRequest('POST', '/api/auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function api(method, path, body) {
  try {
    return await rawRequest(method, path, body);
  } catch (err) {
    const canRefresh =
      err.status === 401 && !NO_REFRESH_PATHS.includes(path) && hasSessionHint();
    if (!canRefresh) throw err;

    const refreshed = await refreshOnce();
    if (!refreshed) {
      clearSessionHint();
      throw err;
    }
    return rawRequest(method, path, body); // retry once with the fresh cookies
  }
}