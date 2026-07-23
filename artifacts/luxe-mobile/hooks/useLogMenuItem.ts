import { useQueryClient } from "@tanstack/react-query";

import {
  getGetDailySummaryQueryKey,
  getListFoodLogsQueryKey,
  useCreateFoodLog,
} from "@workspace/api-client-react";

import { Alert } from "@/lib/alert";
import { todayStr } from "@/lib/luxe";

export type LoggableMenuItem = {
  name: string;
  restaurantName?: string | null;
  calories: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  satFatG?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
  cholesterolMg?: number | null;
  servingSize?: string | null;
};

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Shared "log a restaurant menu item to today's food log" mutation for mobile.
 * Server nutrient fields are `.optional()` (not nullable) — coerce nulls to
 * undefined so curated items with missing nutrients don't 400.
 */
export function useLogMenuItem() {
  const createLog = useCreateFoodLog();
  const queryClient = useQueryClient();

  const logMenuItem = (
    item: LoggableMenuItem,
    opts: { mealType: string; date?: string; onSuccess?: () => void },
  ): void => {
    const date = opts.date ?? todayStr();
    createLog.mutate(
      {
        data: {
          date,
          mealType: opts.mealType,
          foodName: item.name,
          restaurantName: item.restaurantName ?? undefined,
          calories: item.calories,
          proteinG: item.proteinG ?? undefined,
          carbsG: item.carbsG ?? undefined,
          fatG: item.fatG ?? undefined,
          satFatG: item.satFatG ?? undefined,
          fiberG: item.fiberG ?? undefined,
          sugarG: item.sugarG ?? undefined,
          sodiumMg: item.sodiumMg ?? undefined,
          cholesterolMg: item.cholesterolMg ?? undefined,
          servingSize: item.servingSize ?? undefined,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date }) });
          void queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey({ date }) });
          opts.onSuccess?.();
        },
        onError: () => {
          Alert.alert("Couldn't log", "Please try again.");
        },
      },
    );
  };

  /** Shows a meal-type chooser, then logs the item and confirms. */
  const promptLog = (item: LoggableMenuItem): void => {
    Alert.alert(`Log ${item.name}`, "Which meal?", [
      ...MEAL_TYPES.map((m) => ({
        text: cap(m),
        onPress: () =>
          logMenuItem(item, {
            mealType: m,
            onSuccess: () => Alert.alert("Logged", `${item.name} added to ${m}.`),
          }),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  return { logMenuItem, promptLog, isPending: createLog.isPending };
}
