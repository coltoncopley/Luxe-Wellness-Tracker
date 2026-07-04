import {
  useListRestaurants,
  useListMenuItems,
  useCreateCustomRestaurant,
  useDeleteCustomRestaurant,
  useCreateMyMenuItem,
  useUpdateMyMenuItem,
  useDeleteMyMenuItem,
  getListRestaurantsQueryKey,
  type MenuItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MapPin,
  Info,
  CheckCircle2,
  ChevronRight,
  Plus,
  Sparkles,
  Loader2,
  Trash2,
  ExternalLink,
  Pencil,
  Globe,
} from "lucide-react";
import { useState } from "react";

function doorDashUrl(name: string) {
  return `https://www.doordash.com/search/store/${encodeURIComponent(name)}`;
}

export default function Restaurants() {
  const { data: restaurants, isLoading: isLoadingRestaurants } = useListRestaurants();
  const [selectedRestaurant, setSelectedRestaurant] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const selected = restaurants?.find((r) => r.id === selectedRestaurant);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl mb-2 text-primary">Local Dining Guide</h1>
          <p className="text-muted-foreground text-lg">
            Curated healthy options for dining out in South Point.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="shrink-0" data-testid="button-add-restaurant">
          <Plus className="w-4 h-4 mr-2" /> Add a restaurant
        </Button>
      </div>

      {isLoadingRestaurants ? (
        <div className="py-8 text-center text-muted-foreground">Loading restaurants...</div>
      ) : restaurants && restaurants.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((restaurant) => (
            <Card
              key={restaurant.id}
              className="overflow-hidden hover:border-primary/50 transition-colors flex flex-col h-full cursor-pointer group"
              onClick={() => setSelectedRestaurant(restaurant.id)}
              data-testid={`card-restaurant-${restaurant.id}`}
            >
              <CardHeader className="bg-secondary/30 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-accent uppercase tracking-wider block mb-1">
                      {restaurant.cuisine}
                    </span>
                    <CardTitle className="font-serif text-xl group-hover:text-primary transition-colors">
                      {restaurant.name}
                    </CardTitle>
                  </div>
                  {restaurant.isMine && (
                    <Badge variant="secondary" className="shrink-0">
                      <Sparkles className="w-3 h-3 mr-1" /> Yours
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {restaurant.description || "Local favorite in South Point."}
                </p>
                <div className="mt-auto space-y-3">
                  <div className="flex items-center justify-between text-sm font-medium text-primary group-hover:underline">
                    View Menu & Healthy Picks{" "}
                    <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(doorDashUrl(restaurant.name), "_blank", "noopener,noreferrer");
                    }}
                    data-testid={`button-doordash-${restaurant.id}`}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Order on DoorDash
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground bg-card border border-dashed rounded-2xl">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No restaurants available.</p>
        </div>
      )}

      <AddRestaurantDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <RestaurantModal
        restaurantId={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
        restaurantName={selected?.name}
        isMine={selected?.isMine ?? false}
        menuSource={selected?.menuSource ?? null}
      />
    </div>
  );
}

function AddRestaurantDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [location, setLocation] = useState("");
  const queryClient = useQueryClient();
  const createMutation = useCreateCustomRestaurant();

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Please enter a restaurant name");
      return;
    }
    createMutation.mutate(
      {
        data: {
          name: trimmed,
          ...(cuisine.trim() ? { cuisine: cuisine.trim() } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListRestaurantsQueryKey() });
          setName("");
          setCuisine("");
          setLocation("");
          onClose();
          toast.success(`${trimmed} added with a menu and healthy picks!`);
        },
        onError: (err) => {
          if (err.status === 409) {
            toast.error("That restaurant is already in your list");
          } else if (err.status === 422) {
            toast.error("That doesn't look like a restaurant name — try again");
          } else if (err.status === 429) {
            const serverMessage = (err.data as { error?: string } | null)?.error;
            toast.error(
              serverMessage ?? "You've hit today's limit for adding restaurants — try again tomorrow",
            );
          } else {
            toast.error("Couldn't add that restaurant. Please try again.");
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !createMutation.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add a restaurant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tell us where you like to eat and we'll look up their real menu online, then add
            healthy picks and ordering tips — just for you. Only you can see restaurants you add.
          </p>
          <div className="space-y-2">
            <Input
              placeholder="Restaurant name (e.g. Casa Grande)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={createMutation.isPending}
              data-testid="input-restaurant-name"
            />
            <Input
              placeholder="Type of food (optional, e.g. Mexican)"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              maxLength={40}
              disabled={createMutation.isPending}
              data-testid="input-restaurant-cuisine"
            />
            <Input
              placeholder="City or area (optional, e.g. Huntington WV)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={80}
              disabled={createMutation.isPending}
              data-testid="input-restaurant-location"
            />
          </div>
          {createMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/40 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Finding the real menu and picking healthy options — this can take up to a minute...
            </div>
          )}
          <Button
            className="w-full"
            onClick={submit}
            disabled={createMutation.isPending}
            data-testid="button-submit-restaurant"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building menu...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" /> Add restaurant
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Dish names come from the restaurant's menu when we can find it online. Nutrition is
            always an AI estimate — actual values vary by location and portion.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RestaurantModal({
  restaurantId,
  onClose,
  restaurantName,
  isMine,
  menuSource,
}: {
  restaurantId: number | null;
  onClose: () => void;
  restaurantName?: string;
  isMine: boolean;
  menuSource: string | null;
}) {
  const { data: menuItems, isLoading: isLoadingMenu } = useListMenuItems(restaurantId as number, {
    query: { enabled: !!restaurantId, queryKey: ["listMenuItems", restaurantId] },
  });
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteCustomRestaurant();
  const deleteItemMutation = useDeleteMyMenuItem();
  const [editorItem, setEditorItem] = useState<MenuItem | "new" | null>(null);

  if (!restaurantId) return null;

  const healthyPicks = menuItems?.filter((item) => item.isHealthyPick) || [];

  const refreshMenu = () => {
    void queryClient.invalidateQueries({ queryKey: ["listMenuItems", restaurantId] });
  };

  const removeRestaurant = () => {
    if (!window.confirm(`Remove ${restaurantName} from your list?`)) return;
    deleteMutation.mutate(
      { id: restaurantId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListRestaurantsQueryKey() });
          onClose();
          toast.success("Restaurant removed");
        },
        onError: () => toast.error("Couldn't remove it. Please try again."),
      },
    );
  };

  const removeItem = (item: MenuItem) => {
    if (!window.confirm(`Remove "${item.name}" from this menu?`)) return;
    deleteItemMutation.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          refreshMenu();
          toast.success("Menu item removed");
        },
        onError: () => toast.error("Couldn't remove it. Please try again."),
      },
    );
  };

  return (
    <Dialog open={!!restaurantId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-2xl font-serif">{restaurantName} Menu</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(doorDashUrl(restaurantName ?? ""), "_blank", "noopener,noreferrer")
              }
              data-testid="button-doordash-modal"
            >
              <ExternalLink className="w-4 h-4 mr-2" /> Order on DoorDash
            </Button>
            {isMine && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditorItem("new")}
                data-testid="button-add-menu-item"
              >
                <Plus className="w-4 h-4 mr-2" /> Add item
              </Button>
            )}
            {isMine && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={removeRestaurant}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-restaurant"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Remove
              </Button>
            )}
          </div>
          {isMine && (
            <div className="pt-1 space-y-1">
              {menuSource && (
                <p
                  className="text-xs text-muted-foreground flex items-center gap-1"
                  data-testid="text-menu-source"
                >
                  <Globe className="w-3 h-3 shrink-0" /> Dish names from {menuSource}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Nutrition values are AI estimates — actual items vary by location. Spot something
                off? Tap the pencil on any item to fix it.
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {isLoadingMenu ? (
            <div className="py-8 text-center text-muted-foreground">Loading menu items...</div>
          ) : (
            <Tabs defaultValue="healthy" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger
                  value="healthy"
                  className="data-[state=active]:bg-accent/10 data-[state=active]:text-accent-foreground"
                >
                  Healthy Picks ({healthyPicks.length})
                </TabsTrigger>
                <TabsTrigger value="all">Full Menu ({menuItems?.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="healthy" className="space-y-4">
                {healthyPicks.length > 0 ? (
                  healthyPicks.map((item) => (
                    <Card key={item.id} className="border-accent/30 bg-accent/5 overflow-hidden">
                      <CardContent className="p-0">
                        <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg text-foreground">{item.name}</h3>
                              <CheckCircle2 className="w-5 h-5 text-accent" />
                            </div>

                            {item.orderingTip && (
                              <div className="mt-3 p-3 bg-card rounded-lg border border-border text-sm flex gap-2 items-start">
                                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span className="text-muted-foreground leading-relaxed">
                                  <strong className="text-foreground">Ordering Tip:</strong>{" "}
                                  {item.orderingTip}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="bg-card p-3 rounded-xl border border-border sm:w-32 shrink-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-serif text-primary">{item.calories}</span>
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                              Calories
                            </span>

                            <div className="w-full flex justify-between text-xs font-mono text-muted-foreground mt-2 pt-2 border-t border-border">
                              <span title="Protein">P:{item.proteinG || 0}</span>
                              <span title="Carbs">C:{item.carbsG || 0}</span>
                              <span title="Fat">F:{item.fatG || 0}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No healthy picks identified for this restaurant yet.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="all" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {menuItems?.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border ${item.isHealthyPick ? "border-accent/50 bg-accent/5" : "border-border bg-card"}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium pr-2">{item.name}</h4>
                        <span className="font-semibold text-primary whitespace-nowrap">
                          {item.calories} kcal
                        </span>
                      </div>
                      <div className="flex items-end justify-between mt-3">
                        <div className="flex gap-3 text-xs text-muted-foreground font-mono">
                          <span>P: {item.proteinG || 0}g</span>
                          <span>C: {item.carbsG || 0}g</span>
                          <span>F: {item.fatG || 0}g</span>
                        </div>
                        {isMine && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditorItem(item)}
                              data-testid={`button-edit-item-${item.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeItem(item)}
                              disabled={deleteItemMutation.isPending}
                              data-testid={`button-delete-item-${item.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {isMine && (
          <MenuItemEditorDialog
            restaurantId={restaurantId}
            item={editorItem}
            onClose={() => setEditorItem(null)}
            onSaved={refreshMenu}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MenuItemEditorDialog({
  restaurantId,
  item,
  onClose,
  onSaved,
}: {
  restaurantId: number;
  item: MenuItem | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = item === "new";
  const editing = item !== null && item !== "new" ? item : null;
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [isHealthyPick, setIsHealthyPick] = useState(false);
  const [orderingTip, setOrderingTip] = useState("");
  const [loadedFor, setLoadedFor] = useState<number | "new" | null>(null);
  const createMutation = useCreateMyMenuItem();
  const updateMutation = useUpdateMyMenuItem();

  const currentKey = item === null ? null : isNew ? ("new" as const) : item.id;
  if (item === null && loadedFor !== null) {
    setLoadedFor(null);
  }
  if (item !== null && loadedFor !== currentKey) {
    setLoadedFor(currentKey);
    setName(editing?.name ?? "");
    setCalories(editing ? String(editing.calories) : "");
    setProteinG(editing?.proteinG != null ? String(editing.proteinG) : "");
    setCarbsG(editing?.carbsG != null ? String(editing.carbsG) : "");
    setFatG(editing?.fatG != null ? String(editing.fatG) : "");
    setIsHealthyPick(editing?.isHealthyPick ?? false);
    setOrderingTip(editing?.orderingTip ?? "");
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const parseNum = (s: string): number | null => {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter an item name");
      return;
    }
    const cal = parseNum(calories);
    if (cal === null) {
      toast.error("Please enter calories (0 or more)");
      return;
    }
    const macros = {
      proteinG: parseNum(proteinG),
      carbsG: parseNum(carbsG),
      fatG: parseNum(fatG),
    };
    const tip = orderingTip.trim();
    const done = () => {
      onSaved();
      onClose();
      toast.success(isNew ? "Menu item added" : "Menu item updated");
    };
    const fail = (err: { status?: number; data?: unknown }) => {
      const serverMessage = (err.data as { error?: string } | null)?.error;
      toast.error(serverMessage ?? "Couldn't save that. Please try again.");
    };
    if (isNew) {
      createMutation.mutate(
        {
          id: restaurantId,
          data: {
            name: trimmedName,
            calories: cal,
            ...(macros.proteinG !== null ? { proteinG: macros.proteinG } : {}),
            ...(macros.carbsG !== null ? { carbsG: macros.carbsG } : {}),
            ...(macros.fatG !== null ? { fatG: macros.fatG } : {}),
            isHealthyPick,
            ...(tip ? { orderingTip: tip } : {}),
          },
        },
        { onSuccess: done, onError: fail },
      );
    } else if (editing) {
      updateMutation.mutate(
        {
          id: editing.id,
          data: {
            name: trimmedName,
            calories: cal,
            proteinG: macros.proteinG,
            carbsG: macros.carbsG,
            fatG: macros.fatG,
            isHealthyPick,
            orderingTip: tip || null,
          },
        },
        { onSuccess: done, onError: fail },
      );
    }
  };

  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isNew ? "Add menu item" : "Edit menu item"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Item name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="e.g. Grilled Chicken Salad"
              disabled={isPending}
              data-testid="input-item-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-calories">Calories</Label>
              <Input
                id="item-calories"
                type="number"
                inputMode="numeric"
                min={0}
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="e.g. 450"
                disabled={isPending}
                data-testid="input-item-calories"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-protein">Protein (g)</Label>
              <Input
                id="item-protein"
                type="number"
                inputMode="decimal"
                min={0}
                value={proteinG}
                onChange={(e) => setProteinG(e.target.value)}
                placeholder="optional"
                disabled={isPending}
                data-testid="input-item-protein"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-carbs">Carbs (g)</Label>
              <Input
                id="item-carbs"
                type="number"
                inputMode="decimal"
                min={0}
                value={carbsG}
                onChange={(e) => setCarbsG(e.target.value)}
                placeholder="optional"
                disabled={isPending}
                data-testid="input-item-carbs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-fat">Fat (g)</Label>
              <Input
                id="item-fat"
                type="number"
                inputMode="decimal"
                min={0}
                value={fatG}
                onChange={(e) => setFatG(e.target.value)}
                placeholder="optional"
                disabled={isPending}
                data-testid="input-item-fat"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="item-healthy" className="cursor-pointer">
              Mark as a healthy pick
            </Label>
            <Switch
              id="item-healthy"
              checked={isHealthyPick}
              onCheckedChange={setIsHealthyPick}
              disabled={isPending}
              data-testid="switch-item-healthy"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-tip">Ordering tip (optional)</Label>
            <Input
              id="item-tip"
              value={orderingTip}
              onChange={(e) => setOrderingTip(e.target.value)}
              maxLength={300}
              placeholder="e.g. Ask for dressing on the side"
              disabled={isPending}
              data-testid="input-item-tip"
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={isPending}
            data-testid="button-save-item"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
              </>
            ) : isNew ? (
              "Add item"
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
