import { useState } from "react";
import {
  useGetPassport,
  getGetPassportQueryKey,
  useCreatePassportEntry,
  useUpdatePassportProfile,
  useDeletePassportEntry,
} from "@workspace/api-client-react";
import type { PassportEntry, PassportEntryEntryType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookHeart, Plus, Lock, Pencil, Trash2, Syringe, Zap, Droplets, Sparkles, Scale, FlaskConical, Sun, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ENTRY_TYPES: { value: PassportEntryEntryType; label: string }[] = [
  { value: "botox", label: "Botox / Neurotoxin" },
  { value: "filler", label: "Filler" },
  { value: "laser", label: "Laser" },
  { value: "microneedling", label: "Microneedling" },
  { value: "peel", label: "Chemical Peel" },
  { value: "facial", label: "Facial" },
  { value: "iv_therapy", label: "IV Therapy" },
  { value: "weight_loss", label: "Weight Loss" },
  { value: "skincare", label: "Skincare" },
  { value: "other", label: "Other" },
];

const TYPE_META: Record<string, { label: string; icon: typeof Syringe; className: string }> = {
  botox: { label: "Botox", icon: Syringe, className: "bg-purple-100 text-purple-800 border-purple-200" },
  filler: { label: "Filler", icon: Droplets, className: "bg-pink-100 text-pink-800 border-pink-200" },
  laser: { label: "Laser", icon: Zap, className: "bg-amber-100 text-amber-800 border-amber-200" },
  microneedling: { label: "Microneedling", icon: CircleDot, className: "bg-sky-100 text-sky-800 border-sky-200" },
  peel: { label: "Peel", icon: Sun, className: "bg-orange-100 text-orange-800 border-orange-200" },
  facial: { label: "Facial", icon: Sparkles, className: "bg-rose-100 text-rose-800 border-rose-200" },
  iv_therapy: { label: "IV Therapy", icon: Droplets, className: "bg-teal-100 text-teal-800 border-teal-200" },
  weight_loss: { label: "Weight Loss", icon: Scale, className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  skincare: { label: "Skincare", icon: FlaskConical, className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  other: { label: "Other", icon: Sparkles, className: "bg-gray-100 text-gray-800 border-gray-200" },
};

const AMOUNT_PLACEHOLDERS: Partial<Record<PassportEntryEntryType, string>> = {
  botox: "e.g. 24 units",
  filler: "e.g. 1.0 mL",
  laser: "e.g. settings / passes",
  weight_loss: "e.g. 0.5 mg weekly",
};

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? TYPE_META.other!;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={meta.className}>
      <Icon className="h-3 w-3 mr-1" /> {meta.label}
    </Badge>
  );
}

const emptyForm = {
  entryType: "" as PassportEntryEntryType | "",
  performedOn: format(new Date(), "yyyy-MM-dd"),
  title: "",
  product: "",
  amount: "",
  area: "",
  provider: "",
  notes: "",
};

export default function Passport() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetPassport();
  const createEntry = useCreatePassportEntry();
  const updateProfile = useUpdatePassportProfile();
  const deleteEntry = useDeletePassportEntry();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ allergies: "", skinType: "", skincareRoutine: "" });

  const entries = data?.entries ?? [];
  const profile = data?.profile;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getGetPassportQueryKey() });
  }

  function handleAdd() {
    if (!form.entryType || !form.title.trim() || !form.performedOn) {
      toast.error("Please fill in the treatment type, name, and date.");
      return;
    }
    createEntry.mutate(
      {
        data: {
          entryType: form.entryType,
          performedOn: form.performedOn,
          title: form.title.trim(),
          product: form.product.trim() || null,
          amount: form.amount.trim() || null,
          area: form.area.trim() || null,
          provider: form.provider.trim() || null,
          notes: form.notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setAddOpen(false);
          setForm(emptyForm);
          toast.success("Added to your Beauty Passport");
        },
        onError: () => toast.error("Couldn't save. Please try again."),
      },
    );
  }

  function handleSaveProfile() {
    updateProfile.mutate(
      { data: profileForm },
      {
        onSuccess: () => {
          invalidate();
          setProfileOpen(false);
          toast.success("Profile updated");
        },
        onError: () => toast.error("Couldn't save. Please try again."),
      },
    );
  }

  function handleDelete(id: number) {
    deleteEntry.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast.success("Record deleted");
        },
      },
    );
  }

  const hasProfileInfo = !!(profile?.allergies || profile?.skinType || profile?.skincareRoutine);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <BookHeart className="h-8 w-8" /> Beauty Passport
        </h1>
        <p className="text-muted-foreground text-lg">
          Your lifetime record of every treatment — units, products, settings, and results. Yours to
          keep, wherever you go.
        </p>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Completely private to you — the office and staff can
          never see your passport.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/50">
          <CardContent className="pt-6 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">Log a treatment</div>
              <div className="text-sm text-muted-foreground">
                Botox units, filler, laser settings — anything, from any provider.
              </div>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full shrink-0">
                  <Plus className="h-4 w-4 mr-1.5" /> Add record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add a treatment record</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Type *</Label>
                      <Select
                        value={form.entryType}
                        onValueChange={(v) => set("entryType", v as PassportEntryEntryType)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTRY_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={form.performedOn}
                        onChange={(e) => set("performedOn", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Treatment name *</Label>
                    <Input
                      placeholder="e.g. Botox — forehead & crow's feet"
                      value={form.title}
                      onChange={(e) => set("title", e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Product</Label>
                      <Input
                        placeholder="e.g. Juvederm Ultra"
                        value={form.product}
                        onChange={(e) => set("product", e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Amount / settings</Label>
                      <Input
                        placeholder={
                          (form.entryType && AMOUNT_PLACEHOLDERS[form.entryType]) || "e.g. 24 units"
                        }
                        value={form.amount}
                        onChange={(e) => set("amount", e.target.value)}
                        maxLength={200}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Area</Label>
                      <Input
                        placeholder="e.g. lips, full face"
                        value={form.area}
                        onChange={(e) => set("area", e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Provider / clinic</Label>
                      <Input
                        placeholder="e.g. LUXE Wellness"
                        value={form.provider}
                        onChange={(e) => set("provider", e.target.value)}
                        maxLength={200}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="How it went, results, anything to remember next time..."
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      maxLength={2000}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAdd} disabled={createEntry.isPending} className="rounded-full">
                    {createEntry.isPending ? "Saving..." : "Save record"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              About my skin
              <Dialog
                open={profileOpen}
                onOpenChange={(open) => {
                  setProfileOpen(open);
                  if (open)
                    setProfileForm({
                      allergies: profile?.allergies ?? "",
                      skinType: profile?.skinType ?? "",
                      skincareRoutine: profile?.skincareRoutine ?? "",
                    });
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>About my skin</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Allergies & sensitivities</Label>
                      <Textarea
                        placeholder="e.g. lidocaine sensitivity, fragrance allergy..."
                        value={profileForm.allergies}
                        onChange={(e) => setProfileForm((p) => ({ ...p, allergies: e.target.value }))}
                        maxLength={2000}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Skin type</Label>
                      <Input
                        placeholder="e.g. combination, sensitive"
                        value={profileForm.skinType}
                        onChange={(e) => setProfileForm((p) => ({ ...p, skinType: e.target.value }))}
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Current skincare routine</Label>
                      <Textarea
                        placeholder="e.g. AM: vitamin C + SPF. PM: retinol 3x/week..."
                        value={profileForm.skincareRoutine}
                        onChange={(e) =>
                          setProfileForm((p) => ({ ...p, skincareRoutine: e.target.value }))
                        }
                        maxLength={2000}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={updateProfile.isPending}
                      className="rounded-full"
                    >
                      {updateProfile.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {hasProfileInfo ? (
              <>
                {profile?.allergies && (
                  <div>
                    <span className="font-medium">Allergies:</span>{" "}
                    <span className="text-muted-foreground">{profile.allergies}</span>
                  </div>
                )}
                {profile?.skinType && (
                  <div>
                    <span className="font-medium">Skin type:</span>{" "}
                    <span className="text-muted-foreground">{profile.skinType}</span>
                  </div>
                )}
                {profile?.skincareRoutine && (
                  <div>
                    <span className="font-medium">Routine:</span>{" "}
                    <span className="text-muted-foreground">{profile.skincareRoutine}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">
                Add your allergies, skin type, and routine so it's always on hand at appointments.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-serif text-primary mb-3">Treatment history</h2>
        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No records yet. Start with your most recent treatment — even a rough date helps.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {entries.map((entry: PassportEntry) => (
              <Card key={entry.id}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <TypeBadge type={entry.entryType} />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(`${entry.performedOn}T00:00:00`), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="font-medium">{entry.title}</div>
                      <div className="text-sm text-muted-foreground mt-0.5 space-x-2">
                        {entry.product && <span>{entry.product}</span>}
                        {entry.amount && <span>· {entry.amount}</span>}
                        {entry.area && <span>· {entry.area}</span>}
                        {entry.provider && <span>· {entry.provider}</span>}
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground mt-1.5">{entry.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
