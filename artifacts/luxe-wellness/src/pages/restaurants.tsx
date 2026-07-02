import { useListRestaurants, useListMenuItems, useListHealthyPicks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Info, CheckCircle2, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function Restaurants() {
  const { data: restaurants, isLoading: isLoadingRestaurants } = useListRestaurants();
  const [selectedRestaurant, setSelectedRestaurant] = useState<number | null>(null);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary">Local Dining Guide</h1>
        <p className="text-muted-foreground text-lg">Curated healthy options for dining out in South Point.</p>
      </div>

      {isLoadingRestaurants ? (
        <div className="py-8 text-center text-muted-foreground">Loading restaurants...</div>
      ) : restaurants && restaurants.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map(restaurant => (
            <Card key={restaurant.id} className="overflow-hidden hover:border-primary/50 transition-colors flex flex-col h-full cursor-pointer group" onClick={() => setSelectedRestaurant(restaurant.id)}>
              <CardHeader className="bg-secondary/30 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-accent uppercase tracking-wider block mb-1">{restaurant.cuisine}</span>
                    <CardTitle className="font-serif text-xl group-hover:text-primary transition-colors">{restaurant.name}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{restaurant.description || "Local favorite in South Point."}</p>
                <div className="mt-auto flex items-center justify-between text-sm font-medium text-primary group-hover:underline">
                  View Menu & Healthy Picks <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
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

      <RestaurantModal 
        restaurantId={selectedRestaurant} 
        onClose={() => setSelectedRestaurant(null)} 
        restaurantName={restaurants?.find(r => r.id === selectedRestaurant)?.name}
      />
    </div>
  );
}

function RestaurantModal({ restaurantId, onClose, restaurantName }: { restaurantId: number | null, onClose: () => void, restaurantName?: string }) {
  const { data: menuItems, isLoading: isLoadingMenu } = useListMenuItems(restaurantId as number, { query: { enabled: !!restaurantId, queryKey: ['listMenuItems', restaurantId] } });
  
  if (!restaurantId) return null;

  const healthyPicks = menuItems?.filter(item => item.isHealthyPick) || [];
  const otherItems = menuItems?.filter(item => !item.isHealthyPick) || [];

  return (
    <Dialog open={!!restaurantId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-2xl font-serif">{restaurantName} Menu</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {isLoadingMenu ? (
            <div className="py-8 text-center text-muted-foreground">Loading menu items...</div>
          ) : (
            <Tabs defaultValue="healthy" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="healthy" className="data-[state=active]:bg-accent/10 data-[state=active]:text-accent-foreground">
                  Healthy Picks ({healthyPicks.length})
                </TabsTrigger>
                <TabsTrigger value="all">Full Menu ({menuItems?.length || 0})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="healthy" className="space-y-4">
                {healthyPicks.length > 0 ? (
                  healthyPicks.map(item => (
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
                                <span className="text-muted-foreground leading-relaxed"><strong className="text-foreground">Ordering Tip:</strong> {item.orderingTip}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="bg-card p-3 rounded-xl border border-border sm:w-32 shrink-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-serif text-primary">{item.calories}</span>
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Calories</span>
                            
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
                  <div className="text-center py-8 text-muted-foreground">No healthy picks identified for this restaurant yet.</div>
                )}
              </TabsContent>
              
              <TabsContent value="all" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {menuItems?.map(item => (
                    <div key={item.id} className={`p-4 rounded-xl border ${item.isHealthyPick ? 'border-accent/50 bg-accent/5' : 'border-border bg-card'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium pr-2">{item.name}</h4>
                        <span className="font-semibold text-primary whitespace-nowrap">{item.calories} kcal</span>
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