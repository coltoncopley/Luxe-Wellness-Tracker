import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClerk } from "@clerk/react";
import { toast } from "sonner";
import { useDeleteMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

/**
 * Self-contained "delete my account" control (Apple 5.1.1(v)).
 * Reused on the Settings page and the membership paywall so a signed-in user
 * can always delete their account — even without an active subscription.
 */
export function DeleteAccountButton({
  children,
  variant = "destructive",
  className,
}: {
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const deleteMe = useDeleteMe({
    mutation: {
      onError: (err: unknown) => {
        const status = (err as { status?: number } | null)?.status;
        if (status === 409) {
          toast.error(
            "You're the last admin. Make another account an admin before deleting yours.",
          );
        } else if (status === 502) {
          toast.error("We couldn't cancel your membership just now. Please try again in a moment.");
        } else {
          toast.error("We couldn't delete your account. Please try again.");
        }
      },
    },
  });

  async function handleDelete(): Promise<void> {
    try {
      await deleteMe.mutateAsync();
    } catch {
      return; // onError already surfaced a toast
    }
    setOpen(false);
    // Sign out BEFORE clearing the cache: clearing triggers immediate refetches,
    // and while the Clerk cookie is still valid those refetches would re-run
    // requireAuth → ensureUserRow and resurrect the just-deleted account row.
    await signOut({ redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });
    queryClient.clear();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} className={className} data-testid="button-delete-account">
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently erases your account and everything in it — weigh-ins, food logs,
            photos, rewards, and more. Your LUXE membership will be canceled. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMe.isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={deleteMe.isPending}
            onClick={() => void handleDelete()}
            data-testid="button-confirm-delete-account"
          >
            {deleteMe.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
