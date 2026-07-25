import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "@/lib/alert";

import type {
  Exercise,
  GenerateWorkoutInput,
  WorkoutExercise,
  WorkoutListItem,
  WorkoutPreferencesInput,
} from "@workspace/api-client-react";
import {
  getGetMuscleRecoveryQueryKey,
  getGetWorkoutPreferencesQueryKey,
  getGetWorkoutQueryKey,
  getListWorkoutsQueryKey,
  useAddWorkoutExercise,
  useCompleteWorkout,
  useCreateWorkout,
  useDeleteWorkout,
  useDeleteWorkoutSet,
  useGenerateWorkout,
  useGetExerciseSuggestion,
  useGetMuscleRecovery,
  useGetWorkout,
  useGetWorkoutPreferences,
  useListExercises,
  useListWorkouts,
  useLogWorkoutSet,
  useRemoveWorkoutExercise,
  useSetWorkoutPreferences,
} from "@workspace/api-client-react";

import {
  Card,
  Chip,
  EmptyState,
  ErrorView,
  LoadingView,
  LuxeButton,
  LuxeInput,
  SectionTitle,
  Segmented,
  StackScreen,
  Stepper,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

const MUSCLE_LABELS: Record<string, string> = {
  chest: "Chest",
  lats: "Lats",
  upper_back: "Upper Back",
  lower_back: "Lower Back",
  traps: "Traps",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  bodyweight: "Bodyweight",
  dumbbell: "Dumbbells",
  barbell: "Barbell",
  machine: "Machines",
  cable: "Cables",
  band: "Bands",
  kettlebell: "Kettlebells",
};

const GOAL_OPTIONS: { key: string; label: string }[] = [
  { key: "strength", label: "Get stronger" },
  { key: "build_muscle", label: "Build muscle" },
  { key: "tone", label: "Tone up" },
  { key: "endurance", label: "Endurance" },
];

const EXPERIENCE_OPTIONS: { key: string; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const FOCUS_AREA_OPTIONS: { key: string; label: string }[] = [
  { key: "full_body", label: "Full body" },
  { key: "upper_body", label: "Upper body" },
  { key: "lower_body", label: "Lower body" },
  { key: "core", label: "Core" },
  { key: "arms", label: "Arms" },
  { key: "back", label: "Back" },
  { key: "chest", label: "Chest" },
  { key: "shoulders", label: "Shoulders" },
  { key: "legs", label: "Legs" },
  { key: "glutes", label: "Glutes" },
];

const DURATION_OPTIONS: { key: number; label: string }[] = [
  { key: 20, label: "Quick · ~20 min" },
  { key: 40, label: "Standard · ~40 min" },
  { key: 60, label: "Longer · ~60 min" },
];

const ENERGY_OPTIONS: { key: string; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

function muscleLabel(key: string): string {
  return MUSCLE_LABELS[key] ?? key;
}

/** Deep-link to a YouTube search for a proper-form demo of the given exercise. */
function openHowToVideo(exerciseName: string): void {
  const query = encodeURIComponent(`how to ${exerciseName} proper form technique`);
  void Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
}

function fmtWorkoutDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function ModalShell({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: c.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "88%",
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 10,
            }}
          >
            <Text
              style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 19, color: c.foreground }}
            >
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={c.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ExerciseLibraryList({
  onPick,
  pickLabel,
}: {
  onPick?: (exercise: Exercise) => void;
  pickLabel?: string;
}) {
  const c = useColors();
  const query = useListExercises();
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    const q = search.trim().toLowerCase();
    return list.filter(
      (e) =>
        (!muscle || e.primaryMuscle === muscle) &&
        (q.length === 0 || e.name.toLowerCase().includes(q)),
    );
  }, [query.data, search, muscle]);

  if (query.isLoading) {
    return (
      <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground, paddingVertical: 20 }}>
        Loading exercises…
      </Text>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <LuxeInput placeholder="Search exercises…" value={search} onChangeText={setSearch} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All" active={muscle === null} onPress={() => setMuscle(null)} />
        {Object.entries(MUSCLE_LABELS).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            active={muscle === key}
            onPress={() => setMuscle(muscle === key ? null : key)}
          />
        ))}
      </ScrollView>
      {filtered.length === 0 ? (
        <EmptyState icon="search" text="No exercises match your search." />
      ) : (
        filtered.map((e) => (
          <Card key={e.id} style={{ padding: 14, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable style={{ flex: 1 }} onPress={() => setOpenId(openId === e.id ? null : e.id)}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                  {e.name}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: c.mutedForeground,
                    marginTop: 2,
                  }}
                >
                  {muscleLabel(e.primaryMuscle)} · {EQUIPMENT_LABELS[e.equipment] ?? e.equipment} ·{" "}
                  {e.difficulty}
                </Text>
              </Pressable>
              {onPick ? (
                <LuxeButton
                  label={pickLabel ?? "Add"}
                  small
                  variant="outline"
                  onPress={() => onPick(e)}
                />
              ) : (
                <Feather
                  name={openId === e.id ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={c.mutedForeground}
                />
              )}
            </View>
            {openId === e.id ? (
              <View style={{ gap: 10 }}>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    lineHeight: 19,
                    color: c.mutedForeground,
                  }}
                >
                  {e.instructions}
                  {e.secondaryMuscles.length > 0
                    ? `\n\nAlso works: ${e.secondaryMuscles.map(muscleLabel).join(", ")}`
                    : ""}
                </Text>
                <LuxeButton
                  label="Watch how-to"
                  small
                  variant="outline"
                  icon="play-circle"
                  onPress={() => openHowToVideo(e.name)}
                />
              </View>
            ) : null}
          </Card>
        ))
      )}
    </View>
  );
}

