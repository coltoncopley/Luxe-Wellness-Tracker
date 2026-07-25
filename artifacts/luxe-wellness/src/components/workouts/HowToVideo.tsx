import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayCircle, ExternalLink } from "lucide-react";
import { howToVideoUrl } from "./labels";

/**
 * "Watch how-to" affordance for an exercise.
 *
 * When a curated `videoId` exists it opens an in-app privacy-friendly
 * (youtube-nocookie) player; otherwise (and always beneath the player) it
 * falls back to a YouTube search link so a demo is always reachable.
 *
 * `variant="button"` renders a pill button (library list); `variant="link"`
 * renders a compact inline text link (inside a workout).
 */
export function HowToVideo({
  exerciseName,
  videoId,
  variant = "button",
  testId,
}: {
  exerciseName: string;
  videoId?: string | null;
  variant?: "button" | "link";
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const searchUrl = howToVideoUrl(exerciseName);

  // No curated video — link straight out to a YouTube search (permanent fallback).
  if (!videoId) {
    if (variant === "link") {
      return (
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1.5"
          data-testid={testId}
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Watch how-to
        </a>
      );
    }
    return (
      <Button
        asChild
        size="sm"
        variant="outline"
        className="rounded-full"
        data-testid={testId}
      >
        <a href={searchUrl} target="_blank" rel="noopener noreferrer">
          <PlayCircle className="h-4 w-4 mr-1.5" />
          Watch how-to
        </a>
      </Button>
    );
  }

  return (
    <>
      {variant === "link" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1.5"
          data-testid={testId}
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Watch how-to
        </button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => setOpen(true)}
          data-testid={testId}
        >
          <PlayCircle className="h-4 w-4 mr-1.5" />
          Watch how-to
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">{exerciseName}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            {/* Only mount the embed while open so YouTube isn't contacted until asked. */}
            {open && (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
                title={`${exerciseName} how-to video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            )}
          </div>
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            data-testid={testId ? `${testId}-search` : undefined}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            More how-to videos on YouTube
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
