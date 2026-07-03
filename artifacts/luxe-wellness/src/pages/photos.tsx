import { useRef, useState } from "react";
import {
  useListProgressPhotos,
  getListProgressPhotosQueryKey,
  useCreateProgressPhoto,
  useDeleteProgressPhoto,
  useSetProgressPhotoShared,
  useRequestUploadUrl,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Trash2, Images, Lock, Columns2, X, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const MAX_DIMENSION = 1280;
const API_BASE = import.meta.env.BASE_URL;

type Category = "weight" | "skin";

async function downscaleToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))),
      "image/jpeg",
      0.85,
    );
  });
}

function photoUrl(objectPath: string): string {
  return `${API_BASE}api/storage${objectPath}`;
}

function todayInput(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export default function Photos() {
  const queryClient = useQueryClient();
  const { data: photos, isLoading } = useListProgressPhotos();
  const requestUrl = useRequestUploadUrl();
  const createPhoto = useCreateProgressPhoto();
  const deletePhoto = useDeleteProgressPhoto();
  const setShared = useSetProgressPhotoShared();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<Category>("weight");
  const [takenOn, setTakenOn] = useState(todayInput());
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<number | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const blob = await downscaleToJpeg(file);
      const { uploadURL, objectPath } = await requestUrl.mutateAsync({
        data: { name: file.name || "photo.jpg", size: blob.size, contentType: "image/jpeg" },
      });
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!putRes.ok) throw new Error("Upload failed");
      await createPhoto.mutateAsync({
        data: {
          objectPath,
          takenOn,
          category,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListProgressPhotosQueryKey() });
      setNote("");
      toast.success("Photo added to your journal (+10 pts for your first photo today)");
    } catch {
      toast.error("Couldn't save the photo. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: number) {
    try {
      await deletePhoto.mutateAsync({ id });
      setCompareIds((prev) => prev.filter((x) => x !== id));
      await queryClient.invalidateQueries({ queryKey: getListProgressPhotosQueryKey() });
      toast.success("Photo deleted");
    } catch {
      toast.error("Couldn't delete the photo.");
    }
  }

  async function handleToggleShare(id: number, shared: boolean) {
    try {
      await setShared.mutateAsync({ id, data: { shared } });
      await queryClient.invalidateQueries({ queryKey: getListProgressPhotosQueryKey() });
      toast.success(
        shared
          ? "Approved friends can see this photo once photo sharing is on in Friends"
          : "This photo is private again",
      );
    } catch {
      toast.error("Couldn't update sharing for that photo.");
    }
  }

  function toggleCompare(id: number) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1]!, id];
      return [...prev, id];
    });
  }

  const filtered = (photos ?? []).filter((p) => filter === "all" || p.category === filter);
  const comparePhotos = (photos ?? []).filter((p) => compareIds.includes(p.id));
  const viewed = (photos ?? []).find((p) => p.id === viewPhoto) ?? null;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <Images className="h-8 w-8" /> Progress Photos
        </h1>
        <p className="text-muted-foreground text-lg">
          A private before &amp; after journal for your journey.
        </p>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Only you can see these photos — never LUXE staff.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
                <TabsList className="w-full">
                  <TabsTrigger value="weight" className="flex-1">
                    Body
                  </TabsTrigger>
                  <TabsTrigger value="skin" className="flex-1">
                    Skin
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taken-on">Date taken</Label>
              <Input
                id="taken-on"
                type="date"
                value={takenOn}
                max={todayInput()}
                onChange={(e) => setTakenOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photo-note">Note (optional)</Label>
              <Input
                id="photo-note"
                placeholder="e.g. Week 4"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button
            className="rounded-full"
            disabled={uploading || !takenOn}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-2" />
            {uploading ? "Saving..." : "Add photo"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="weight">Body</TabsTrigger>
            <TabsTrigger value="skin">Skin</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {compareIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCompareIds([])}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={compareIds.length !== 2}
            onClick={() => setCompareOpen(true)}
          >
            <Columns2 className="h-4 w-4 mr-2" />
            Compare {compareIds.length}/2
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading photos...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No photos yet. Add your first one — future you will thank you.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const selected = compareIds.includes(p.id);
            return (
              <div
                key={p.id}
                className={`group relative rounded-xl overflow-hidden border-2 transition-colors ${
                  selected ? "border-primary" : "border-transparent"
                }`}
              >
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => setViewPhoto(p.id)}
                >
                  <img
                    src={photoUrl(p.objectPath)}
                    alt={p.note ?? `Progress photo ${p.takenOn}`}
                    loading="lazy"
                    className="w-full aspect-[3/4] object-cover"
                  />
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-white pointer-events-none">
                  <div className="text-xs font-medium">
                    {format(new Date(`${p.takenOn}T00:00:00`), "MMM d, yyyy")}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {p.category === "weight" ? "Body" : "Skin"}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant={p.sharedWithFriends ? "default" : "secondary"}
                    className="h-7 rounded-full px-2.5 text-xs"
                    title={
                      p.sharedWithFriends
                        ? "Shared with approved friends — click to make private"
                        : "Private — click to share with approved friends"
                    }
                    onClick={() => void handleToggleShare(p.id, !p.sharedWithFriends)}
                  >
                    <Share2 className="h-3 w-3 mr-1" />
                    {p.sharedWithFriends ? "Shared" : "Share"}
                  </Button>
                  <Button
                    size="sm"
                    variant={selected ? "default" : "secondary"}
                    className="h-7 rounded-full px-2.5 text-xs"
                    onClick={() => toggleCompare(p.id)}
                  >
                    {selected ? "Selected" : "Compare"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 w-7 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => void handleDelete(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Before &amp; after</DialogTitle>
            <DialogDescription>Side-by-side comparison</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[...comparePhotos]
              .sort((a, b) => a.takenOn.localeCompare(b.takenOn))
              .map((p) => (
                <div key={p.id} className="space-y-2">
                  <img
                    src={photoUrl(p.objectPath)}
                    alt={p.note ?? p.takenOn}
                    className="w-full rounded-lg object-cover"
                  />
                  <div className="text-sm text-center text-muted-foreground">
                    {format(new Date(`${p.takenOn}T00:00:00`), "MMM d, yyyy")}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewPhoto !== null} onOpenChange={(open) => !open && setViewPhoto(null)}>
        <DialogContent className="max-w-2xl">
          {viewed && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(new Date(`${viewed.takenOn}T00:00:00`), "MMMM d, yyyy")}
                </DialogTitle>
                <DialogDescription>
                  {viewed.category === "weight" ? "Body" : "Skin"}
                  {viewed.note ? ` · ${viewed.note}` : ""}
                </DialogDescription>
              </DialogHeader>
              <img
                src={photoUrl(viewed.objectPath)}
                alt={viewed.note ?? viewed.takenOn}
                className="w-full rounded-lg"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
