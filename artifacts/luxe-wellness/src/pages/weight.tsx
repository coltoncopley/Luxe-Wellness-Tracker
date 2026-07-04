import { useState } from "react";
import { 
  useListWeightEntries, useCreateWeightEntry, useDeleteWeightEntry, getListWeightEntriesQueryKey,
  useListMeasurements, useCreateMeasurement, useDeleteMeasurement, getListMeasurementsQueryKey,
  useGetGoal, useSetGoal, getGetGoalQueryKey,
  useGetWeightProgress, getGetWeightProgressQueryKey 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Activity, Target, TrendingDown, Calendar, Trash2, Plus } from "lucide-react";

export default function Weight() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("progress");
  
  // Queries
  const { data: progress, isLoading: isLoadingProgress } = useGetWeightProgress();
  const { data: entries, isLoading: isLoadingEntries } = useListWeightEntries();
  const { data: measurements, isLoading: isLoadingMeasurements } = useListMeasurements();
  const { data: goal, isLoading: isLoadingGoal } = useGetGoal();
  
  // Mutations
  const createEntry = useCreateWeightEntry();
  const deleteEntry = useDeleteWeightEntry();
  const createMeasurement = useCreateMeasurement();
  const deleteMeasurement = useDeleteMeasurement();
  const setGoal = useSetGoal();

  // State for forms
  const [isWeightOpen, setIsWeightOpen] = useState(false);
  const [weightData, setWeightData] = useState({ date: format(new Date(), "yyyy-MM-dd"), weightLbs: "", note: "" });
  
  const [isMeasurementOpen, setIsMeasurementOpen] = useState(false);
  const [measurementData, setMeasurementData] = useState({ date: format(new Date(), "yyyy-MM-dd"), area: "waist", valueInches: "" });
  
  const [goalData, setGoalData] = useState({ 
    startWeightLbs: "", 
    goalWeightLbs: "", 
    targetDate: "", 
    dailyCalorieTarget: "" 
  });

  // Handlers
  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault();
    createEntry.mutate({ data: { 
      date: weightData.date, 
      weightLbs: Number(weightData.weightLbs),
      note: weightData.note || undefined
    }}, {
      onSuccess: () => {
        toast.success("Weight logged successfully");
        queryClient.invalidateQueries({ queryKey: getListWeightEntriesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWeightProgressQueryKey() });
        setIsWeightOpen(false);
        setWeightData({ ...weightData, weightLbs: "", note: "" });
      }
    });
  };

  const handleDeleteWeight = (id: number) => {
    deleteEntry.mutate({ id }, {
      onSuccess: () => {
        toast.success("Entry removed");
        queryClient.invalidateQueries({ queryKey: getListWeightEntriesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWeightProgressQueryKey() });
      }
    });
  };

  const handleAddMeasurement = (e: React.FormEvent) => {
    e.preventDefault();
    createMeasurement.mutate({ data: { 
      date: measurementData.date, 
      area: measurementData.area, 
      valueInches: Number(measurementData.valueInches)
    }}, {
      onSuccess: () => {
        toast.success("Measurement logged");
        queryClient.invalidateQueries({ queryKey: getListMeasurementsQueryKey() });
        setIsMeasurementOpen(false);
        setMeasurementData({ ...measurementData, valueInches: "" });
      }
    });
  };

  const handleDeleteMeasurement = (id: number) => {
    deleteMeasurement.mutate({ id }, {
      onSuccess: () => {
        toast.success("Measurement removed");
        queryClient.invalidateQueries({ queryKey: getListMeasurementsQueryKey() });
      }
    });
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    setGoal.mutate({ data: {
      startWeightLbs: goalData.startWeightLbs ? Number(goalData.startWeightLbs) : undefined,
      goalWeightLbs: goalData.goalWeightLbs ? Number(goalData.goalWeightLbs) : undefined,
      targetDate: goalData.targetDate || undefined,
      dailyCalorieTarget: goalData.dailyCalorieTarget ? Number(goalData.dailyCalorieTarget) : undefined
    }}, {
      onSuccess: () => {
        toast.success("Goals updated");
        queryClient.invalidateQueries({ queryKey: getGetGoalQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWeightProgressQueryKey() });
      }
    });
  };

  const populateGoalForm = () => {
    if (goal) {
      setGoalData({
        startWeightLbs: goal.startWeightLbs?.toString() || "",
        goalWeightLbs: goal.goalWeightLbs?.toString() || "",
        targetDate: goal.targetDate || "",
        dailyCalorieTarget: goal.dailyCalorieTarget?.toString() || ""
      });
    }
  };

  // Group measurements by area
  const latestMeasurements = measurements ? Object.values(
    measurements.reduce((acc, m) => {
      if (!acc[m.area] || new Date(m.date) > new Date(acc[m.area].date)) {
        acc[m.area] = m;
      }
      return acc;
    }, {} as Record<string, any>)
  ) : [];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl mb-2 text-primary">Weight & Measurements</h1>
          <p className="text-muted-foreground text-lg">Track your weight loss journey and celebrate your progress.</p>
        </div>
        <Dialog open={isWeightOpen} onOpenChange={setIsWeightOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-md">
              <Plus className="w-4 h-4 mr-2" /> Log Weight
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Daily Weight</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddWeight} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" required value={weightData.date} onChange={e => setWeightData({...weightData, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weightLbs">Weight (lbs)</Label>
                <Input id="weightLbs" type="number" step="0.1" required value={weightData.weightLbs} onChange={e => setWeightData({...weightData, weightLbs: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Notes (Optional)</Label>
                <Input id="note" value={weightData.note} onChange={e => setWeightData({...weightData, note: e.target.value})} placeholder="e.g. Feeling less bloated today" />
              </div>
              <Button type="submit" className="w-full mt-4" disabled={createEntry.isPending}>
                Save Entry
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card shadow-sm border-border overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -z-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Current Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{progress?.currentWeightLbs ? `${progress.currentWeightLbs} lbs` : "—"}</div>
            {progress?.totalChangeLbs ? (
              <p className="text-sm font-medium mt-1 text-primary">
                {progress.totalChangeLbs > 0 ? "+" : ""}{progress.totalChangeLbs} lbs overall
              </p>
            ) : null}
          </CardContent>
        </Card>
        
        <Card className="bg-card shadow-sm border-border overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-bl-full -z-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" /> Goal Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{progress?.goalWeightLbs ? `${progress.goalWeightLbs} lbs` : "—"}</div>
            {progress?.percentToGoal !== undefined && progress.percentToGoal !== null ? (
              <p className="text-sm text-muted-foreground mt-1">
                {Math.round(progress.percentToGoal)}% to goal
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-bl-full -z-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-500" /> Start Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{progress?.startWeightLbs ? `${progress.startWeightLbs} lbs` : "—"}</div>
            <p className="text-sm text-muted-foreground mt-1">Where you started</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="measurements">Measurements</TabsTrigger>
          <TabsTrigger value="goals" onClick={populateGoalForm}>Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="mt-6 space-y-6">
          {entries && entries.length > 0 ? (
            <Card className="p-6">
              <h3 className="font-serif text-xl mb-6">Weight Trend</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[...entries].reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), "MMM d")}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      domain={['auto', 'auto']}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(val) => format(new Date(val as string), "MMMM d, yyyy")}
                      formatter={(value: number) => [`${value} lbs`, "Weight"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="weightLbs" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorWeight)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center border-dashed">
              <TrendingDown className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-medium">No weight entries yet</h3>
              <p className="text-muted-foreground mb-4">Start tracking to see your chart</p>
            </Card>
          )}

          <div>
            <h3 className="font-serif text-xl mb-4">Recent Entries</h3>
            <div className="space-y-3">
              {entries?.slice(0, 5).map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-4 bg-card rounded-xl border border-border shadow-sm">
                  <div>
                    <p className="font-medium text-lg">{entry.weightLbs} lbs</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(entry.date), "MMM d, yyyy")}</p>
                    {entry.note && <p className="text-xs mt-1 italic text-muted-foreground/80">{entry.note}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteWeight(entry.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {entries && entries.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No entries to show.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="measurements" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif text-primary">Body Measurements</h2>
            <Dialog open={isMeasurementOpen} onOpenChange={setIsMeasurementOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  <Plus className="w-4 h-4 mr-1" /> Add Measurement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Measurement</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddMeasurement} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="m-date">Date</Label>
                    <Input id="m-date" type="date" required value={measurementData.date} onChange={e => setMeasurementData({...measurementData, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area">Area</Label>
                    <Select value={measurementData.area} onValueChange={(val) => setMeasurementData({...measurementData, area: val})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select area" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="waist">Waist</SelectItem>
                        <SelectItem value="hips">Hips</SelectItem>
                        <SelectItem value="chest">Chest</SelectItem>
                        <SelectItem value="arms">Arms</SelectItem>
                        <SelectItem value="thighs">Thighs</SelectItem>
                        <SelectItem value="neck">Neck</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valueInches">Measurement (inches)</Label>
                    <Input id="valueInches" type="number" step="0.25" required value={measurementData.valueInches} onChange={e => setMeasurementData({...measurementData, valueInches: e.target.value})} />
                  </div>
                  <Button type="submit" className="w-full mt-4" disabled={createMeasurement.isPending}>
                    Save Measurement
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {latestMeasurements.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {latestMeasurements.map((m: any) => (
                <Card key={m.id} className="p-4 flex flex-col justify-center items-center text-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{m.area}</span>
                  <span className="text-2xl font-serif text-primary">{m.valueInches}"</span>
                  <span className="text-xs text-muted-foreground mt-2">{format(new Date(m.date), "MMM d, yyyy")}</span>
                </Card>
              ))}
            </div>
          ) : (
             <Card className="p-8 text-center border-dashed">
              <p className="text-muted-foreground">No measurements recorded yet.</p>
            </Card>
          )}

          {measurements && measurements.length > 0 && (
            <div className="mt-8">
              <h3 className="font-serif text-xl mb-4">Measurement History</h3>
              <div className="space-y-2">
                {measurements.slice(0, 10).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border">
                    <div>
                      <span className="font-medium capitalize w-20 inline-block">{m.area}</span>
                      <span className="text-primary font-medium">{m.valueInches} inches</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{format(new Date(m.date), "MMM d, yyyy")}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteMeasurement(m.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="goals" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Your Targets</CardTitle>
              <CardDescription>Set your weight loss and daily calorie goals.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveGoal} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="startWeightLbs">Starting Weight (lbs)</Label>
                    <Input id="startWeightLbs" type="number" step="0.1" value={goalData.startWeightLbs} onChange={e => setGoalData({...goalData, startWeightLbs: e.target.value})} placeholder="e.g. 200" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goalWeightLbs">Goal Weight (lbs)</Label>
                    <Input id="goalWeightLbs" type="number" step="0.1" value={goalData.goalWeightLbs} onChange={e => setGoalData({...goalData, goalWeightLbs: e.target.value})} placeholder="e.g. 160" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetDate">Target Date</Label>
                    <Input id="targetDate" type="date" value={goalData.targetDate} onChange={e => setGoalData({...goalData, targetDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dailyCalorieTarget">Daily Calorie Target</Label>
                    <Input id="dailyCalorieTarget" type="number" value={goalData.dailyCalorieTarget} onChange={e => setGoalData({...goalData, dailyCalorieTarget: e.target.value})} placeholder="e.g. 1500" />
                  </div>
                </div>
                <Button type="submit" disabled={setGoal.isPending} className="w-full md:w-auto">
                  Save Goals
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}