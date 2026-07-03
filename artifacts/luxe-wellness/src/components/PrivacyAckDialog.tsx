import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  getGetMeQueryKey,
  useAcknowledgePrivacyNotice,
} from "@workspace/api-client-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, EyeOff, Lock } from "lucide-react";

export function PrivacyAckDialog() {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const acknowledge = useAcknowledgePrivacyNotice();

  const open = !!me && !me.privacyAcknowledged;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Your data stays private
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left pt-2">
              <p>Before you get started, we want you to know how your information is handled:</p>
              <div className="flex gap-3">
                <EyeOff className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <p className="text-sm">
                  <strong className="text-foreground">Our office cannot see your app data.</strong>{" "}
                  Your weight, meals, photos, habits, skin scans, and AI chats are visible only to
                  you. They are never shared with LUXE staff or added to any medical record.
                </p>
              </div>
              <div className="flex gap-3">
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <p className="text-sm">
                  <strong className="text-foreground">This is a personal wellness tool,</strong>{" "}
                  not a medical record — your care team does not monitor it and won't see or
                  respond to anything you enter here.
                </p>
              </div>
              <p className="text-xs">
                Details in our{" "}
                <Link href="/privacy" className="underline text-primary">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            className="w-full"
            disabled={acknowledge.isPending}
            onClick={() =>
              acknowledge.mutate(undefined, {
                onSuccess: (updated) => {
                  queryClient.setQueryData(getGetMeQueryKey(), updated);
                },
              })
            }
          >
            {acknowledge.isPending ? "Saving..." : "I understand"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