function RecoverySection() {
  const c = useColors();
  const query = useGetMuscleRecovery();

  if (query.isLoading) {
    return (
      <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground, paddingVertical: 20 }}>
        Checking your recovery…
      </Text>
    );
  }

  const muscles = query.data ?? [];
  const trained = muscles
    .filter((m) => m.lastTrainedAt != null)
    .sort((a, b) => a.recoveryPct - b.recoveryPct);
  const fresh = muscles.filter((m) => m.lastTrainedAt == null);

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
        Muscles need about 3 days to fully recover after training. Higher means readier.
      </Text>
      {trained.length === 0 ? (
        <EmptyState icon="battery-charging" text="Complete a workout and your recovery will show up here." />
      ) : (
        <Card style={{ gap: 14 }}>
          {trained.map((m) => {
            const tone =
              m.recoveryPct >= 80 ? c.success : m.recoveryPct >= 50 ? c.warning : c.destructive;
            return (
              <View key={m.muscle}>
                <View
                  style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
                    {muscleLabel(m.muscle)}
                  </Text>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: tone }}>
                    {m.recoveryPct}%
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 999, backgroundColor: c.secondary }}>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 999,
                      width: `${Math.min(Math.max(m.recoveryPct, 2), 100)}%`,
                      backgroundColor: tone,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </Card>
      )}
      {fresh.length > 0 ? (
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
          Fresh and ready: {fresh.map((m) => muscleLabel(m.muscle)).join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

function PreferencesForm({ onSaved }: { onSaved: () => void }) {
  const c = useColors();
  const queryClient = useQueryClient();
  const prefsQuery = useGetWorkoutPreferences();
  const save = useSetWorkoutPreferences();
  const prefs = prefsQuery.data;

  const [goal, setGoal] = useState<string | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string[] | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [limitations, setLimitations] = useState<string | null>(null);

  if (prefsQuery.isLoading || !prefs) {
    return (
      <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground, paddingVertical: 20 }}>
        Loading your preferences…
      </Text>
    );
  }

  const goalV = goal ?? prefs.goal;
  const expV = experience ?? prefs.experienceLevel;
  const equipV = equipment ?? prefs.equipment;
  const durV = duration ?? prefs.targetDurationMins;
  const daysV = days ?? prefs.daysPerWeek;
  const limV = limitations ?? prefs.limitations ?? "";

  const toggleEquip = (key: string) => {
    setEquipment(equipV.includes(key) ? equipV.filter((e) => e !== key) : [...equipV, key]);
  };

  const onSave = () => {
    save.mutate(
      {
        data: {
          goal: goalV as WorkoutPreferencesInput["goal"],
          experienceLevel: expV as WorkoutPreferencesInput["experienceLevel"],
          equipment: equipV as WorkoutPreferencesInput["equipment"],
          targetDurationMins: durV,
          daysPerWeek: daysV,
          limitations: limV.trim().length > 0 ? limV.trim().slice(0, 500) : null,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetWorkoutPreferencesQueryKey() });
          onSaved();
        },
        onError: () => Alert.alert("Couldn't save", "Please try again."),
      },
    );
  };

  const label = (t: string) => (
    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>{t}</Text>
  );

  return (
    <View style={{ gap: 16 }}>
      {label("Goal")}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {GOAL_OPTIONS.map((o) => (
          <Chip key={o.key} label={o.label} active={goalV === o.key} onPress={() => setGoal(o.key)} />
        ))}
      </View>
      {label("Experience")}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {EXPERIENCE_OPTIONS.map((o) => (
          <Chip
            key={o.key}
            label={o.label}
            active={expV === o.key}
            onPress={() => setExperience(o.key)}
          />
        ))}
      </View>
      {label("Equipment you have")}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(EQUIPMENT_LABELS).map(([key, l]) => (
          <Chip key={key} label={l} active={equipV.includes(key)} onPress={() => toggleEquip(key)} />
        ))}
      </View>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
        Leave everything unselected to allow all equipment.
      </Text>
      <Stepper
        label="Session length"
        value={durV}
        display={`${durV} min`}
        onDecrement={() => setDuration(Math.max(10, durV - 5))}
        onIncrement={() => setDuration(Math.min(120, durV + 5))}
      />
      <Stepper
        label="Days per week"
        value={daysV}
        onDecrement={() => setDays(Math.max(1, daysV - 1))}
        onIncrement={() => setDays(Math.min(7, daysV + 1))}
      />
      {label("Anything to work around? (optional)")}
      <LuxeInput
        placeholder="e.g. sore knees, no overhead pressing"
        value={limV}
        onChangeText={setLimitations}
        multiline
        maxLength={500}
        style={{ minHeight: 70, textAlignVertical: "top" }}
      />
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
        For injuries or medical concerns, please check with Dr. Copley before training.
      </Text>
      <LuxeButton
        label={save.isPending ? "Saving…" : "Save preferences"}
        onPress={onSave}
        disabled={save.isPending}
      />
    </View>
  );
}

