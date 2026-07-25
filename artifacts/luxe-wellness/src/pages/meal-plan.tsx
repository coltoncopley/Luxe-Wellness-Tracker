import { useEffect, useRef, useState } from "react";
import {
  useGetMealPlan,
  useGenerateMealPlan,
  useGetMealPlanPreferences,
  useUpdateMealPlanPreferences,
  useSuggestMeal,
  useApplyMeal,
  useSetMealPlanPeople,
  useCheckShoppingListItem,
  useEmailShoppingList,
  useGetMealRecipe,
  useSetMealShop,
  useCreateShoppingLink,
  useGetKrogerStatus,
  useAddToKrogerCart,
  getKrogerConnectUrl,
  getGetMealPlanQueryKey,
  getGetMealPlanPreferencesQueryKey,
  getGetKrogerStatusQueryKey,
  type MealPlan,
  type MealPlanResult,
  type MealPlanMeal,
  type MealRecipeResult,
  type ShoppingListItem,
  type MealPlanPreferences,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarRange,
  ShoppingBasket,
  Sparkles,
  RefreshCw,
  Lightbulb,
  ChefHat,
  Shuffle,
  Users,
  Minus,
  Plus,
  Mail,
  Share2,
  X,
  SlidersHorizontal,
  Check,
  BookOpen,
  Clock,
  ShoppingCart,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type MealKey = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_LABELS: { key: MealKey; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Breakfast", emoji: "🌅" },
  { key: "lunch", label: "Lunch", emoji: "☀️" },
  { key: "dinner", label: "Dinner", emoji: "🌙" },
  { key: "snack", label: "Snack", emoji: "🍎" },
];

function fmtDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function fmtShort(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function displayLine(item: ShoppingListItem): string {
  return item.displayQuantity ? `${item.displayQuantity} ${item.name}` : item.name;
}

function shoppingListText(plan: MealPlan): string {
  const header = `LUXE shopping list — week of ${fmtShort(plan.weekStart)}–${fmtShort(plan.weekEnd)}\nServes ${plan.people}\n`;
  if (plan.shoppingList.length > 0) {
    const body = plan.shoppingList
      .map(
        (c) =>
          `\n${c.category.toUpperCase()}\n` + c.items.map((i) => `- ${displayLine(i)}`).join("\n"),
      )
      .join("\n");
    return header + body;
  }
  const body = plan.grocery
    .map((c) => `\n${c.category.toUpperCase()}\n` + c.items.map((i) => `- ${i}`).join("\n"))
    .join("\n");
  return header + body;
}

/* ---------------- Chip input ---------------- */

function ChipInput({
  label,
  placeholder,
  values,
  onChange,
  testid,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  testid: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v.length === 0) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...values, v].slice(0, 40));
    }
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          data-testid={`input-${testid}`}
        />
        <Button type="button" variant="outline" onClick={add} data-testid={`button-add-${testid}`}>
          Add
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Preferences dialog ---------------- */

