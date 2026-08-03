import { useAuth } from "@clerk/expo";
import { useCallback } from "react";

import { unregisterDevice } from "@/lib/push";

/**
 * Sign out while making sure this device stops receiving the current
 * account's push reminders. The Expo push token is tied to the device+install,
 * so if it stayed registered after sign-out (or before another member signs in
 * on the same phone), the previous account's notifications would still arrive.
 *
 * `unregisterDevice()` must run BEFORE Clerk's signOut — it calls an
 * authenticated API endpoint. It's best-effort: a network failure never blocks
 * signing out (the server also prunes dead tokens on send).
 */
export function useSignOut(): () => Promise<void> {
  const { signOut } = useAuth();
  return useCallback(async () => {
    try {
      await unregisterDevice();
    } catch {
      // Best-effort — never block sign-out on push cleanup.
    }
    await signOut();
  }, [signOut]);
}