function SuggestionHint({ exerciseId }: { exerciseId: number }) {
  const c = useColors();
  const { data } = useGetExerciseSuggestion(exerciseId);
  if (!data) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
      <Feather name="zap" size={12} color={c.accent} style={{ marginTop: 2 }} />
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 12,
          color: c.mutedForeground,
          flex: 1,
        }}
      >
        {data.basis}
      </Text>
    </View>
  );
}

function ExerciseBlock({
  we,
  workoutId,
  completed,
}: {
  we: WorkoutExercise;
  workoutId: number;
  completed: boolean;
}) {
  const c = useColors();
  const queryClient = useQueryClient();
  const logSet = useLogWorkoutSet();
  const deleteSet = useDeleteWorkoutSet();
  const removeExercise = useRemoveWorkoutExercise();
  const [reps, setReps] = useState(we.targetReps != null ? String(we.targetReps) : "10");
  const [weight, setWeight] = useState(we.targetWeightLbs != null ? String(we.targetWeightLbs) : "");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(workoutId) });
    void queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
  };

  const onLogSet = () => {
    const repsN = Number(reps);
    if (!Number.isFinite(repsN) || repsN < 1) {
      Alert.alert("Reps needed", "Enter how many reps you did.");
      return;
    }
    const weightN = weight.trim() === "" ? null : Number(weight);
    if (weightN != null && (!Number.isFinite(weightN) || weightN < 0)) {
      Alert.alert("Check the weight", "Weight must be a positive number.");
      return;
    }
    logSet.mutate(
      { id: we.id, data: { reps: Math.round(repsN), weightLbs: weightN } },
      {
        onSuccess: refresh,
        onError: () => Alert.alert("Couldn't log that set", "Please try again."),
      },
    );
  };

  const target =
    we.targetSets != null && we.targetReps != null
      ? `Target: ${we.targetSets} × ${we.targetReps}${we.targetWeightLbs != null ? ` @ ${we.targetWeightLbs} lbs` : ""}`
      : null;

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
            {we.exercise.name}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: c.mutedForeground,
              marginTop: 2,
            }}
          >
            {muscleLabel(we.exercise.primaryMuscle)} ·{" "}
            {EQUIPMENT_LABELS[we.exercise.equipment] ?? we.exercise.equipment}
            {target ? ` · ${target}` : ""}
          </Text>
        </View>
        {!completed ? (
          <Pressable
            hitSlop={8}
            onPress={() =>
              removeExercise.mutate(
                { id: we.id },
                {
                  onSuccess: refresh,
                  onError: () => Alert.alert("Couldn't remove", "Please try again."),
                },
              )
            }
          >
            <Feather name="trash-2" size={16} color={c.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {!completed ? <SuggestionHint exerciseId={we.exerciseId} /> : null}

      <Pressable
        onPress={() => openHowToVideo(we.exercise.name)}
        hitSlop={6}
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Feather name="play-circle" size={13} color={c.accent} />
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.accent }}>
          Watch how-to
        </Text>
      </Pressable>

      {we.sets.length > 0 ? (
        <View style={{ gap: 6 }}>
          {we.sets.map((s) => (
            <View
              key={s.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: c.secondary,
                borderRadius: 10,
                paddingVertical: 7,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
                Set {s.setNumber}: {s.reps} reps
                {s.weightLbs != null ? ` @ ${s.weightLbs} lbs` : ""}
              </Text>
              {!completed ? (
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    deleteSet.mutate(
                      { id: s.id },
                      {
                        onSuccess: refresh,
                        onError: () => Alert.alert("Couldn't delete", "Please try again."),
                      },
                    )
                  }
                >
                  <Feather name="x" size={14} color={c.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {!completed ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={{ width: 76 }}>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 11,
                color: c.mutedForeground,
                marginBottom: 4,
              }}
            >
              Reps
            </Text>
            <LuxeInput value={reps} onChangeText={setReps} keyboardType="number-pad" />
          </View>
          <View style={{ width: 96 }}>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 11,
                color: c.mutedForeground,
                marginBottom: 4,
              }}
            >
              Weight (lbs)
            </Text>
            <LuxeInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="—"
            />
          </View>
          <View style={{ flex: 1 }}>
            <LuxeButton
              label="Log set"
              small
              variant="outline"
              icon="plus"
              disabled={logSet.isPending}
              onPress={onLogSet}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function WorkoutDetail({ workoutId, onBack }: { workoutId: number; onBack: () => void }) {
  const c = useColors();
  const queryClient = useQueryClient();
  const query = useGetWorkout(workoutId);
  const complete = useCompleteWorkout();
  const deleteWorkout = useDeleteWorkout();
  const addExercise = useAddWorkoutExercise();
  const [addOpen, setAddOpen] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(workoutId) });
    void queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetMuscleRecoveryQueryKey() });
  };

  if (query.isLoading) return <LoadingView />;
  const workout = query.data;
  if (!workout)
    return <ErrorView message="Couldn't load this workout." onRetry={() => void query.refetch()} />;

  const completed = workout.status === "completed";
  const loggedSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);

  const onDelete = () => {
    Alert.alert("Delete workout?", "This removes the workout and all logged sets.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteWorkout.mutate(
            { id: workoutId },
            {
              onSuccess: () => {
                void queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
                void queryClient.invalidateQueries({ queryKey: getGetMuscleRecoveryQueryKey() });
                onBack();
              },
              onError: () => Alert.alert("Couldn't delete", "Please try again."),
            },
          ),
      },
    ]);
  };

  return (
    <StackScreen refreshing={query.isFetching} onRefresh={() => void query.refetch()}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Pressable onPress={onBack} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 20, color: c.foreground }}
            numberOfLines={2}
          >
            {workout.title}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
            {fmtWorkoutDate(workout.date)}
            {workout.source === "ai" ? " · Luxe AI" : ""}
            {completed ? " · Completed ✓" : ""}
          </Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={10}>
          <Feather name="trash-2" size={18} color={c.mutedForeground} />
        </Pressable>
      </View>

      {workout.aiRationale ? (
        <Card style={{ marginBottom: 12, padding: 12 }}>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              lineHeight: 19,
              color: c.mutedForeground,
            }}
          >
            {workout.aiRationale}
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: 10 }}>
        {workout.exercises.length === 0 ? (
          <EmptyState icon="clipboard" text="No exercises yet — add some below." />
        ) : (
          workout.exercises.map((we) => (
            <ExerciseBlock key={we.id} we={we} workoutId={workoutId} completed={completed} />
          ))
        )}
      </View>

      {!completed ? (
        <View style={{ gap: 10, marginTop: 14 }}>
          <LuxeButton
            label="Add exercise"
            variant="outline"
            icon="plus"
            onPress={() => setAddOpen(true)}
          />
          <LuxeButton
            label={complete.isPending ? "Finishing…" : "Finish workout"}
            icon="check-circle"
            disabled={complete.isPending || loggedSets === 0}
            onPress={() =>
              complete.mutate(
                { id: workoutId },
                {
                  onSuccess: () => {
                    refresh();
                    Alert.alert("Workout complete!", "Nice work — you earned 25 LUXE points.");
                  },
                  onError: () => Alert.alert("Couldn't finish", "Please try again."),
                },
              )
            }
          />
          {loggedSets === 0 ? (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: c.mutedForeground,
                textAlign: "center",
              }}
            >
              Log at least one set to finish your workout.
            </Text>
          ) : null}
        </View>
      ) : null}

      <ModalShell visible={addOpen} title="Add an exercise" onClose={() => setAddOpen(false)}>
        <ExerciseLibraryList
          onPick={(e) =>
            addExercise.mutate(
              { id: workoutId, data: { exerciseId: e.id } },
              {
                onSuccess: () => {
                  refresh();
                  setAddOpen(false);
                },
                onError: () => Alert.alert("Couldn't add", "Please try again."),
              },
            )
          }
        />
      </ModalShell>
    </StackScreen>
  );
}

