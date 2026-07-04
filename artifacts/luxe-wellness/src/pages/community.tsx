import { useState } from "react";
import {
  useGetCommunityPosts,
  useCreateCommunityPost,
  useDeleteCommunityPost,
  useToggleCommunityHeart,
  getGetCommunityPostsQueryKey,
  getGetRewardsSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Megaphone, Plus, Trash2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: "weight_loss", label: "Weight loss win", emoji: "🎉" },
  { value: "glow", label: "Glow journey", emoji: "✨" },
  { value: "skin", label: "Skin progress", emoji: "🌸" },
  { value: "recipe", label: "Healthy recipe", emoji: "🥗" },
  { value: "motivation", label: "Motivation", emoji: "💪" },
  { value: "other", label: "Other", emoji: "💬" },
];

function categoryInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

export default function Community() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetCommunityPosts({
    query: { queryKey: getGetCommunityPostsQueryKey() },
  });
  const posts = data?.posts ?? [];

  const [shareOpen, setShareOpen] = useState(false);
  const [category, setCategory] = useState("weight_loss");
  const [body, setBody] = useState("");

  const createPost = useCreateCommunityPost();
  const deletePost = useDeleteCommunityPost();
  const toggleHeart = useToggleCommunityHeart();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() });
  };

  const submitPost = () => {
    const trimmed = body.trim();
    if (trimmed.length < 10) {
      toast.error("Share a little more — at least 10 characters.");
      return;
    }
    createPost.mutate(
      { data: { category: category as never, body: trimmed } },
      {
        onSuccess: () => {
          invalidate();
          void queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() });
          setBody("");
          setShareOpen(false);
          toast.success("Shared with the community. Thank you for inspiring others!");
        },
        onError: (err) => {
          if (err.status === 429) {
            toast.error("You've reached today's sharing limit — come back tomorrow!");
          } else {
            toast.error("Couldn't share your post. Please try again.");
          }
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold">
            <Megaphone className="h-6 w-6 text-primary" /> Community
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Anonymous wins from LUXE members. Cheer each other on — no names, ever.
          </p>
        </div>
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0">
              <Plus className="mr-1 h-4 w-4" /> Share a win
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share a win</DialogTitle>
              <DialogDescription>
                Posts are anonymous — your name is never shown to other members or the LUXE team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>What kind of win?</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <Button
                      key={c.value}
                      type="button"
                      size="sm"
                      variant={category === c.value ? "default" : "outline"}
                      onClick={() => setCategory(c.value)}
                    >
                      {c.emoji} {c.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-body">Your story</Label>
                <Textarea
                  id="post-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 500))}
                  placeholder="Down 12 lbs since starting my weight loss journey — the food tracker made all the difference!"
                  rows={4}
                />
                <p className="text-right text-xs text-muted-foreground">{body.length}/500</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Please keep it kind and supportive. Don't include your name or personal details —
                posts everyone can see should stay anonymous.
              </p>
              <Button onClick={submitPost} disabled={createPost.isPending} className="w-full">
                {createPost.isPending ? "Sharing…" : "Share anonymously"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        Every post is anonymous. Your name is never shown to other members or staff.
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Sparkles className="h-8 w-8 text-primary" />
            <p className="font-medium">No wins shared yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Be the first to inspire the LUXE community — share a victory from your wellness
              journey, big or small.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const cat = categoryInfo(post.category);
            return (
              <Card key={post.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-base"
                      >
                        {cat.emoji}
                      </span>
                      <span className="text-muted-foreground">
                        {post.mine ? "You (anonymous to others)" : "A LUXE member"}
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {cat.label}
                      </Badge>
                      {post.mine && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label="Delete post"
                          onClick={() =>
                            deletePost.mutate(
                              { id: post.id },
                              {
                                onSuccess: () => {
                                  invalidate();
                                  toast.success("Post deleted.");
                                },
                                onError: () => toast.error("Couldn't delete. Please try again."),
                              },
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="whitespace-pre-wrap text-sm">{post.body}</p>
                  <div className="flex items-center justify-between">
                    <Button
                      variant={post.heartedByMe ? "default" : "outline"}
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() =>
                        toggleHeart.mutate(
                          { id: post.id },
                          {
                            onSuccess: invalidate,
                            onError: () => toast.error("Couldn't react. Please try again."),
                          },
                        )
                      }
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${post.heartedByMe ? "fill-current" : ""}`}
                      />
                      {post.heartCount > 0 ? post.heartCount : "Cheer"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
