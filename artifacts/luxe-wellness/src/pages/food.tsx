import { useMemo, useState } from "react";
import { 
  useListFoodLogs, useCreateFoodLog, useDeleteFoodLog, getListFoodLogsQueryKey,
  useGetDailySummary, getGetDailySummaryQueryKey,
  useSearchMenuItems,
  useSearchChainMenuItems,
  getChainMenuItem,
  type FoodLog,
  type ChainMenuSearchResult,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Utensils, Flame, Trash2, Plus, ChevronLeft, ChevronRight, Search, CheckCircle2, ChevronDown, ShieldCheck, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MealScanner } from "@/components/meal-scanner";
import { NutritionFactsLabel } from "@/components/nutrition-facts-label";
import { useLogMenuItem, MEAL_TYPES, defaultMealType, type LoggableMenuItem } from "@/hooks/use-log-menu-item";

function FoodLogRow({ item, onDelete }: { item: FoodLog; onDelete: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const servingLabel =
    item.servings != null && item.servings !== 1
      ? `${Math.round(item.servings * 100) / 100} × ${item.servingSize || "serving"}`
      : item.servingSize || null;
  return (
    <div className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-foreground">{item.foodName}</div>
          {item.restaurantName && <div className="text-xs text-muted-foreground mt-0.5">{item.restaurantName}</div>}
          {(item.servingSize || (item.servings != null && item.servings !== 1)) && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {item.servings != null && item.servings !== 1 ? `${item.servings} × ` : ""}
              {item.servingSize || "serving"}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            aria-expanded={open}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            Nutrition Facts
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-medium text-primary">{item.calories} kcal</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 max-w-xs">
          <NutritionFactsLabel
            servingLabel={servingLabel}
            values={{
              calories: item.calories,
              proteinG: item.proteinG,
              carbsG: item.carbsG,
              fatG: item.fatG,
              satFatG: item.satFatG,
              fiberG: item.fiberG,
              sugarG: item.sugarG,
              sodiumMg: item.sodiumMg,
              cholesterolMg: item.cholesterolMg,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function Food() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  // Queries
  const { data: logs, isLoading: isLoadingLogs } = useListFoodLogs({ date: selectedDate }, { query: { queryKey: getListFoodLogsQueryKey({ date: selectedDate }) } });
  const { data: summary, isLoading: isLoadingSummary } = useGetDailySummary({ date: selectedDate }, { query: { queryKey: getGetDailySummaryQueryKey({ date: selectedDate }) } });
  
  // Mutations
  const createLog = useCreateFoodLog();
  const deleteLog = useDeleteFoodLog();

  // State for add manual form
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showMoreNutrients, setShowMoreNutrients] = useState(false);
  const emptyForm = {
    mealType: "breakfast",
    foodName: "",
    restaurantName: "",
    servingSize: "",
    servings: "1",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    satFatG: "",
    fiberG: "",
    sugarG: "",
    sodiumMg: "",
    cholesterolMg: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  // State for quick search
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults } = useSearchMenuItems(
    { q: searchQuery }, 
    { query: { enabled: searchQuery.length > 2, queryKey: ['searchMenuItems', { q: searchQuery }] } }
  );
  const [quickMealType, setQuickMealType] = useState<string>(defaultMealType());
  const { logMenuItem, isPending: isLogging } = useLogMenuItem();
  const groupedResults = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof searchResults>>();
    (searchResults ?? []).forEach((it) => {
      const key = it.restaurantName ?? "Other";
      const arr = groups.get(key) ?? [];
      arr.push(it);
      groups.set(key, arr);
    });
    return Array.from(groups.entries());
  }, [searchResults]);

  // Chain-restaurant search (Spoonacular) — fires on explicit submit to conserve quota.
  const [chainQuery, setChainQuery] = useState("");
  const [chainAddingId, setChainAddingId] = useState<number | null>(null);
  const chainSearch = useSearchChainMenuItems(
    { q: chainQuery },
    {
      query: {
        enabled: chainQuery.length > 1,
        retry: false,
        queryKey: ["searchChainMenuItems", { q: chainQuery }],
      },
    },
  );
  const chainGroupedResults = useMemo(() => {
    const groups = new Map<string, ChainMenuSearchResult[]>();
    (chainSearch.data ?? []).forEach((it) => {
      const key = it.restaurantName || "Other";
      const arr = groups.get(key) ?? [];
      arr.push(it);
      groups.set(key, arr);
    });
    return Array.from(groups.entries());
  }, [chainSearch.data]);

  // Date navigation
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    // Per-serving values × servings = totals-as-consumed stored on the log.
    const servings = Number(formData.servings) > 0 ? Number(formData.servings) : 1;
    const scale = (v: string) => (v.trim() === "" ? undefined : Math.round(Number(v) * servings * 10) / 10);
    const scaleInt = (v: string) => (v.trim() === "" ? undefined : Math.round(Number(v) * servings));
    createLog.mutate({ data: {
      date: selectedDate,
      mealType: formData.mealType,
      foodName: formData.foodName,
      restaurantName: formData.restaurantName || undefined,
      servings,
      servingSize: formData.servingSize.trim() || undefined,
      calories: Math.round(Number(formData.calories) * servings),
      proteinG: scale(formData.proteinG),
      carbsG: scale(formData.carbsG),
      fatG: scale(formData.fatG),
      satFatG: scale(formData.satFatG),
      fiberG: scale(formData.fiberG),
      sugarG: scale(formData.sugarG),
      sodiumMg: scaleInt(formData.sodiumMg),
      cholesterolMg: scaleInt(formData.cholesterolMg),
    }}, {
      onSuccess: () => {
        toast.success("Food logged successfully");
        queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date: selectedDate }) });
        queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey({ date: selectedDate }) });
        setIsAddOpen(false);
        setShowMoreNutrients(false);
        setFormData(emptyForm);
      }
    });
  };

  const handleQuickAdd = (item: LoggableMenuItem) => {
    logMenuItem(item, {
      date: selectedDate,
      mealType: quickMealType,
      onSuccess: () => setSearchQuery(""),
    });
  };

  // Chain results have no nutrition until we fetch the item detail on demand.
  const handleAddChain = async (result: ChainMenuSearchResult) => {
    setChainAddingId(result.id);
    try {
      const detail = await getChainMenuItem(result.id);
      logMenuItem(
        { ...detail, restaurantName: detail.restaurantName ?? result.restaurantName },
        {
          date: selectedDate,
          mealType: quickMealType,
          onSuccess: () => {
            setSearchQuery("");
            setChainQuery("");
          },
        },
      );
    } catch {
      toast.error("Couldn't load that item's nutrition. Please try again.");
    } finally {
      setChainAddingId(null);
    }
  };

  const handleDelete = (id: number) => {
    deleteLog.mutate({ id }, {
      onSuccess: () => {
        toast.success("Log removed");
        queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date: selectedDate }) });
        queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey({ date: selectedDate }) });
      }
    });
  };

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];
  const logsByMeal = mealTypes.reduce((acc, type) => {
    acc[type] = logs?.filter(log => log.mealType === type) || [];
    return acc;
  }, {} as Record<string, any[]>);

  const calProgress = summary?.calorieTarget ? Math.min(100, ((summary?.totalCalories || 0) / summary.calorieTarget) * 100) : 0;
  const isOverTarget = summary?.calorieTarget && summary.totalCalories > summary.calorieTarget;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary">Daily Food Log</h1>
        <p className="text-muted-foreground text-lg">Track your meals to support your weight loss progress.</p>
      </div>

      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-sm">
        <Button variant="ghost" size="icon" onClick={handlePrevDay}><ChevronLeft className="w-5 h-5" /></Button>
        <div className="font-serif text-xl font-medium">
          {format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
        </div>
        <Button variant="ghost" size="icon" onClick={handleNextDay}><ChevronRight className="w-5 h-5" /></Button>
      </div>

      <Card className="bg-card shadow-sm border-border overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-bl-full -z-10" />
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1 w-full text-center md:text-left">
              <h2 className="text-sm font-sans font-medium text-muted-foreground flex items-center justify-center md:justify-start gap-2 mb-2">
                <Flame className="h-4 w-4 text-orange-500" /> Calories Today
              </h2>
              <div className="text-4xl font-serif">
                {summary?.totalCalories || 0} 
                <span className="text-xl text-muted-foreground ml-2">
                  / {summary?.calorieTarget || "—"}
                </span>
              </div>
              {summary?.calorieTarget && (
                <div className="mt-4">
                  <Progress value={calProgress} className={`h-3 ${isOverTarget ? '[&>div]:bg-destructive' : ''}`} />
                  <p className={`text-sm mt-2 font-medium ${isOverTarget ? 'text-destructive' : 'text-primary'}`}>
                    {isOverTarget ? 
                      `${summary.totalCalories - summary.calorieTarget} kcal over target` : 
                      `${summary.calorieTarget - summary.totalCalories} kcal remaining`}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-6 shrink-0 w-full md:w-auto justify-center md:justify-end border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8">
              <div className="text-center">
                <div className="text-2xl font-serif">{summary?.totalProteinG || 0}g</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Protein</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-serif">{summary?.totalCarbsG || 0}g</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Carbs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-serif">{summary?.totalFatG || 0}g</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Fat</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-serif text-primary">Meals</h2>
            <div className="flex gap-2">
            <MealScanner
              isLogging={createLog.isPending}
              onLog={(analysis, mealType) => {
                createLog.mutate({ data: {
                  date: selectedDate,
                  mealType,
                  foodName: analysis.name,
                  calories: analysis.calories,
                  proteinG: analysis.proteinG,
                  carbsG: analysis.carbsG,
                  fatG: analysis.fatG,
                  satFatG: analysis.satFatG,
                  fiberG: analysis.fiberG,
                  sugarG: analysis.sugarG,
                  sodiumMg: analysis.sodiumMg,
                  cholesterolMg: analysis.cholesterolMg,
                }}, {
                  onSuccess: () => {
                    toast.success(`Logged ${analysis.name}`);
                    queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date: selectedDate }) });
                    queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey({ date: selectedDate }) });
                  }
                });
              }}
            />
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full shadow-md">
                  <Plus className="w-4 h-4 mr-2" /> Custom Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Log Custom Food</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddManual} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="mealType">Meal</Label>
                    <Select value={formData.mealType} onValueChange={(val) => setFormData({...formData, mealType: val})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select meal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="lunch">Lunch</SelectItem>
                        <SelectItem value="dinner">Dinner</SelectItem>
                        <SelectItem value="snack">Snack</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foodName">Food Name</Label>
                    <Input id="foodName" required value={formData.foodName} onChange={e => setFormData({...formData, foodName: e.target.value})} placeholder="e.g. Grilled Chicken Salad" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="servingSize">Serving size</Label>
                      <Input id="servingSize" value={formData.servingSize} onChange={e => setFormData({...formData, servingSize: e.target.value})} placeholder="e.g. 1 cup" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="servings">Number of servings</Label>
                      <Input id="servings" type="number" min={0} step="0.5" value={formData.servings} onChange={e => setFormData({...formData, servings: e.target.value})} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Enter the amounts <strong>per serving</strong> — we'll multiply by the number of servings.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="calories">Calories</Label>
                    <Input id="calories" type="number" required value={formData.calories} onChange={e => setFormData({...formData, calories: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="proteinG">Protein (g)</Label>
                      <Input id="proteinG" type="number" value={formData.proteinG} onChange={e => setFormData({...formData, proteinG: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="carbsG">Carbs (g)</Label>
                      <Input id="carbsG" type="number" value={formData.carbsG} onChange={e => setFormData({...formData, carbsG: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fatG">Fat (g)</Label>
                      <Input id="fatG" type="number" value={formData.fatG} onChange={e => setFormData({...formData, fatG: e.target.value})} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMoreNutrients((v) => !v)}
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    data-testid="button-toggle-nutrients"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showMoreNutrients ? "rotate-180" : ""}`} />
                    {showMoreNutrients ? "Fewer nutrients" : "More nutrients (optional)"}
                  </button>
                  {showMoreNutrients && (
                    <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/20 p-4">
                      <div className="space-y-2">
                        <Label htmlFor="satFatG">Sat. Fat (g)</Label>
                        <Input id="satFatG" type="number" value={formData.satFatG} onChange={e => setFormData({...formData, satFatG: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiberG">Fiber (g)</Label>
                        <Input id="fiberG" type="number" value={formData.fiberG} onChange={e => setFormData({...formData, fiberG: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sugarG">Sugar (g)</Label>
                        <Input id="sugarG" type="number" value={formData.sugarG} onChange={e => setFormData({...formData, sugarG: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sodiumMg">Sodium (mg)</Label>
                        <Input id="sodiumMg" type="number" value={formData.sodiumMg} onChange={e => setFormData({...formData, sodiumMg: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cholesterolMg">Cholesterol (mg)</Label>
                        <Input id="cholesterolMg" type="number" value={formData.cholesterolMg} onChange={e => setFormData({...formData, cholesterolMg: e.target.value})} />
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full mt-4" disabled={createLog.isPending}>
                    Save to Log
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {isLoadingLogs ? (
            <div className="py-8 text-center text-muted-foreground">Loading food log...</div>
          ) : (
            <div className="space-y-6">
              {mealTypes.map(meal => (
                <div key={meal} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="bg-secondary/30 px-4 py-3 flex items-center justify-between border-b border-border">
                    <h3 className="font-semibold capitalize flex items-center gap-2">
                      {meal === 'breakfast' && <Utensils className="w-4 h-4 text-primary" />}
                      {meal === 'lunch' && <Utensils className="w-4 h-4 text-primary" />}
                      {meal === 'dinner' && <Utensils className="w-4 h-4 text-primary" />}
                      {meal === 'snack' && <Flame className="w-4 h-4 text-accent" />}
                      {meal}
                    </h3>
                    <span className="text-sm font-medium">
                      {logsByMeal[meal].reduce((sum, item) => sum + item.calories, 0)} kcal
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {logsByMeal[meal].length > 0 ? (
                      logsByMeal[meal].map(item => (
                        <FoodLogRow key={item.id} item={item} onDelete={handleDelete} />
                      ))
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground text-center italic">No items logged</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif">Today's Nutrition Facts</CardTitle>
              <CardDescription>Totals across everything you've logged today.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <NutritionFactsLabel
                  servingLabel={`${summary?.mealCount ?? 0} item${(summary?.mealCount ?? 0) === 1 ? "" : "s"} logged today`}
                  values={{
                    calories: summary?.totalCalories ?? 0,
                    proteinG: summary?.totalProteinG ?? null,
                    carbsG: summary?.totalCarbsG ?? null,
                    fatG: summary?.totalFatG ?? null,
                    satFatG: summary?.totalSatFatG ?? null,
                    fiberG: summary?.totalFiberG ?? null,
                    sugarG: summary?.totalSugarG ?? null,
                    sodiumMg: summary?.totalSodiumMg ?? null,
                    cholesterolMg: summary?.totalCholesterolMg ?? null,
                  }}
                />
              )}
            </CardContent>
          </Card>

          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="font-serif">Quick Add from Restaurants</CardTitle>
              <CardDescription>Search any restaurant or menu item and log it to today instantly.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Label htmlFor="quick-meal" className="text-xs text-muted-foreground shrink-0">Log to</Label>
                <Select value={quickMealType} onValueChange={setQuickMealType}>
                  <SelectTrigger id="quick-meal" className="h-8 text-sm capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search restaurants or menu items..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {searchQuery.length > 2 && (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {groupedResults.length > 0 ? (
                    groupedResults.map(([restaurant, items]) => (
                      <div key={restaurant}>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{restaurant}</div>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="p-3 border border-border rounded-xl bg-card hover:border-primary/50 transition-colors">
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <span className="font-medium text-sm leading-tight">{item.name}</span>
                                {item.isHealthyPick && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-primary">{item.calories} kcal</span>
                                <Button size="sm" variant="secondary" className="h-7 text-xs rounded-full" onClick={() => handleQuickAdd(item)} disabled={isLogging}>
                                  <Plus className="w-3 h-3 mr-1" /> Add
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-4">No matching local items found.</div>
                  )}
                </div>
              )}

              {searchQuery.trim().length > 1 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs text-muted-foreground leading-snug">
                      Not seeing it? Search national &amp; chain restaurants.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs rounded-full shrink-0"
                      onClick={() => {
                        const q = searchQuery.trim();
                        if (q === chainQuery) chainSearch.refetch();
                        else setChainQuery(q);
                      }}
                      disabled={chainSearch.isFetching && chainQuery === searchQuery.trim()}
                    >
                      {chainSearch.isFetching && chainQuery === searchQuery.trim() ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Search className="w-3 h-3 mr-1" />
                      )}
                      Search chains
                    </Button>
                  </div>

                  {chainQuery.length > 1 && (
                    <>
                      {chainSearch.isFetching ? (
                        <div className="text-center text-sm text-muted-foreground py-3">Searching chain menus…</div>
                      ) : chainSearch.isError ? (
                        <div className="text-center text-sm text-muted-foreground py-3">
                          Chain menu search is unavailable right now. Please try again later.
                        </div>
                      ) : chainGroupedResults.length > 0 ? (
                        <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <ShieldCheck className="w-3.5 h-3.5 text-accent shrink-0" />
                            <span>Verified nutrition · Powered by Spoonacular</span>
                          </div>
                          {chainGroupedResults.map(([restaurant, items]) => (
                            <div key={restaurant}>
                              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{restaurant}</div>
                              <div className="space-y-2">
                                {items.map((item) => (
                                  <div key={item.id} className="p-3 border border-border rounded-xl bg-card hover:border-primary/50 transition-colors flex justify-between items-center gap-2">
                                    <span className="font-medium text-sm leading-tight">{item.name}</span>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-7 text-xs rounded-full shrink-0"
                                      onClick={() => handleAddChain(item)}
                                      disabled={isLogging || chainAddingId === item.id}
                                    >
                                      {chainAddingId === item.id ? (
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      ) : (
                                        <Plus className="w-3 h-3 mr-1" />
                                      )}
                                      Add
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-sm text-muted-foreground py-3">
                          No chain menu matches for "{chainQuery}".
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}