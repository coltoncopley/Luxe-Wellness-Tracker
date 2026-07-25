import { useEffect, useState } from "react";
import {
  useGetRoutine,
  getGetRoutineQueryKey,
  useUpdateRoutine,
  useUpdateRoutineCheckin,
  useListIngredientScans,
  getListIngredientScansQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Plus, Trash2, Camera, GripVertical, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Routine() {
  const queryClient = useQueryClient();
  const { data: routine, isLoading } = useGetRoutine({ query: { queryKey: getGetRoutineQueryKey() } });
  const updateRoutine = useUpdateRoutine();
  const updateCheckin = useUpdateRoutineCheckin();
  const { data: scansData } = useListIngredientScans({ query: { queryKey: getListIngredientScansQueryKey() } });
  
  const [amItems, setAmItems] = useState<{ id?: number; productName: string; ingredientScanId?: number | null }[]>([]);
  const [pmItems, setPmItems] = useState<{ id?: number; productName: string; ingredientScanId?: number | null }[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (routine && !isEditing) {
      setAmItems(routine.items.filter((i) => i.period === "am").map((i) => ({ ...i })));
      setPmItems(routine.items.filter((i) => i.period === "pm").map((i) => ({ ...i })));
    }
  }, [routine, isEditing]);

  const handleSave = () => {
    updateRoutine.mutate(
      { data: { am: amItems, pm: pmItems } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetRoutineQueryKey(), data);
          setIsEditing(false);
          toast.success("Routine updated");
        },
        onError: () => toast.error("Failed to update routine"),
      }
    );
  };

  const handleCheckin = (amDone?: boolean, pmDone?: boolean, sunscreenUsed?: boolean) => {
    updateCheckin.mutate(
      { data: { amDone, pmDone, sunscreenUsed } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetRoutineQueryKey(), data);
          if (amDone || pmDone) {
            toast.success("Routine checked off! Glow skincare habit marked as done.");
          }
        },
      }
    );
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading your routine...</div>;
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <Sparkles className="h-8 w-8" /> Skincare Routine
        </h1>
        <p className="text-muted-foreground text-lg">
          Track your daily AM and PM products.
        </p>
      </div>

      {routine?.photoDue && (
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-primary">Time for a progress photo</p>
                <p className="text-sm text-primary/80">Keep your journey updated.</p>
              </div>
            </div>
            <Link href="/photos">
              <Button size="sm" variant="secondary">Take Photo</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* AM Routine */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">AM Routine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isEditing && routine?.today && (
              <div className="bg-secondary/20 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    checked={routine.today.amDone} 
                    onCheckedChange={(c) => handleCheckin(c as boolean, undefined, undefined)} 
                    id="am-done" 
                  />
                  <Label htmlFor="am-done" className="font-medium cursor-pointer">AM Routine Complete</Label>
                </div>
                {routine.today.amDone && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              </div>
            )}
            
            <div className="space-y-3">
              {amItems.length === 0 && !isEditing && (
                <p className="text-sm text-muted-foreground">No products added to AM routine.</p>
              )}
              {amItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {isEditing && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
                  {isEditing ? (
                    <>
                      <Input
                        value={item.productName}
                        onChange={(e) => {
                          const newItems = [...amItems];
                          newItems[idx].productName = e.target.value;
                          setAmItems(newItems);
                        }}
                        placeholder="Product name"
                        className="flex-1"
                      />
                      <Select
                        value={item.ingredientScanId?.toString() || "none"}
                        onValueChange={(val) => {
                          const newItems = [...amItems];
                          newItems[idx].ingredientScanId = val === "none" ? null : parseInt(val);
                          setAmItems(newItems);
                        }}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Link scan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {scansData?.scans.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.productName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => setAmItems(amItems.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex-1 p-3 rounded-lg border bg-card flex justify-between items-center">
                      <span>{item.productName}</span>
                      {item.ingredientScanId && <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">Linked</span>}
                    </div>
                  )}
                </div>
              ))}
              {isEditing && amItems.length < 10 && (
                <Button variant="outline" size="sm" onClick={() => setAmItems([...amItems, { productName: "" }])}>
                  <Plus className="h-4 w-4 mr-2" /> Add Product
                </Button>
              )}
            </div>
            
            {!isEditing && routine?.today && (
              <div className="flex items-center gap-3 pt-4 border-t">
                <Checkbox 
                  checked={routine.today.sunscreenUsed} 
                  onCheckedChange={(c) => handleCheckin(undefined, undefined, c as boolean)} 
                  id="spf-done" 
                />
                <Label htmlFor="spf-done" className="font-medium cursor-pointer">Wore SPF today</Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PM Routine */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">PM Routine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isEditing && routine?.today && (
              <div className="bg-secondary/20 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    checked={routine.today.pmDone} 
                    onCheckedChange={(c) => handleCheckin(undefined, c as boolean, undefined)} 
                    id="pm-done" 
                  />
                  <Label htmlFor="pm-done" className="font-medium cursor-pointer">PM Routine Complete</Label>
                </div>
                {routine.today.pmDone && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              </div>
            )}
            
            <div className="space-y-3">
              {pmItems.length === 0 && !isEditing && (
                <p className="text-sm text-muted-foreground">No products added to PM routine.</p>
              )}
              {pmItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {isEditing && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
                  {isEditing ? (
                    <>
                      <Input
                        value={item.productName}
                        onChange={(e) => {
                          const newItems = [...pmItems];
                          newItems[idx].productName = e.target.value;
                          setPmItems(newItems);
                        }}
                        placeholder="Product name"
                        className="flex-1"
                      />
                      <Select
                        value={item.ingredientScanId?.toString() || "none"}
                        onValueChange={(val) => {
                          const newItems = [...pmItems];
                          newItems[idx].ingredientScanId = val === "none" ? null : parseInt(val);
                          setPmItems(newItems);
                        }}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Link scan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {scansData?.scans.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.productName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => setPmItems(pmItems.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex-1 p-3 rounded-lg border bg-card flex justify-between items-center">
                      <span>{item.productName}</span>
                      {item.ingredientScanId && <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">Linked</span>}
                    </div>
                  )}
                </div>
              ))}
              {isEditing && pmItems.length < 10 && (
                <Button variant="outline" size="sm" onClick={() => setPmItems([...pmItems, { productName: "" }])}>
                  <Plus className="h-4 w-4 mr-2" /> Add Product
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-4 mt-6">
        {isEditing ? (
          <>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateRoutine.isPending}>Save Changes</Button>
          </>
        ) : (
          <Button onClick={() => setIsEditing(true)}>Edit Routine</Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-4">
        Checking off your AM or PM routine will automatically mark your Glow skincare habit as done for today.
      </p>
    </div>
  );
}
