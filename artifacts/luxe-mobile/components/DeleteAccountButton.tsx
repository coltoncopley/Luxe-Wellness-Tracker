import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import { useDeleteMe } from "@workspace/api-client-react";

import { LuxeButton } from "@/components/ui";
import { Alert } from "@/lib/alert";

/**
 * Self-contained "delete my account" control (Apple 5.1.1(v)).
 * Reused on the Settings screen and the membership gate so a signed-in user
 * can always delete their account — even without an active subscription.
 */
export function DeleteAccountButton({
  variant = "destructive",
  label = "Delete account",
}: {
  variant?: React.ComponentProps<typeof LuxeButton>["variant"];
  label?: string;
}) {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const deleteMe = useDeleteMe({
    mutation: {
      onSuccess: async () => {
        // Sign out BEFORE clearing the cache: clearing triggers immediate
        // refetches, and while the Clerk token is still valid those would
        // re-run requireAuth → ensureUserRow and resurrect the deleted row.
        await signOut();
        queryClient.clear();
      },
      onError: (err) => {
        const status = (err as { status?: number } | null)?.status;
        if (status === 409) {
          Alert.alert(
            "Can't delete yet",
            "You're the last admin. Make another account an admin before deleting yours.",
          );
        } else if (status === 502) {
          Alert.alert(
            "Please try again",
            "We couldn't cancel your membership just now. Please try again in a moment.",
          );
        } else {
          Alert.alert(
            "Something went wrong",
            "We couldn't delete your account. Please try again.",
          );
        }
      },
    },
  });

  const confirmDelete = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently erases your account and everything in it — weigh-ins, food logs, photos, rewards, and more. Your LUXE membership will be canceled. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => deleteMe.mutate(),
        },
      ],
    );
  };

  return (
    <LuxeButton
      label={label}
      icon="trash-2"
      variant={variant}
      onPress={confirmDelete}
      loading={deleteMe.isPending}
    />
  );
}
