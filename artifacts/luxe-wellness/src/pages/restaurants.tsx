import {
  useListRestaurants,
  useListMenuItems,
  useCreateCustomRestaurant,
  useDeleteCustomRestaurant,
  getListRestaurantsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
      />
    </div>
  );
}

function AddRestaurantDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const queryClient = useQueryClient();
  const createMutation = useCreateCustomRestaurant();

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Please enter a restaurant name");
      return;
    }
    createMutation.mutate(
      { data: { name: trimmed, ...(cuisine.trim() ? { cuisine: cuisine.trim() } : {}) } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListRestaurantsQueryKey() });
          setName("");
          setCuisine("");
          onClose();
          toast.success(`${trimmed} added with a suggested menu and healthy picks!`);
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
            Tell us where you like to eat and we'll build a typical menu with healthy picks and
            ordering tips — just for you. Only you can see restaurants you add.
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
          </div>
          {createMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/40 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Building the menu and healthy picks — this takes about 20 seconds...
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
            Menus and nutrition are AI estimates — actual items and values vary by location.
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
}: {
  restaurantId: number | null;
  onClose: () => void;
  restaurantName?: string;
  isMine: boolean;
}) {
  const { data: menuItems, isLoading: isLoadingMenu } = useListMenuItems(restaurantId as number, {
    query: { enabled: !!restaurantId, queryKey: ["listMenuItems", restaurantId] },
  });
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteCustomRestaurant();

  if (!restaurantId) return null;

  const healthyPicks = menuItems?.filter((item) => item.isHealthyPick) || [];

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
            <p className="text-xs text-muted-foreground pt-1">
              Menu and nutrition are AI estimates — actual items vary by location.
            </p>
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
                      <div className="flex gap-3 text-xs text-muted-foreground font-mono mt-3">
                        <span>P: {item.proteinG || 0}g</span>
                        <span>C: {item.carbsG || 0}g</span>
                        <span>F: {item.fatG || 0}g</span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
