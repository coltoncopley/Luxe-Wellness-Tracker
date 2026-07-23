import {
  useCreateFoodLog,
  getListFoodLogsQueryKey,
  getGetDailySummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

/** Time-of-day default so a one-tap log lands in a sensible meal. */
export function defaultMealType(): (typeof MEAL_TYPES)[number] {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

/**
 * Shared "log a restaurant menu item to today's food log" mutation. Server
 * nutrient fields are `.optional()` (not nullable) — coerce nulls to undefined
 * so curated items with missing nutrients don't 400.
 */
export function useLogMenuItem() {
  const createLog = useCreateFoodLog();
  const queryClient = useQueryClient();

  const logMenuItem = (
    item: LoggableMenuItem,
    opts: { date: string; mealType: string; onSuccess?: () => void },
  ): void => {
    createLog.mutate(
      {
        data: {
          date: opts.date,
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
          toast.success(`Logged ${item.name} to ${opts.mealType}`);
          queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date: opts.date }) });
          queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey({ date: opts.date }) });
          opts.onSuccess?.();
        },
        onError: () => {
          toast.error("Couldn't log that item. Please try again.");
        },
      },
    );
  };

  return { logMenuItem, isPending: createLog.isPending };
}
