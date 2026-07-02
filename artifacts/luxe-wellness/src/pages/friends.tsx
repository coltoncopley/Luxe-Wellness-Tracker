import { useState } from "react";
import {
  useGetFollows,
  getGetFollowsQueryKey,
  useRequestFollow,
  useRespondToFollow,
  useRemoveFollow,
  useGetFriendJourneys,
  getGetFriendJourneysQueryKey,
  useGetSharingSettings,
  getGetSharingSettingsQueryKey,
  useUpdateSharingSettings,
  useGetCheers,
  useSendCheer,
  type FriendJourney,
  type FollowEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  UserPlus,
  Heart,
  Flame,
  Sun,
  TrendingDown,
  Check,
  X,
  Shield,
  PartyPopper,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const CHEER_EMOJIS = ["👏", "💪", "🎉", "❤️", "🔥", "🌟"];

const REQUEST_ERRORS: Record<string, string> = {
  invalid_code: "We couldn't find anyone with that code — double-check it with your friend.",
  own_code: "That's your own code! Share it with a friend instead.",
  already_following: "You're already following this friend.",
  already_requested: "You've already sent this friend a request — they just need to accept it.",
};

function FollowFriendCard() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const requestFollow = useRequestFollow({
    mutation: {
      onSuccess: (result) => {
        if (result.requested) {
          toast.success("Request sent! Your friend will need to approve it.");
          setCode("");
          void queryClient.invalidateQueries({ queryKey: getGetFollowsQueryKey() });
        } else {
          toast.error(REQUEST_ERRORS[result.reason ?? ""] ?? "Couldn't send that request.");
        }
      },
      onError: () => toast.error("Something went wrong — please try again."),
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5 text-primary" /> Follow a friend
        </CardTitle>
        <CardDescription>
          Ask a friend for their invite code (on their Rewards page), then send a follow request.
          They choose what to share with you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) requestFollow.mutate({ data: { code: code.trim() } });
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Friend's invite code"
            className="font-mono uppercase"
            maxLength={12}
          />
          <Button type="submit" disabled={!code.trim() || requestFollow.isPending} className="rounded-full">
            {requestFollow.isPending ? "Sending…" : "Send request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CheerDialog({
  friend,
  open,
  onOpenChange,
}: {
  friend: FriendJourney | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [emoji, setEmoji] = useState(CHEER_EMOJIS[0]);
  const [message, setMessage] = useState("");
  const sendCheer = useSendCheer({
    mutation: {
      onSuccess: () => {
        toast.success(`Cheer sent to ${friend?.name}! ${emoji}`);
        setMessage("");
        onOpenChange(false);
      },
      onError: () => toast.error("Couldn't send that cheer — please try again."),
    },
  });

  if (!friend) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" /> Cheer on {friend.name}
          </DialogTitle>
          <DialogDescription>Send a little encouragement — they'll see it on their Friends page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {CHEER_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`text-2xl rounded-xl p-2 transition-colors ${
                  emoji === e ? "bg-primary/15 ring-2 ring-primary" : "hover:bg-muted"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
            placeholder="Add a note (optional)"
            rows={2}
          />
          <Button
            className="w-full rounded-full"
            disabled={sendCheer.isPending}
            onClick={() =>
              sendCheer.mutate({
                data: { toUserId: friend.userId, emoji, message: message.trim() || null },
              })
            }
          >
            {sendCheer.isPending ? "Sending…" : `Send ${emoji}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JourneyCard({ journey, onCheer }: { journey: FriendJourney; onCheer: () => void }) {
  const nothingShared =
    journey.streakDays == null &&
    journey.glowScoreToday == null &&
    journey.checkinsLast7Days == null &&
    journey.weightProgressPct == null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{journey.name}</CardTitle>
          <Button size="sm" variant="outline" className="rounded-full" onClick={onCheer}>
            <Heart className="h-4 w-4 mr-1.5 text-primary" /> Cheer
          </Button>
        </div>
        {journey.lastActiveDate && (
          <CardDescription className="text-xs">
            Last check-in {journey.lastActiveDate}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {nothingShared ? (
          <p className="text-sm text-muted-foreground">
            {journey.name} isn't sharing journey details right now — you can still cheer them on!
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {journey.streakDays != null && (
                <Badge variant="secondary" className="gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-500" /> {journey.streakDays}-day streak
                </Badge>
              )}
              {journey.glowScoreToday != null && (
                <Badge variant="secondary" className="gap-1">
                  <Sun className="h-3.5 w-3.5 text-amber-500" /> Glow {journey.glowScoreToday} today
                </Badge>
              )}
              {journey.checkinsLast7Days != null && (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> {journey.checkinsLast7Days}/7 check-ins
                </Badge>
              )}
            </div>
            {journey.weightProgressPct != null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5" /> Progress toward goal
                  </span>
                  <span className="font-semibold text-foreground">{journey.weightProgressPct}%</span>
                </div>
                <Progress value={journey.weightProgressPct} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SharingSettingsCard() {
  const queryClient = useQueryClient();
  const { data: settings } = useGetSharingSettings();
  const update = useUpdateSharingSettings({
    mutation: {
      onSuccess: () => {
        toast.success("Sharing settings updated");
        void queryClient.invalidateQueries({ queryKey: getGetSharingSettingsQueryKey() });
      },
      onError: () => toast.error("Couldn't save — please try again."),
    },
  });

  if (!settings) return null;

  const toggle = (key: "shareGlow" | "shareWeightProgress" | "shareStreak", value: boolean) => {
    update.mutate({ data: { ...settings, [key]: value } });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" /> What your followers can see
        </CardTitle>
        <CardDescription>
          Only friends you've approved can see any of this. Your actual weight, meals, and
          check-in details are never shared — only the summaries you allow below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="share-streak" className="font-normal">
            Check-in streak
          </Label>
          <Switch
            id="share-streak"
            checked={settings.shareStreak}
            onCheckedChange={(v) => toggle("shareStreak", v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="share-glow" className="font-normal">
            Glow Score &amp; weekly check-ins
          </Label>
          <Switch
            id="share-glow"
            checked={settings.shareGlow}
            onCheckedChange={(v) => toggle("shareGlow", v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="share-weight" className="font-normal">
            Weight progress (% toward goal only)
          </Label>
          <Switch
            id="share-weight"
            checked={settings.shareWeightProgress}
            onCheckedChange={(v) => toggle("shareWeightProgress", v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PeopleList({
  title,
  entries,
  emptyText,
  onRemove,
  removeLabel,
}: {
  title: string;
  entries: FollowEntry[];
  emptyText: string;
  onRemove: (entry: FollowEntry) => void;
  removeLabel: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm">{entry.name}</span>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onRemove(entry)}>
                <UserMinus className="h-4 w-4 mr-1" /> {removeLabel}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Friends() {
  const queryClient = useQueryClient();
  const { data: follows } = useGetFollows();
  const { data: journeysData } = useGetFriendJourneys();
  const { data: cheersData } = useGetCheers();
  const [cheerTarget, setCheerTarget] = useState<FriendJourney | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetFollowsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetFriendJourneysQueryKey() });
  };

  const respond = useRespondToFollow({
    mutation: {
      onSuccess: (result) => {
        toast.success(result.status === "accepted" ? "Follow request accepted!" : "Request declined");
        invalidate();
      },
      onError: () => toast.error("Couldn't update that request."),
    },
  });
  const remove = useRemoveFollow({
    mutation: {
      onSuccess: () => {
        toast.success("Removed");
        invalidate();
      },
      onError: () => toast.error("Couldn't remove — please try again."),
    },
  });

  const journeys = journeysData?.journeys ?? [];
  const cheers = cheersData?.cheers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Friends
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Follow friends (with their permission), track their journey highlights, and cheer each
          other on.
        </p>
      </div>

      {(follows?.incomingRequests.length ?? 0) > 0 && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Follow requests</CardTitle>
            <CardDescription>
              These friends want to follow your journey. Only approve people you know — they'll
              see whatever you've enabled in your sharing settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {follows!.incomingRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm font-medium">{req.name}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: req.id, data: { accept: true } })}
                  >
                    <Check className="h-4 w-4 mr-1" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: req.id, data: { accept: false } })}
                  >
                    <X className="h-4 w-4 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {cheers.length > 0 && (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PartyPopper className="h-5 w-5 text-primary" /> Cheers for you
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {cheers.slice(0, 5).map((cheer) => (
                <li key={cheer.id} className="flex items-start gap-2 text-sm">
                  <span className="text-lg leading-none">{cheer.emoji}</span>
                  <span>
                    <span className="font-medium">{cheer.fromName}</span>
                    {cheer.message ? ` — “${cheer.message}”` : " cheered you on"}
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatDistanceToNow(new Date(cheer.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Journeys you follow</h2>
        {journeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You're not following anyone yet. Ask a friend for their invite code to get started.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {journeys.map((journey) => (
              <JourneyCard key={journey.userId} journey={journey} onCheer={() => setCheerTarget(journey)} />
            ))}
          </div>
        )}
      </div>

      <FollowFriendCard />
      <SharingSettingsCard />

      {follows && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Your connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <PeopleList
              title={`Following (${follows.following.length})`}
              entries={follows.following}
              emptyText="Not following anyone yet."
              onRemove={(e) => remove.mutate({ id: e.id })}
              removeLabel="Unfollow"
            />
            <PeopleList
              title={`Your followers (${follows.followers.length})`}
              entries={follows.followers}
              emptyText="No followers yet — share your invite code!"
              onRemove={(e) => remove.mutate({ id: e.id })}
              removeLabel="Remove"
            />
            {follows.outgoingRequests.length > 0 && (
              <PeopleList
                title={`Pending requests you sent (${follows.outgoingRequests.length})`}
                entries={follows.outgoingRequests}
                emptyText=""
                onRemove={(e) => remove.mutate({ id: e.id })}
                removeLabel="Cancel"
              />
            )}
          </CardContent>
        </Card>
      )}

      <CheerDialog
        friend={cheerTarget}
        open={cheerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCheerTarget(null);
        }}
      />
    </div>
  );
}
