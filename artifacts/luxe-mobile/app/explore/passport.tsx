import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getGetPassportQueryKey,
  useCreatePassportEntry,
  useDeletePassportEntry,
  useGetPassport,
  useUpdatePassportProfile,
  useUpdatePassportReminder,
} from "@workspace/api-client-react";
import type {
  PassportEntry,
  PassportEntryEntryType,
} from "@workspace/api-client-react";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  Card,
  EmptyState,
  ErrorView,
  LoadingView,
  LuxeButton,
  LuxeInput,
  SectionTitle,
  StackScreen,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

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

const TYPE_META: Record<
  PassportEntryEntryType,
  { label: string; icon: keyof typeof Feather.glyphMap }
> = {
  botox: { label: "Botox", icon: "target" },
  filler: { label: "Filler", icon: "droplet" },
  laser: { label: "Laser", icon: "zap" },
  microneedling: { label: "Microneedling", icon: "grid" },
  peel: { label: "Peel", icon: "sun" },
  facial: { label: "Facial", icon: "smile" },
  iv_therapy: { label: "IV Therapy", icon: "thermometer" },
  weight_loss: { label: "Weight Loss", icon: "trending-down" },
  skincare: { label: "Skincare", icon: "feather" },
  other: { label: "Other", icon: "star" },
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
const SUGGESTED_REMINDER_DAYS: Partial<
  Record<PassportEntryEntryType, { days: number; label: string }>
> = {
  botox: { days: 105, label: "~3.5 months" },
  filler: { days: 270, label: "~9 months" },
  laser: { days: 42, label: "~6 weeks" },
  microneedling: { days: 42, label: "~6 weeks" },
  peel: { days: 42, label: "~6 weeks" },
  facial: { days: 30, label: "~1 month" },
  iv_therapy: { days: 30, label: "~1 month" },
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return isoOf(new Date());
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Format a YYYY-MM-DD string as "MMM d, yyyy" without timezone drift. */
function formatDisplay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function suggestReminderDate(
  entryType: PassportEntryEntryType | "",
  performedOn: string,
): string {
  if (!entryType || !performedOn) return "";
  const suggestion = SUGGESTED_REMINDER_DAYS[entryType as PassportEntryEntryType];
  if (!suggestion) return "";
  const base = new Date(`${performedOn}T00:00:00`);
  if (isNaN(base.getTime())) return "";
  const suggested = addDays(base, suggestion.days);
  const tomorrow = addDays(new Date(), 1);
  return isoOf(suggested > tomorrow ? suggested : tomorrow);
}

const emptyForm = {
  entryType: "" as PassportEntryEntryType | "",
  performedOn: todayISO(),
  title: "",
  product: "",
  amount: "",
  area: "",
  provider: "",
  notes: "",
  reminderOn: "",
};

type FormState = typeof emptyForm;

function TypeBadge({ type }: { type: PassportEntryEntryType }) {
  const c = useColors();
  const meta = TYPE_META[type] ?? TYPE_META.other;
  return (
    <View style={[styles.badge, { backgroundColor: c.secondary }]}>
      <Feather name={meta.icon} size={12} color={c.tint} />
      <Text style={{ color: c.secondaryForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
        {meta.label}
      </Text>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 }}>
      {children}
    </Text>
  );
}

export default function PassportScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isRefetching } = useGetPassport();
  const createEntry = useCreatePassportEntry();
  const updateProfile = useUpdatePassportProfile();
  const deleteEntry = useDeletePassportEntry();
  const updateReminder = useUpdatePassportReminder();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [preset, setPreset] = useState("");
  const [showPresetList, setShowPresetList] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ allergies: "", skinType: "", skincareRoutine: "" });

  const entries = data?.entries ?? [];
  const profile = data?.profile;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getGetPassportQueryKey() });
  }

  function openAdd() {
    setForm(emptyForm);
    setPreset("");
    setShowPresetList(false);
    setAddOpen(true);
  }

  function pickPreset(label: string) {
    setShowPresetList(false);
    setPreset(label);
    if (label === CUSTOM_PRESET) {
      setForm((f) => ({ ...f, title: "" }));
      return;
    }
    const p = PRESET_TREATMENTS.find((pt) => pt.label === label);
    if (!p) return;
    setForm((f) => ({
      ...f,
      entryType: p.entryType,
      title: p.title,
      reminderOn: suggestReminderDate(p.entryType, f.performedOn),
    }));
  }

  function pickType(t: PassportEntryEntryType) {
    setPreset((p) => {
      const pt = PRESET_TREATMENTS.find((x) => x.label === p);
      return pt && pt.entryType !== t ? "" : p;
    });
    setForm((f) => ({
      ...f,
      entryType: t,
      reminderOn: suggestReminderDate(t, f.performedOn),
    }));
  }

  function handleAdd() {
    if (!form.entryType || !form.title.trim() || !form.performedOn) {
      Alert.alert("Missing details", "Please fill in the treatment type, name, and date.");
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
        },
        onError: () => Alert.alert("Couldn't save", "Please try again."),
      },
    );
  }

  function openProfile() {
    setProfileForm({
      allergies: profile?.allergies ?? "",
      skinType: profile?.skinType ?? "",
      skincareRoutine: profile?.skincareRoutine ?? "",
    });
    setProfileOpen(true);
  }

  function handleSaveProfile() {
    updateProfile.mutate(
      { data: profileForm },
      {
        onSuccess: () => {
          invalidate();
          setProfileOpen(false);
        },
        onError: () => Alert.alert("Couldn't save", "Please try again."),
      },
    );
  }

  function handleToggleReminder(entry: PassportEntry) {
    const newDate = entry.reminderOn
      ? null
      : suggestReminderDate(entry.entryType, entry.performedOn) ||
        isoOf(addDays(new Date(), 30));
    updateReminder.mutate(
      { id: entry.id, data: { reminderOn: newDate } },
      {
        onSuccess: () => invalidate(),
        onError: () =>
          Alert.alert("Couldn't update", "The reminder couldn't be updated. Please try again."),
      },
    );
  }

  function handleDelete(entry: PassportEntry) {
    Alert.alert("Delete record", `Delete "${entry.title}" from your passport?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteEntry.mutate({ id: entry.id }, { onSuccess: () => invalidate() }),
      },
    ]);
  }

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Couldn't load your passport." onRetry={() => refetch()} />;

  const hasProfileInfo = !!(profile?.allergies || profile?.skinType || profile?.skincareRoutine);
  const activePresetPlaceholder =
    PRESET_TREATMENTS.find((x) => x.label === preset && x.entryType === form.entryType)
      ?.amountPlaceholder ||
    (form.entryType ? AMOUNT_PLACEHOLDERS[form.entryType] : undefined) ||
    "e.g. 24 units";

  return (
    <StackScreen refreshing={isRefetching} onRefresh={() => refetch()}>
      <Text style={[styles.lead, { color: c.foreground }]}>
        Your lifetime record of every treatment — units, products, settings, and results. Yours to
        keep, wherever you go.
      </Text>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 10 }}>
        <Feather name="lock" size={13} color={c.mutedForeground} />
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 }}>
          Completely private to you — the office and staff can never see your passport.
        </Text>
      </View>

      <Card style={{ marginTop: 20, gap: 12 }}>
        <View>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
            Log a treatment
          </Text>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 3 }}>
            Botox units, filler, laser settings — anything, from any provider.
          </Text>
        </View>
        <LuxeButton label="Add record" icon="plus" onPress={openAdd} />
      </Card>

      <Card style={{ marginTop: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
            About my skin
          </Text>
          <LuxeButton label="Edit" icon="edit-2" variant="ghost" small onPress={openProfile} />
        </View>
        {hasProfileInfo ? (
          <View style={{ gap: 6 }}>
            {profile?.allergies ? (
              <ProfileRow label="Allergies" value={profile.allergies} />
            ) : null}
            {profile?.skinType ? <ProfileRow label="Skin type" value={profile.skinType} /> : null}
            {profile?.skincareRoutine ? (
              <ProfileRow label="Routine" value={profile.skincareRoutine} />
            ) : null}
          </View>
        ) : (
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
            Add your allergies, skin type, and routine so it's always on hand at appointments.
          </Text>
        )}
      </Card>

      <SectionTitle>Treatment history</SectionTitle>
      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon="book-open"
            text="No records yet. Start with your most recent treatment — even a rough date helps."
          />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {entries.map((entry) => (
            <Card key={entry.id}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <TypeBadge type={entry.entryType} />
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                      {formatDisplay(entry.performedOn)}
                    </Text>
                  </View>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                    {entry.title}
                  </Text>
                  {(entry.product || entry.amount || entry.area || entry.provider) ? (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 3 }}>
                      {[entry.product, entry.amount, entry.area, entry.provider]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ) : null}
                  {entry.notes ? (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6 }}>
                      {entry.notes}
                    </Text>
                  ) : null}
                  {entry.reminderOn ? (
                    <View style={[styles.reminderPill, { borderColor: c.accent }]}>
                      <Feather name="bell" size={12} color={c.tint} />
                      <Text style={{ color: c.tint, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                        Touch-up reminder {formatDisplay(entry.reminderOn)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ gap: 4 }}>
                  <Pressable
                    onPress={() => handleToggleReminder(entry)}
                    disabled={updateReminder.isPending}
                    hitSlop={8}
                    style={styles.iconBtn}
                  >
                    <Feather
                      name={entry.reminderOn ? "bell" : "bell-off"}
                      size={18}
                      color={entry.reminderOn ? c.tint : c.mutedForeground}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(entry)}
                    hitSlop={8}
                    style={styles.iconBtn}
                  >
                    <Feather name="trash-2" size={18} color={c.mutedForeground} />
                  </Pressable>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Add record modal */}
      <Modal
        visible={addOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddOpen(false)}
      >
        <ModalShell title="Add a treatment record" onClose={() => setAddOpen(false)}>
          <View style={{ gap: 6 }}>
            <FieldLabel>Choose a treatment</FieldLabel>
            <Pressable
              onPress={() => setShowPresetList((s) => !s)}
              style={[styles.selectBtn, { backgroundColor: c.card, borderColor: c.input }]}
            >
              <Text
                style={{
                  color: preset && preset !== CUSTOM_PRESET ? c.foreground : c.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  flex: 1,
                }}
              >
                {preset === CUSTOM_PRESET
                  ? "Other — I'll type it in"
                  : preset || "Pick a common treatment or enter your own"}
              </Text>
              <Feather name={showPresetList ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />
            </Pressable>
            {showPresetList ? (
              <View style={[styles.presetList, { backgroundColor: c.card, borderColor: c.border }]}>
                <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {PRESET_TREATMENTS.map((p) => (
                    <Pressable
                      key={p.label}
                      onPress={() => pickPreset(p.label)}
                      style={[styles.presetRow, { borderBottomColor: c.border }]}
                    >
                      <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }}>
                        {p.label}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={() => pickPreset(CUSTOM_PRESET)} style={styles.presetRow}>
                    <Text style={{ color: c.tint, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                      Other — I'll type it in
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>
            ) : null}
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
              Picking one fills in the details below — you can still change anything.
            </Text>
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Type *</FieldLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ENTRY_TYPES.map((t) => {
                const active = form.entryType === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => pickType(t.value)}
                    style={{
                      backgroundColor: active ? c.accent : c.secondary,
                      borderRadius: 999,
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#0F1729" : c.secondaryForeground,
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                        fontSize: 13,
                      }}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Date * (YYYY-MM-DD)</FieldLabel>
            <LuxeInput
              value={form.performedOn}
              onChangeText={(v) => set("performedOn", v)}
              placeholder="2025-01-15"
              autoCapitalize="none"
            />
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Treatment name *</FieldLabel>
            <LuxeInput
              value={form.title}
              onChangeText={(v) => set("title", v)}
              placeholder="e.g. Botox — forehead & crow's feet"
              maxLength={200}
            />
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Product</FieldLabel>
            <LuxeInput
              value={form.product}
              onChangeText={(v) => set("product", v)}
              placeholder="e.g. Juvederm Ultra"
              maxLength={200}
            />
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Amount / settings</FieldLabel>
            <LuxeInput
              value={form.amount}
              onChangeText={(v) => set("amount", v)}
              placeholder={activePresetPlaceholder}
              maxLength={200}
            />
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Area</FieldLabel>
            <LuxeInput
              value={form.area}
              onChangeText={(v) => set("area", v)}
              placeholder="e.g. lips, full face"
              maxLength={200}
            />
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Provider / clinic</FieldLabel>
            <LuxeInput
              value={form.provider}
              onChangeText={(v) => set("provider", v)}
              placeholder="e.g. LUXE Wellness"
              maxLength={200}
            />
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Notes</FieldLabel>
            <LuxeInput
              value={form.notes}
              onChangeText={(v) => set("notes", v)}
              placeholder="How it went, results, anything to remember next time..."
              maxLength={2000}
              multiline
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>

          <View style={[styles.reminderBox, { borderColor: c.border, backgroundColor: c.secondary }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="bell" size={14} color={c.tint} />
              <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                Touch-up reminder
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <LuxeInput
                  value={form.reminderOn}
                  onChangeText={(v) => set("reminderOn", v)}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
              {form.reminderOn ? (
                <LuxeButton label="Clear" variant="ghost" small onPress={() => set("reminderOn", "")} />
              ) : null}
            </View>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
              {form.entryType && SUGGESTED_REMINDER_DAYS[form.entryType]
                ? `Typical touch-up for ${TYPE_META[form.entryType].label}: ${SUGGESTED_REMINDER_DAYS[form.entryType]!.label} — we pre-filled a date you can change or clear.`
                : "Optional — we'll send you a private nudge when it's time to rebook."}
            </Text>
          </View>

          <View style={{ marginTop: 20 }}>
            <LuxeButton
              label={createEntry.isPending ? "Saving..." : "Save record"}
              onPress={handleAdd}
              loading={createEntry.isPending}
            />
          </View>
        </ModalShell>
      </Modal>

      {/* Profile modal */}
      <Modal
        visible={profileOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProfileOpen(false)}
      >
        <ModalShell title="About my skin" onClose={() => setProfileOpen(false)}>
          <View style={{ gap: 6 }}>
            <FieldLabel>Allergies & sensitivities</FieldLabel>
            <LuxeInput
              value={profileForm.allergies}
              onChangeText={(v) => setProfileForm((p) => ({ ...p, allergies: v }))}
              placeholder="e.g. lidocaine sensitivity, fragrance allergy..."
              maxLength={2000}
              multiline
              style={{ minHeight: 64, textAlignVertical: "top" }}
            />
          </View>
          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Skin type</FieldLabel>
            <LuxeInput
              value={profileForm.skinType}
              onChangeText={(v) => setProfileForm((p) => ({ ...p, skinType: v }))}
              placeholder="e.g. combination, sensitive"
              maxLength={200}
            />
          </View>
          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel>Current skincare routine</FieldLabel>
            <LuxeInput
              value={profileForm.skincareRoutine}
              onChangeText={(v) => setProfileForm((p) => ({ ...p, skincareRoutine: v }))}
              placeholder="e.g. AM: vitamin C + SPF. PM: retinol 3x/week..."
              maxLength={2000}
              multiline
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>
          <View style={{ marginTop: 20 }}>
            <LuxeButton
              label={updateProfile.isPending ? "Saving..." : "Save"}
              onPress={handleSaveProfile}
              loading={updateProfile.isPending}
            />
          </View>
        </ModalShell>
      </Modal>
    </StackScreen>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium" }}>{label}:</Text> {value}
    </Text>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View
        style={[
          styles.modalHeader,
          { paddingTop: topPad + 12, borderBottomColor: c.border },
        ]}
      >
        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 17, flex: 1 }}>
          {title}
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Feather name="x" size={22} color={c.mutedForeground} />
        </Pressable>
      </View>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  reminderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
    marginTop: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  presetList: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  presetRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reminderBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