export default function WorkoutsScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const query = useListWorkouts();
  const createWorkout = useCreateWorkout();
  const generate = useGenerateWorkout();

  const [tab, setTab] = useState("today");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [focusArea, setFocusArea] = useState<string>("full_body");
  const [durationMins, setDurationMins] = useState<number | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [avoidToday, setAvoidToday] = useState("");

  const today = new Date().toLocaleDateString("en-CA");
  const workouts = query.data ?? [];
  const todays = workouts.filter((w) => w.date === today);
  const past = workouts.filter((w) => w.date !== today);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetMuscleRecoveryQueryKey() });
  };

  const runGenerate = () => {
    const input: GenerateWorkoutInput = {
      focusArea: focusArea as GenerateWorkoutInput["focusArea"],
    };
    if (durationMins != null) input.durationMins = durationMins;
    if (energy != null) input.energy = energy as GenerateWorkoutInput["energy"];
    const avoid = avoidToday.trim();
    if (avoid.length > 0) input.avoidToday = avoid.slice(0, 300);
    generate.mutate(
      { data: input },
      {
        onSuccess: (result) => {
          refresh();
          setGenerateOpen(false);
          setSelectedId(result.workout.id);
        },
        onError: (err) => {
          const e = err as { status?: number; data?: { error?: string } };
          if (e.status === 429) {
            Alert.alert(
              "Daily limit reached",
              e.data?.error ?? "You've used today's AI workouts — more unlock tomorrow!",
            );
          } else {
            Alert.alert("Couldn't build your workout", "Please try again in a moment.");
          }
        },
      },
    );
  };

  const runCreate = () => {
    const title = newTitle.trim();
    if (title.length === 0) {
      Alert.alert("Name needed", "Give your workout a name.");
      return;
    }
    createWorkout.mutate(
      { data: { date: today, title } },
      {
        onSuccess: (w) => {
          refresh();
          setCreateOpen(false);
          setNewTitle("");
          setSelectedId(w.id);
        },
        onError: () => Alert.alert("Couldn't create", "Please try again."),
      },
    );
  };

  if (selectedId != null) {
    return <WorkoutDetail workoutId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  if (query.isLoading) return <LoadingView />;
  if (query.isError)
    return <ErrorView message="Couldn't load your workouts." onRetry={() => void query.refetch()} />;

  const renderRow = (w: WorkoutListItem) => (
    <Pressable key={w.id} onPress={() => setSelectedId(w.id)}>
      <Card
        style={{
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}
              numberOfLines={1}
            >
              {w.title}
            </Text>
            {w.source === "ai" ? <Feather name="zap" size={12} color={c.accent} /> : null}
            {w.status === "completed" ? (
              <Feather name="check-circle" size={13} color={c.success} />
            ) : null}
          </View>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: c.mutedForeground,
              marginTop: 2,
            }}
          >
            {fmtWorkoutDate(w.date)} · {w.exerciseCount}{" "}
            {w.exerciseCount === 1 ? "exercise" : "exercises"}
            {w.setCount > 0 ? ` · ${w.setCount} sets` : ""}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={c.mutedForeground} />
      </Card>
    </Pressable>
  );

  return (
    <StackScreen refreshing={query.isFetching} onRefresh={() => void query.refetch()}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: c.mutedForeground,
            flex: 1,
          }}
        >
          Log your training, watch your recovery, and let Luxe AI build your next session.
        </Text>
        <Pressable onPress={() => setPrefsOpen(true)} hitSlop={8}>
          <Feather name="sliders" size={18} color={c.foreground} />
        </Pressable>
      </View>

      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          lineHeight: 16,
          color: c.mutedForeground,
          backgroundColor: c.secondary,
          borderRadius: 10,
          padding: 10,
          marginBottom: 14,
        }}
      >
        Workouts here are general fitness guidance, not medical advice. Stop if anything hurts, and
        check with Dr. Copley before training around an injury or health condition.
      </Text>

      <View style={{ gap: 8, marginBottom: 16 }}>
        <LuxeButton
          label={generate.isPending ? "Building your workout…" : "Build me a workout"}
          icon="zap"
          loading={generate.isPending}
          disabled={generate.isPending}
          onPress={() => setGenerateOpen(true)}
        />
        <LuxeButton
          label="Start from scratch"
          variant="outline"
          icon="plus"
          onPress={() => setCreateOpen(true)}
        />
        {generate.isPending ? (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: c.mutedForeground,
              textAlign: "center",
            }}
          >
            Luxe AI is picking exercises around your recovery — about 30 seconds.
          </Text>
        ) : null}
      </View>

      <Segmented
        options={[
          { key: "today", label: "Workouts" },
          { key: "recovery", label: "Recovery" },
          { key: "library", label: "Library" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "today" ? (
        <View style={{ gap: 10 }}>
          {todays.length === 0 ? (
            <EmptyState icon="clipboard" text="No workout today yet — build one above." />
          ) : (
            todays.map(renderRow)
          )}
          {past.length > 0 ? (
            <>
              <SectionTitle>History</SectionTitle>
              {past.map(renderRow)}
            </>
          ) : null}
        </View>
      ) : tab === "recovery" ? (
        <RecoverySection />
      ) : (
        <ExerciseLibraryList />
      )}

      <ModalShell
        visible={generateOpen}
        title="Build me a workout"
        onClose={() => setGenerateOpen(false)}
      >
        <View style={{ gap: 16 }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            A few quick questions so Luxe AI can tailor today's session. Everything's optional.
          </Text>

          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
            What do you want to focus on?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FOCUS_AREA_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                label={o.label}
                active={focusArea === o.key}
                onPress={() => setFocusArea(o.key)}
              />
            ))}
          </View>

          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
            How much time do you have?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {DURATION_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                label={o.label}
                active={durationMins === o.key}
                onPress={() => setDurationMins(durationMins === o.key ? null : o.key)}
              />
            ))}
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
            Leave unselected to use your saved session length.
          </Text>

          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
            How's your energy today?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ENERGY_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                label={o.label}
                active={energy === o.key}
                onPress={() => setEnergy(energy === o.key ? null : o.key)}
              />
            ))}
          </View>

          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
            Anything to work around today? (optional)
          </Text>
          <LuxeInput
            placeholder="e.g. sore knees, tight on time"
            value={avoidToday}
            onChangeText={setAvoidToday}
            multiline
            maxLength={300}
            style={{ minHeight: 60, textAlignVertical: "top" }}
          />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
            For injuries or medical concerns, please check with Dr. Copley before training.
          </Text>

          <LuxeButton
            label={generate.isPending ? "Building your workout…" : "Build my workout"}
            icon="zap"
            loading={generate.isPending}
            disabled={generate.isPending}
            onPress={runGenerate}
          />
        </View>
      </ModalShell>

      <ModalShell
        visible={createOpen}
        title="New workout"
        onClose={() => {
          setCreateOpen(false);
          setNewTitle("");
        }}
      >
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            Name today's session — you'll add exercises next.
          </Text>
          <LuxeInput
            placeholder="e.g. Upper body day"
            value={newTitle}
            onChangeText={setNewTitle}
            maxLength={120}
          />
          <LuxeButton
            label={createWorkout.isPending ? "Creating…" : "Create workout"}
            disabled={createWorkout.isPending}
            onPress={runCreate}
          />
        </View>
      </ModalShell>

      <ModalShell
        visible={prefsOpen}
        title="Workout preferences"
        onClose={() => setPrefsOpen(false)}
      >
        <PreferencesForm onSaved={() => setPrefsOpen(false)} />
      </ModalShell>
    </StackScreen>
  );
}
