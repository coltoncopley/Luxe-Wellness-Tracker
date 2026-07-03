import { useState } from "react";
import {
  useGetPassport,
  getGetPassportQueryKey,
  useCreatePassportEntry,
  useUpdatePassportProfile,
  useDeletePassportEntry,
  useUpdatePassportReminder,
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
import { BookHeart, Plus, Lock, Pencil, Trash2, Syringe, Zap, Droplets, Sparkles, Scale, FlaskConical, Sun, CircleDot, Bell, BellRing, Printer } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

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

/** Common treatments patients can pick instead of typing — pre-fills type, name, and amount hint. */
const PRESET_TREATMENTS: {
  label: string;
  entryType: PassportEntryEntryType;
  title: string;
  amountPlaceholder: string;
}[] = [
  { label: "Botox — forehead lines", entryType: "botox", title: "Botox — forehead lines", amountPlaceholder: "e.g. 20 units" },
  { label: "Botox — frown lines (11s)", entryType: "botox", title: "Botox — frown lines (11s)", amountPlaceholder: "e.g. 20 units" },
  { label: "Botox — crow's feet", entryType: "botox", title: "Botox — crow's feet", amountPlaceholder: "e.g. 12 units" },
  { label: "Botox — full upper face", entryType: "botox", title: "Botox — full upper face", amountPlaceholder: "e.g. 50 units" },
  { label: "Lip flip", entryType: "botox", title: "Lip flip", amountPlaceholder: "e.g. 4 units" },
  { label: "Lip filler", entryType: "filler", title: "Lip filler", amountPlaceholder: "e.g. 1 syringe (1.0 mL)" },
  { label: "Cheek filler", entryType: "filler", title: "Cheek filler", amountPlaceholder: "e.g. 2 syringes" },
  { label: "Chin filler", entryType: "filler", title: "Chin filler", amountPlaceholder: "e.g. 1 syringe" },
  { label: "Jawline filler", entryType: "filler", title: "Jawline filler", amountPlaceholder: "e.g. 2 syringes" },
  { label: "Under-eye filler (tear trough)", entryType: "filler", title: "Under-eye filler (tear trough)", amountPlaceholder: "e.g. 1 syringe" },
  { label: "Smile line filler (nasolabial)", entryType: "filler", title: "Smile line filler (nasolabial)", amountPlaceholder: "e.g. 1 syringe" },
  { label: "Lip filler dissolve", entryType: "filler", title: "Filler dissolve (hyaluronidase)", amountPlaceholder: "e.g. 1 vial" },
  { label: "Chemical peel", entryType: "peel", title: "Chemical peel", amountPlaceholder: "e.g. medium depth" },
  { label: "Microneedling", entryType: "microneedling", title: "Microneedling", amountPlaceholder: "e.g. full face, 1 pass" },
  { label: "Microneedling with PRP", entryType: "microneedling", title: "Microneedling with PRP", amountPlaceholder: "e.g. full face" },
  { label: "Signature facial", entryType: "facial", title: "Signature facial", amountPlaceholder: "" },
  { label: "Hydrating facial", entryType: "facial", title: "Hydrating facial", amountPlaceholder: "" },
  { label: "Laser hair removal", entryType: "laser", title: "Laser hair removal", amountPlaceholder: "e.g. session 3 of 6" },
  { label: "Laser skin resurfacing", entryType: "laser", title: "Laser skin resurfacing", amountPlaceholder: "e.g. settings / passes" },
  { label: "IV therapy drip", entryType: "iv_therapy", title: "IV therapy drip", amountPlaceholder: "e.g. Myers' cocktail" },
  { label: "Weight-loss injection (GLP-1)", entryType: "weight_loss", title: "Weight-loss injection (GLP-1)", amountPlaceholder: "e.g. 0.5 mg weekly" },
  { label: "Vitamin B12 shot", entryType: "iv_therapy", title: "Vitamin B12 shot", amountPlaceholder: "e.g. 1 mL" },
];

const CUSTOM_PRESET = "__custom__";

/** Typical touch-up intervals in days, used only to pre-fill a suggestion the patient can change. */
const SUGGESTED_REMINDER_DAYS: Partial<Record<PassportEntryEntryType, { days: number; label: string }>> = {
  botox: { days: 105, label: "~3.5 months" },
  filler: { days: 270, label: "~9 months" },
  laser: { days: 42, label: "~6 weeks" },
  microneedling: { days: 42, label: "~6 weeks" },
  peel: { days: 42, label: "~6 weeks" },
  facial: { days: 30, label: "~1 month" },
  iv_therapy: { days: 30, label: "~1 month" },
};

function suggestReminderDate(entryType: PassportEntryEntryType | "", performedOn: string): string {
  if (!entryType || !performedOn) return "";
  const suggestion = SUGGESTED_REMINDER_DAYS[entryType as PassportEntryEntryType];
  if (!suggestion) return "";
  const base = new Date(`${performedOn}T00:00:00`);
  if (isNaN(base.getTime())) return "";
  const suggested = addDays(base, suggestion.days);
  const tomorrow = addDays(new Date(), 1);
  return format(suggested > tomorrow ? suggested : tomorrow, "yyyy-MM-dd");
}

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
  reminderOn: "",
};