function PreferencesDialog({
  open,
  onOpenChange,
  prefs,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefs: MealPlanPreferences;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateMealPlanPreferences();
  const [allergies, setAllergies] = useState<string[]>(prefs.allergies);
  const [dislikes, setDislikes] = useState<string[]>(prefs.dislikes);
  const [dietStyle, setDietStyle] = useState(prefs.dietStyle ?? "");

  useEffect(() => {
    if (open) {
      setAllergies(prefs.allergies);
      setDislikes(prefs.dislikes);
      setDietStyle(prefs.dietStyle ?? "");
    }
  }, [open, prefs.allergies, prefs.dislikes, prefs.dietStyle]);

  const save = () => {
    update.mutate(
      {
        data: {
          allergies,
          dislikes,
          dietStyle: dietStyle.trim() ? dietStyle.trim() : null,
          householdSize: prefs.householdSize,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMealPlanPreferencesQueryKey() });
          toast.success("Preferences saved — they'll shape your next plan.");
          onOpenChange(false);
        },
        onError: () => toast.error("Couldn't save your preferences. Please try again."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Meal preferences</DialogTitle>
          <DialogDescription>
            Luxe AI uses these to tailor your plan. Everything here is private to you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-1">
          <ChipInput
            label="Allergies (always avoided)"
            placeholder="e.g. peanuts"
            values={allergies}
            onChange={setAllergies}
            testid="allergy"
          />
          <ChipInput
            label="Foods you dislike"
            placeholder="e.g. mushrooms"
            values={dislikes}
            onChange={setDislikes}
            testid="dislike"
          />
          <div className="space-y-2">
            <Label className="text-sm" htmlFor="diet-style">
              Diet style (optional)
            </Label>
            <Input
              id="diet-style"
              value={dietStyle}
              placeholder="e.g. vegetarian, Mediterranean, low-carb"
              onChange={(e) => setDietStyle(e.target.value)}
              data-testid="input-diet-style"
            />
          </div>
          {prefs.avoidDishes.length > 0 && (
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Learned from your swaps — dishes we won't repeat:
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                {prefs.avoidDishes.slice(0, 8).join(", ")}
                {prefs.avoidDishes.length > 8 ? "…" : ""}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            className="rounded-full"
            onClick={save}
            disabled={update.isPending}
            data-testid="button-save-preferences"
          >
            {update.isPending ? "Saving…" : "Save preferences"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Swap dialog ---------------- */

function SwapDialog({
  slot,
  onClose,
  onApplied,
}: {
  slot: { date: string; mealType: MealKey; name: string } | null;
  onClose: () => void;
  onApplied: (result: MealPlanResult) => void;
}) {
  const queryClient = useQueryClient();
  const suggest = useSuggestMeal();
  const apply = useApplyMeal();
  const [choice, setChoice] = useState<number | null>(null);
  const requestedRef = useRef<string | null>(null);

  const runSuggest = (date: string, mealType: MealKey) => {
    setChoice(null);
    suggest.reset();
    suggest.mutate(
      { data: { date, mealType } },
      {
        onError: (err) => {
          const e = err as { status?: number; data?: { error?: string } };
          if (e.status === 429) {
            toast.error(e.data?.error ?? "You've used today's swap ideas. Try again tomorrow!");
            onClose();
          }
        },
      },
    );
  };

  // Fire one suggestion request per opened slot (guarded against StrictMode double-run).
  useEffect(() => {
    if (!slot) {
      requestedRef.current = null;
      return;
    }
    const key = `${slot.date}:${slot.mealType}`;
    if (requestedRef.current === key) return;
    requestedRef.current = key;
    runSuggest(slot.date, slot.mealType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot?.date, slot?.mealType]);

  const options: MealPlanMeal[] = suggest.data?.options ?? [];

  const doApply = () => {
    if (!slot || choice == null) return;
    apply.mutate(
      { data: { date: slot.date, mealType: slot.mealType, choiceIndex: choice } },
      {
        onSuccess: (result) => {
          onApplied(result);
          // A confirmed swap teaches avoidDishes server-side; refresh the
          // "won't repeat" list shown in Preferences.
          void queryClient.invalidateQueries({
            queryKey: getGetMealPlanPreferencesQueryKey(),
          });
          toast.success("Meal swapped!");
          onClose();
        },
        onError: (err) => {
          const e = err as { status?: number };
          toast.error(
            e.status === 409
              ? "Those ideas expired — try swapping again."
              : "Couldn't swap that meal. Please try again.",
          );
        },
      },
    );
  };

  return (
    <Dialog open={slot != null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Swap this meal</DialogTitle>
          <DialogDescription>
            {slot ? (
              <>
                Replacing <span className="font-medium">{slot.name}</span>. Pick a fresh idea below.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {suggest.isPending && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Finding three fresh ideas…</p>
            </div>
          )}

          {suggest.isError && !suggest.isPending && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn't fetch ideas just now.
              </p>
              <Button
                variant="outline"
                className="mt-3 rounded-full"
                onClick={() => slot && runSuggest(slot.date, slot.mealType)}
                data-testid="button-retry-suggest"
              >
                Try again
              </Button>
            </div>
          )}

          {!suggest.isPending &&
            options.map((opt, i) => {
              const selected = choice === i;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setChoice(i)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                  data-testid={`option-swap-${i}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{opt.name}</p>
                    <span className="flex items-center gap-2">
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {opt.calories} cal
                      </span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
                </button>
              );
            })}
        </div>

        {!suggest.isPending && options.length > 0 && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => slot && runSuggest(slot.date, slot.mealType)}
              disabled={apply.isPending}
              data-testid="button-more-ideas"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              More ideas
            </Button>
            <Button
              className="rounded-full"
              onClick={doApply}
              disabled={choice == null || apply.isPending}
              data-testid="button-apply-swap"
            >
              {apply.isPending ? "Swapping…" : "Use this meal"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Recipe dialog ---------------- */

type RecipeSlot = {
  date: string;
  mealType: MealKey;
  name: string;
  description: string;
};

function RecipeDialog({ slot, onClose }: { slot: RecipeSlot | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const recipe = useGetMealRecipe();
  const requestedRef = useRef<string | null>(null);

  const run = (date: string, mealType: MealKey) => {
    recipe.reset();
    recipe.mutate(
      { data: { date, mealType } },
      {
        onSuccess: () => {
          // Recipe (and any backfilled ingredient amounts) is now cached in
          // the plan — refresh so reopening is instant and the list updates.
          void queryClient.invalidateQueries({ queryKey: getGetMealPlanQueryKey() });
        },
      },
    );
  };

  useEffect(() => {
    if (!slot) {
      requestedRef.current = null;
      return;
    }
    const key = `${slot.date}:${slot.mealType}`;
    if (requestedRef.current === key) return;
    requestedRef.current = key;
    run(slot.date, slot.mealType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot?.date, slot?.mealType]);

  const data: MealRecipeResult | null = recipe.data ?? null;

  return (
    <Dialog open={slot != null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{data?.mealName ?? slot?.name}</DialogTitle>
          <DialogDescription>{data?.description ?? slot?.description}</DialogDescription>
        </DialogHeader>

        {recipe.isPending && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <ChefHat className="h-6 w-6 animate-bounce text-primary" />
            <p className="text-sm text-muted-foreground">Writing your step-by-step recipe…</p>
            <p className="text-xs text-muted-foreground/80">
              First time takes a moment — after that it opens instantly.
            </p>
          </div>
        )}

        {recipe.isError && !recipe.isPending && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Couldn't write the recipe just now.</p>
            <Button
              variant="outline"
              className="mt-3 rounded-full"
              onClick={() => slot && run(slot.date, slot.mealType)}
              data-testid="button-retry-recipe"
            >
              Try again
            </Button>
          </div>
        )}

        {data && !recipe.isPending && (
          <div className="space-y-5" data-testid="recipe-content">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-secondary px-2.5 py-1">
                {data.calories} cal / serving
              </span>
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
                <Users className="h-3 w-3" /> serves {data.people}
              </span>
              {data.recipe.prepMinutes != null && (
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
                  <Clock className="h-3 w-3" /> prep {data.recipe.prepMinutes} min
                </span>
              )}
              {data.recipe.cookMinutes != null && (
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
                  <Clock className="h-3 w-3" /> cook {data.recipe.cookMinutes} min
                </span>
              )}
            </div>

            {data.ingredientLines.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ingredients · serves {data.people}
                </p>
                <ul className="space-y-1">
                  {data.ingredientLines.map((line, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Steps
              </p>
              <ol className="space-y-3">
                {data.recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {data.recipe.tip && (
              <div className="flex items-start gap-2.5 rounded-lg bg-secondary/50 p-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">{data.recipe.tip}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Shopping list ---------------- */

function ShoppingList({ plan }: { plan: MealPlan }) {
  const check = useCheckShoppingListItem();
  const email = useEmailShoppingList();
  const queryClient = useQueryClient();
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>({});
  const [shopOpen, setShopOpen] = useState(false);

  // Returning from Kroger's sign-in page (?kroger=connected|error): strip the
  // param, confirm, refresh connection status, and reopen the shop dialog.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kroger = params.get("kroger");
    if (!kroger) return;
    params.delete("kroger");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    if (kroger === "connected") {
      toast.success("Kroger account connected!");
      void queryClient.invalidateQueries({ queryKey: getGetKrogerStatusQueryKey() });
      setShopOpen(true);
    } else {
      toast.error("Kroger connection didn't go through. Please try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset local check overrides whenever a new plan is generated.
  useEffect(() => {
    setLocalChecks({});
  }, [plan.generatedAt]);

  const isChecked = (item: ShoppingListItem) =>
    localChecks[item.itemKey] ?? item.checked;

  const toggle = (item: ShoppingListItem) => {
    const next = !isChecked(item);
    setLocalChecks((m) => ({ ...m, [item.itemKey]: next }));
    check.mutate(
      { data: { itemKey: item.itemKey, checked: next } },
      {
        onError: () => {
          setLocalChecks((m) => ({ ...m, [item.itemKey]: !next }));
          toast.error("Couldn't save that. Please try again.");
        },
      },
    );
  };

  const sendEmail = () => {
    email.mutate(undefined, {
      onSuccess: () => toast.success("Shopping list sent to your email!"),
      onError: (err) => {
        const e = err as { status?: number; data?: { error?: string } };
        toast.error(e.data?.error ?? "Couldn't send the email right now.");
      },
    });
  };

  const share = async () => {
    const text = shoppingListText(plan);
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string }) => Promise<void>;
    };
    try {
      if (typeof nav.share === "function") {
        await nav.share({ title: "LUXE shopping list", text });
        return;
      }
    } catch {
      // user cancelled or share unavailable — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Shopping list copied — paste it into any message.");
    } catch {
      toast.error("Couldn't share the list on this device.");
    }
  };

  const hasScaled = plan.shoppingList.length > 0;

  return (
    <>
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-sans font-medium text-primary flex items-center gap-2">
            <ShoppingBasket className="h-4 w-4" />
            Shopping list {hasScaled ? `· serves ${plan.people}` : ""}
          </CardTitle>
          <div className="flex gap-2">
            {hasScaled && (
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => setShopOpen(true)}
                data-testid="button-shop-list"
              >
                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                Shop
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={share}
              data-testid="button-share-list"
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Share
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={sendEmail}
              disabled={email.isPending}
              data-testid="button-email-list"
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              {email.isPending ? "Sending…" : "Email"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        {hasScaled
          ? plan.shoppingList.map((cat) => (
              <div key={cat.category}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {cat.category}
                </p>
                <ul className="space-y-1.5">
                  {cat.items.map((item) => {
                    const checked = isChecked(item);
                    return (
                      <li key={item.itemKey} className="flex items-center gap-2.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(item)}
                          data-testid={`check-${item.itemKey}`}
                        />
                        <span
                          className={`text-sm ${checked ? "text-muted-foreground line-through" : ""}`}
                        >
                          {displayLine(item)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          : plan.grocery.map((cat) => (
              <div key={cat.category}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {cat.category}
                </p>
                <ul className="space-y-0.5">
                  {cat.items.map((item, i) => (
                    <li key={i} className="text-sm">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
      </CardContent>
    </Card>
    <ShopDialog plan={plan} checkedOverrides={localChecks} open={shopOpen} onClose={() => setShopOpen(false)} />
    </>
  );
}

/* ---------------- Shop handoff dialog ---------------- */

function ShopDialog({
  plan,
  checkedOverrides,
  open,
  onClose,
}: {
  plan: MealPlan;
  /** In-session check toggles not yet reflected in the plan snapshot. */
  checkedOverrides: Record<string, boolean>;
  open: boolean;
  onClose: () => void;
}) {
  const link = useCreateShoppingLink();
  const queryClient = useQueryClient();
  const kroger = useGetKrogerStatus({
    query: { queryKey: getGetKrogerStatusQueryKey(), enabled: open },
  });
  const krogerCart = useAddToKrogerCart();
  const [connecting, setConnecting] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Each time the dialog opens, preselect what's still needed (unchecked items),
  // honoring checkbox changes made this session over the server snapshot.
  useEffect(() => {
    if (!open) return;
    const init: Record<string, boolean> = {};
    for (const cat of plan.shoppingList)
      for (const it of cat.items) init[it.itemKey] = !(checkedOverrides[it.itemKey] ?? it.checked);
    setSelected(init);
    link.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan.generatedAt]);

  const allItems = plan.shoppingList.flatMap((c) => c.items);
  const selectedItems = allItems.filter((i) => selected[i.itemKey]);

  const openInstacart = () => {
    // Open the tab inside the click gesture so popup blockers allow it,
    // then point it at the Instacart list once the link is ready.
    const popup = window.open("", "_blank");
    if (popup) popup.opener = null;
    link.mutate(
      {
        data: {
          items: selectedItems.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
        },
      },
      {
        onSuccess: (result) => {
          if (popup) popup.location.href = result.url;
          else window.open(result.url, "_blank", "noopener");
        },
        onError: (err) => {
          popup?.close();
          const e = err as { status?: number; data?: { error?: string } };
          toast.error(e.data?.error ?? "Couldn't create your Instacart list. Please try again.");
        },
      },
    );
  };

  const copySelected = async () => {
    const text = selectedItems.map((i) => `- ${displayLine(i)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("List copied — paste it into Walmart's app, notes, or a text.");
    } catch {
      toast.error("Couldn't copy on this device.");
    }
  };

  const connectKroger = async () => {
    // Full-page redirect: Kroger's sign-in page disallows iframes, and the
    // callback brings the member straight back to /meal-plan?kroger=connected.
    setConnecting(true);
    try {
      const { url } = await getKrogerConnectUrl({ platform: "web" });
      window.location.assign(url);
    } catch {
      setConnecting(false);
      toast.error("Couldn't start Kroger sign-in. Please try again.");
    }
  };

  const sendKroger = () => {
    // Open the tab inside the click gesture so popup blockers allow it,
    // then point it at the Kroger cart once the items are in.
    const popup = window.open("", "_blank");
    if (popup) popup.opener = null;
    const items = selectedItems.slice(0, 60).map((i) => ({ name: i.name }));
    krogerCart.mutate(
      { data: { items } },
      {
        onSuccess: (result) => {
          if (popup) popup.location.href = result.cartUrl;
          else window.open(result.cartUrl, "_blank", "noopener");
          const capped = selectedItems.length > 60 ? " (Kroger takes 60 items at a time.)" : "";
          if (result.missed.length === 0) {
            toast.success(`All ${result.added.length} items added to your Kroger cart.${capped}`);
          } else {
            const preview = result.missed.slice(0, 3).join(", ");
            toast.info(
              `${result.added.length} added to your Kroger cart. Not found: ${preview}${result.missed.length > 3 ? "…" : ""}${capped}`,
            );
          }
        },
        onError: (err) => {
          popup?.close();
          const e = err as { status?: number; data?: { error?: string } };
          if (e.status === 409) {
            void queryClient.invalidateQueries({ queryKey: getGetKrogerStatusQueryKey() });
            toast.error(e.data?.error ?? "Please reconnect your Kroger account.");
          } else {
            toast.error(e.data?.error ?? "Couldn't send to Kroger. Please try again.");
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Shop your list</DialogTitle>
          <DialogDescription>
            {plan.instacartEnabled
              ? "Untick anything you already have, then send the rest to Instacart or Kroger — or tap an item's arrow to find it at Walmart."
              : "Untick anything you already have, then send the rest to your store — or tap an item's arrow to find it at Walmart."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {plan.shoppingList.map((cat) => (
            <div key={cat.category}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {cat.category}
              </p>
              <ul className="space-y-1.5">
                {cat.items.map((item) => (
                  <li key={item.itemKey} className="flex items-center gap-2.5">
                    <Checkbox
                      checked={selected[item.itemKey] ?? false}
                      onCheckedChange={(v) =>
                        setSelected((m) => ({ ...m, [item.itemKey]: v === true }))
                      }
                      data-testid={`shop-item-${item.itemKey}`}
                    />
                    <span
                      className={`flex-1 text-sm ${selected[item.itemKey] ? "" : "text-muted-foreground"}`}
                    >
                      {displayLine(item)}
                    </span>
                    <a
                      href={`https://www.walmart.com/search?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                      aria-label={`Find ${item.name} at Walmart`}
                      title="Find at Walmart"
                      data-testid={`link-walmart-${item.itemKey}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground" data-testid="text-shop-selected-count">
          {selectedItems.length} of {allItems.length} items selected
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={copySelected}
            disabled={selectedItems.length === 0}
            data-testid="button-copy-shop-list"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy list
          </Button>
          {kroger.data?.enabled &&
            (kroger.data.connected ? (
              <Button
                className="rounded-full"
                onClick={sendKroger}
                disabled={selectedItems.length === 0 || krogerCart.isPending}
                data-testid="button-send-kroger"
              >
                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                {krogerCart.isPending ? "Sending…" : "Send to Kroger"}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={connectKroger}
                disabled={connecting}
                data-testid="button-connect-kroger"
              >
                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                {connecting ? "Opening…" : "Connect Kroger"}
              </Button>
            ))}
          {plan.instacartEnabled && (
            <Button
              className="rounded-full"
              onClick={openInstacart}
              disabled={selectedItems.length === 0 || link.isPending}
              data-testid="button-open-instacart"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              {link.isPending ? "Preparing…" : "Open in Instacart"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- People scaler ---------------- */

function PeopleScaler({ plan }: { plan: MealPlan }) {
  const queryClient = useQueryClient();
  const setPeople = useSetMealPlanPeople();
  const [pending, setPending] = useState<number | null>(null);
  const people = pending ?? plan.people;

  const change = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), 20);
    if (clamped === plan.people) return;
    setPending(clamped);
    setPeople.mutate(
      { data: { people: clamped } },
      {
        onSuccess: (result) => {
          queryClient.setQueryData(getGetMealPlanQueryKey(), result);
          setPending(null);
        },
        onError: () => {
          setPending(null);
          toast.error("Couldn't update servings. Please try again.");
        },
      },
    );
  };

  return (
    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Serves</span>
      <button
        type="button"
        onClick={() => change(people - 1)}
        disabled={setPeople.isPending || people <= 1}
        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        aria-label="Fewer people"
        data-testid="button-people-minus"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-5 text-center text-sm font-medium" data-testid="text-people-count">
        {people}
      </span>
      <button
        type="button"
        onClick={() => change(people + 1)}
        disabled={setPeople.isPending || people >= 20}
        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        aria-label="More people"
        data-testid="button-people-plus"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function MealPlan() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMealPlan({
    query: { queryKey: getGetMealPlanQueryKey() },
  });
  const { data: prefs } = useGetMealPlanPreferences({
    query: { queryKey: getGetMealPlanPreferencesQueryKey() },
  });
  const generate = useGenerateMealPlan();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [swapSlot, setSwapSlot] = useState<{
    date: string;
    mealType: MealKey;
    name: string;
  } | null>(null);
  const [recipeSlot, setRecipeSlot] = useState<RecipeSlot | null>(null);

  const plan = data?.plan ?? null;
  const remaining = data?.generationsRemaining ?? 0;
  const suggestsRemaining = data?.suggestsRemaining ?? 0;
  const today = new Date().toLocaleDateString("en-CA");

  const runGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetMealPlanQueryKey() });
        toast.success("Your meal plan is ready!");
      },
      onError: (err) => {
        const e = err as { status?: number; data?: { error?: string } };
        if (e.status === 429) {
          toast.error(
            e.data?.error ?? "You've used this week's generations — a fresh plan unlocks Monday!",
          );
        } else {
          toast.error("Couldn't create your plan just now. Please try again in a moment.");
        }
      },
    });
  };

  const applyResult = (result: MealPlanResult) => {
    queryClient.setQueryData(getGetMealPlanQueryKey(), result);
  };

  const canSwap = suggestsRemaining > 0;

  const setShop = useSetMealShop();
  const excludedKeys = new Set((plan?.excludedMeals ?? []).map((e) => `${e.date}:${e.mealType}`));
  const toggleShop = (date: string, mealType: MealKey) => {
    setShop.mutate(
      { data: { date, mealType, shop: excludedKeys.has(`${date}:${mealType}`) } },
      {
        onSuccess: (result) => queryClient.setQueryData(getGetMealPlanQueryKey(), result),
        onError: () => toast.error("Couldn't update that. Please try again."),
      },
    );
  };

  return (
    <div className="space-y-8 pb-12 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
            <CalendarRange className="h-8 w-8" />
            Meal Plan
          </h1>
          <p className="text-muted-foreground text-lg">
            A simple week of meals, tailored to your goals and the foods you already love.
          </p>
        </div>
        {prefs && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full shrink-0"
            onClick={() => setPrefsOpen(true)}
            data-testid="button-open-preferences"
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Preferences
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Loading your plan...
          </CardContent>
        </Card>
      ) : !plan ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-4">
            <ChefHat className="h-10 w-10 text-primary mx-auto" />
            <p className="font-serif text-xl">No plan for this week yet</p>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Luxe AI will build a 7-day plan around your calorie target, preferences, and recent
              food logs — plus a shopping list you can check off, scale, and send to yourself. It
              takes about a minute.
            </p>
            <Button
              className="rounded-full"
              disabled={generate.isPending || remaining <= 0}
              onClick={runGenerate}
              data-testid="button-generate-plan"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {generate.isPending ? "Building your week…" : "Create my meal plan"}
            </Button>
            {generate.isPending && (
              <p className="text-xs text-muted-foreground">
                This can take up to a minute — hang tight!
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 -mt-4">
            <p className="text-sm text-muted-foreground">
              Week of {fmtShort(plan.weekStart)} – {fmtShort(plan.weekEnd)}
            </p>
            <div className="flex items-center gap-2">
              <PeopleScaler plan={plan} />
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={generate.isPending || remaining <= 0}
                onClick={runGenerate}
                data-testid="button-regenerate-plan"
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 ${generate.isPending ? "animate-spin" : ""}`}
                />
                {generate.isPending
                  ? "Rebuilding…"
                  : remaining > 0
                    ? `Regenerate (${remaining} left)`
                    : "New plan Monday"}
              </Button>
            </div>
          </div>

          {plan.notes && (
            <Card className="bg-secondary/50 border-none shadow-none">
              <CardContent className="p-5 flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-muted-foreground text-sm leading-relaxed">{plan.notes}</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {plan.days.map((day) => {
              const isToday = day.date === today;
              const expanded = openDay ? openDay === day.date : isToday;
              const total = MEAL_LABELS.reduce((s, m) => s + day[m.key].calories, 0);
              return (
                <Card
                  key={day.date}
                  className={isToday ? "border-primary/40 shadow-sm" : "shadow-sm border-border"}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setOpenDay(expanded ? "" : day.date)}
                  >
                    <CardHeader className="py-4">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base font-serif flex items-center gap-2">
                          {fmtDay(day.date)}
                          {isToday && (
                            <Badge className="text-[10px] uppercase tracking-wide">Today</Badge>
                          )}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">~{total} cal</span>
                      </div>
                    </CardHeader>
                  </button>
                  {expanded && (
                    <CardContent className="pt-0 space-y-3">
                      {MEAL_LABELS.map((m) => {
                        const meal = day[m.key];
                        const mealExcluded = excludedKeys.has(`${day.date}:${m.key}`);
                        return (
                          <div key={m.key} className="flex items-start gap-3 group">
                            <span aria-hidden className="text-lg leading-6">
                              {m.emoji}
                            </span>
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() =>
                                setRecipeSlot({
                                  date: day.date,
                                  mealType: m.key,
                                  name: meal.name,
                                  description: meal.description,
                                })
                              }
                              data-testid={`button-recipe-${day.date}-${m.key}`}
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-medium">{meal.name}</p>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {meal.calories} cal
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{meal.description}</p>
                              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary/70 transition-colors group-hover:text-primary">
                                <BookOpen className="h-3 w-3" /> Recipe
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                canSwap &&
                                setSwapSlot({ date: day.date, mealType: m.key, name: meal.name })
                              }
                              disabled={!canSwap}
                              title={canSwap ? "Swap this meal" : "No swaps left today"}
                              className="shrink-0 text-muted-foreground hover:text-primary disabled:opacity-30"
                              data-testid={`button-swap-${day.date}-${m.key}`}
                            >
                              <Shuffle className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleShop(day.date, m.key)}
                              title={
                                mealExcluded
                                  ? "Left out of your shopping list — tap to include"
                                  : "In your shopping list — tap to leave out"
                              }
                              className={`shrink-0 transition-colors ${
                                mealExcluded
                                  ? "text-muted-foreground/40 hover:text-muted-foreground"
                                  : "text-primary/70 hover:text-primary"
                              }`}
                              data-testid={`toggle-shop-${day.date}-${m.key}`}
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground -mt-1">
            {canSwap
              ? `Tap any meal for its step-by-step recipe. The shuffle icon swaps it — ${suggestsRemaining} swap${suggestsRemaining === 1 ? "" : "s"} left today. The cart icon leaves a meal out of your shopping list.`
              : "Tap any meal for its step-by-step recipe. You've used today's swaps — they refresh tomorrow. The cart icon leaves a meal out of your shopping list."}
          </p>

          <ShoppingList plan={plan} />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Your meal plan is private to you — it is never shared with LUXE staff. This is general
        wellness guidance, not medical or dietetic advice. Check with your doctor about any dietary
        needs or restrictions.
      </p>

      {prefs && (
        <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} prefs={prefs} />
      )}
      <SwapDialog slot={swapSlot} onClose={() => setSwapSlot(null)} onApplied={applyResult} />
      <RecipeDialog slot={recipeSlot} onClose={() => setRecipeSlot(null)} />
    </div>
  );
}
