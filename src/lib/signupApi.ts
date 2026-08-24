// Client for the local Django signup proxy (backend/relay/signup_view.py).
// This POSTs to a LOCAL-ONLY backend at 127.0.0.1:8877 -- it will not work
// against the deployed Netlify site until that backend is deployed
// somewhere reachable. See backend/README (or repo audit notes) for the
// deployment follow-up. Never call Airtable directly from the browser:
// the API key must stay server-side, which is why this goes through Django.

export interface SignupPayload {
  role: 'commuter' | 'ev_participant';
  name: string;
  email: string;
  originArea?: string;
  destinationArea?: string;
  timeWindow?: string;
  corridor?: string;
  vehicleType?: string;
  seatsAvailable?: number;
  maxDetourMinutes?: number;
  adultConfirmed?: boolean;
  researchConsent?: boolean;
}

export interface SignupResult {
  profileId: number;
  role: string;
  airtable: { synced: boolean; reason: string | null };
}

const SIGNUP_API_URL =
  (import.meta.env.VITE_SIGNUP_API_URL as string | undefined) || 'http://127.0.0.1:8877/api/signup/';

/**
 * Submits a signup to the local research-beta backend. Never throws for
 * expected "backend not running locally" conditions -- returns a result
 * with synced:false instead, so the UI can show its success screen
 * regardless of whether the optional backend sync happened. This keeps
 * the prototype's session-memory-first experience intact: the backend
 * call is a bonus sync, not a requirement to complete signup.
 */
export async function submitSignup(payload: SignupPayload): Promise<SignupResult | null> {
  try {
    const response = await fetch(SIGNUP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn('Signup sync responded with an error status', response.status);
      return null;
    }

    return (await response.json()) as SignupResult;
  } catch (error) {
    // Expected when the local Django backend isn't running (e.g. on the
    // deployed Netlify site, or before `python manage.py runserver`).
    console.warn('Signup sync skipped: local backend unreachable.', error);
    return null;
  }
}