export default function Passport() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetPassport();
  const createEntry = useCreatePassportEntry();
  const updateProfile = useUpdatePassportProfile();
  const deleteEntry = useDeletePassportEntry();
  const updateReminder = useUpdatePassportReminder();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [preset, setPreset] = useState("");
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
          reminderOn: form.reminderOn || null,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setAddOpen(false);
          setForm(emptyForm);
          setPreset("");
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

  function handleToggleReminder(entry: PassportEntry) {
    const newDate = entry.reminderOn
      ? null
      : suggestReminderDate(entry.entryType, entry.performedOn) ||
        format(addDays(new Date(), 30), "yyyy-MM-dd");
    updateReminder.mutate(
      { id: entry.id, data: { reminderOn: newDate } },
      {
        onSuccess: () => {
          invalidate();
          toast.success(
            newDate
              ? `Reminder set for ${format(new Date(`${newDate}T00:00:00`), "MMM d, yyyy")}`
              : "Reminder removed",
          );
        },
        onError: () => toast.error("Couldn't update the reminder. Please try again."),
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
            <BookHeart className="h-8 w-8" /> Beauty Passport
          </h1>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => window.print()}
            disabled={isLoading}
          >
            <Printer className="h-4 w-4 mr-1.5" /> Print summary
          </Button>
        </div>
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
            <Dialog
              open={addOpen}
              onOpenChange={(open) => {
                setAddOpen(open);
                if (!open) setPreset("");
              }}
            >
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
                  <div className="space-y-1.5">
                    <Label>Choose a treatment</Label>
                    <Select
                      value={preset}
                      onValueChange={(v) => {
                        setPreset(v);
                        if (v === CUSTOM_PRESET) {
                          setForm((f) => ({ ...f, title: "" }));
                          return;
                        }
                        const p = PRESET_TREATMENTS.find((pt) => pt.label === v);
                        if (!p) return;
                        setForm((f) => ({
                          ...f,
                          entryType: p.entryType,
                          title: p.title,
                          reminderOn: suggestReminderDate(p.entryType, f.performedOn),
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a common treatment or enter your own" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {PRESET_TREATMENTS.map((p) => (
                          <SelectItem key={p.label} value={p.label}>
                            {p.label}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_PRESET}>Other — I'll type it in</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Picking one fills in the details below — you can still change anything.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Type *</Label>
                      <Select
                        value={form.entryType}
                        onValueChange={(v) => {
                          const t = v as PassportEntryEntryType;
                          setPreset((p) => {
                            const pt = PRESET_TREATMENTS.find((x) => x.label === p);
                            return pt && pt.entryType !== t ? "" : p;
                          });
                          setForm((f) => ({
                            ...f,
                            entryType: t,
                            reminderOn: suggestReminderDate(t, f.performedOn),
                          }));
                        }}
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
                          (() => {
                            const pt = PRESET_TREATMENTS.find((x) => x.label === preset);
                            return pt && pt.entryType === form.entryType
                              ? pt.amountPlaceholder
                              : "";
                          })() ||
                          (form.entryType && AMOUNT_PLACEHOLDERS[form.entryType]) ||
                          "e.g. 24 units"
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
                  <div className="space-y-1.5 rounded-lg border p-3 bg-muted/30">
                    <Label className="flex items-center gap-1.5">
                      <BellRing className="h-3.5 w-3.5 text-primary" /> Touch-up reminder
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={form.reminderOn}
                        onChange={(e) => set("reminderOn", e.target.value)}
                        className="max-w-[180px]"
                      />
                      {form.reminderOn && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => set("reminderOn", "")}
                        >
                          No reminder
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {form.entryType && SUGGESTED_REMINDER_DAYS[form.entryType]
                        ? `Typical touch-up for ${TYPE_META[form.entryType]?.label ?? "this"}: ${SUGGESTED_REMINDER_DAYS[form.entryType]!.label} — we pre-filled a date you can change or clear.`
                        : "Optional — we'll send you a private nudge when it's time to rebook."}
                    </p>
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
                      {entry.reminderOn && (
                        <Badge variant="outline" className="mt-2 bg-primary/5 text-primary border-primary/30">
                          <BellRing className="h-3 w-3 mr-1" /> Touch-up reminder{" "}
                          {format(new Date(`${entry.reminderOn}T00:00:00`), "MMM d, yyyy")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={entry.reminderOn ? "text-primary" : "text-muted-foreground"}
                        title={entry.reminderOn ? "Remove touch-up reminder" : "Set a touch-up reminder"}
                        disabled={updateReminder.isPending}
                        onClick={() => handleToggleReminder(entry)}
                      >
                        {entry.reminderOn ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="print-only" id="passport-print">
        <div style={{ fontFamily: "Georgia, serif", color: "#111", padding: "8px 0" }}>
          <h1 style={{ fontSize: "22px", marginBottom: "2px" }}>Beauty Passport — Treatment Summary</h1>
          <p style={{ fontSize: "12px", color: "#555", marginBottom: "16px" }}>
            Self-reported record, generated from the LUXE Wellness &amp; Aesthetics app on{" "}
            {format(new Date(), "MMMM d, yyyy")}
          </p>

          <h2 style={{ fontSize: "15px", borderBottom: "1px solid #999", paddingBottom: "3px", marginBottom: "6px" }}>
            About my skin
          </h2>
          <table style={{ fontSize: "12px", marginBottom: "16px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, paddingRight: "12px", verticalAlign: "top" }}>Allergies &amp; sensitivities</td>
                <td>{profile?.allergies || "None listed"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, paddingRight: "12px", verticalAlign: "top" }}>Skin type</td>
                <td>{profile?.skinType || "Not specified"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, paddingRight: "12px", verticalAlign: "top" }}>Skincare routine</td>
                <td>{profile?.skincareRoutine || "Not specified"}</td>
              </tr>
            </tbody>
          </table>

          <h2 style={{ fontSize: "15px", borderBottom: "1px solid #999", paddingBottom: "3px", marginBottom: "6px" }}>
            Treatment history ({entries.length} record{entries.length === 1 ? "" : "s"})
          </h2>
          {entries.length === 0 ? (
            <p style={{ fontSize: "12px" }}>No treatments recorded yet.</p>
          ) : (
            <table style={{ fontSize: "11px", width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #999" }}>
                  <th style={{ padding: "4px 8px 4px 0" }}>Date</th>
                  <th style={{ padding: "4px 8px 4px 0" }}>Treatment</th>
                  <th style={{ padding: "4px 8px 4px 0" }}>Product</th>
                  <th style={{ padding: "4px 8px 4px 0" }}>Amount / settings</th>
                  <th style={{ padding: "4px 8px 4px 0" }}>Area</th>
                  <th style={{ padding: "4px 0" }}>Provider</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: PassportEntry) => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid #ddd", verticalAlign: "top" }}>
                    <td style={{ padding: "4px 8px 4px 0", whiteSpace: "nowrap" }}>{entry.performedOn}</td>
                    <td style={{ padding: "4px 8px 4px 0" }}>
                      {entry.title}
                      <span style={{ color: "#777" }}> ({TYPE_META[entry.entryType]?.label ?? entry.entryType})</span>
                      {entry.notes && (
                        <div style={{ color: "#555", fontSize: "10px", marginTop: "2px" }}>{entry.notes}</div>
                      )}
                    </td>
                    <td style={{ padding: "4px 8px 4px 0" }}>{entry.product ?? "—"}</td>
                    <td style={{ padding: "4px 8px 4px 0" }}>{entry.amount ?? "—"}</td>
                    <td style={{ padding: "4px 8px 4px 0" }}>{entry.area ?? "—"}</td>
                    <td style={{ padding: "4px 0" }}>{entry.provider ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ fontSize: "10px", color: "#777", marginTop: "16px" }}>
            This is a personal, self-reported record kept by the patient. It is not a medical chart
            and has not been verified by LUXE Wellness &amp; Aesthetics or any provider.
          </p>
        </div>
      </div>
    </div>
  );
}
