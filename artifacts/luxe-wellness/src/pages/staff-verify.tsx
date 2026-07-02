import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  lookupRedemption,
  useMarkRedemptionUsed,
  useGetMe,
  getGetMeQueryKey,
  useActivateStaffAccess,
  useListServices,
  getListServicesQueryKey,
  useAdminCreateService,
  useAdminUpdateService,
  useAdminDeleteService,
  useAdminListRewardItems,
  getAdminListRewardItemsQueryKey,
  useAdminCreateRewardItem,
  useAdminUpdateRewardItem,
  useAdminListRedemptions,
  getAdminListRedemptionsQueryKey,
  type RedemptionDetail,
  type Service,
  type RewardItem,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BadgeCheck,
  Search,
  CheckCircle2,
  XCircle,
  Ticket,
  KeyRound,
  Plus,
  Pencil,
  Trash2,
  Gift,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

/* ---------- Access code gate ---------- */

function StaffAccessGate() {
  const [code, setCode] = useState("");
  const queryClient = useQueryClient();
  const activate = useActivateStaffAccess();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    activate.mutate(
      { data: { code: code.trim() } },
      {
        onSuccess: () => {
          toast.success("Staff access activated");
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: () => {
          toast.error("That access code isn't valid");
        },
      },
    );
  }

  return (
    <div className="max-w-md mx-auto pt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Staff access
          </CardTitle>
          <CardDescription>
            This area is for LUXE team members. Enter the staff access code provided by Dr. Copley
            to unlock the staff portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Access code"
              className="font-mono tracking-widest uppercase"
              autoFocus
            />
            <Button type="submit" disabled={activate.isPending || !code.trim()}>
              {activate.isPending ? "Checking..." : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Verify tab ---------- */

function VerifyTab() {
  const [codeInput, setCodeInput] = useState("");
  const [result, setResult] = useState<RedemptionDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLooking, setIsLooking] = useState(false);
  const markUsed = useMarkRedemptionUsed();

  async function handleLookup() {
    const raw = codeInput.trim();
    if (!raw) return;
    setIsLooking(true);
    setResult(null);
    setNotFound(false);
    try {
      const detail = await lookupRedemption(encodeURIComponent(raw));
      setResult(detail);
    } catch {
      setNotFound(true);
    } finally {
      setIsLooking(false);
    }
  }

  async function handleMarkUsed() {
    if (!result) return;
    try {
      const updated = await markUsed.mutateAsync({ code: encodeURIComponent(result.code) });
      setResult(updated);
      toast.success("Code marked as used");
    } catch (err) {
      const already =
        err && typeof err === "object" && "usedAt" in err ? (err as RedemptionDetail) : null;
      if (already) {
        setResult(already);
        toast.error("This code was already used");
      } else {
        toast.error("Couldn't update the code. Please try again.");
      }
    }
  }

  const isUsed = result?.usedAt != null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Look up a code</CardTitle>
          <CardDescription>Codes look like LUXE-K4TP-9WM2</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleLookup();
            }}
          >
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="LUXE-XXXX-XXXX"
              className="font-mono tracking-widest uppercase"
              autoFocus
            />
            <Button type="submit" disabled={isLooking || !codeInput.trim()}>
              <Search className="w-4 h-4 mr-2" />
              {isLooking ? "Checking..." : "Verify"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {notFound && (
        <Card className="border-rose-300">
          <CardContent className="py-6 flex items-center gap-3 text-rose-600">
            <XCircle className="h-6 w-6 shrink-0" />
            <div>
              <div className="font-medium">Code not found</div>
              <div className="text-sm text-muted-foreground">
                Double-check the code with the patient — it should match their Rewards history.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={isUsed ? "border-amber-300" : "border-emerald-300"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ticket className="h-5 w-5 text-primary" />
                <span className="font-mono tracking-widest">{result.code}</span>
              </CardTitle>
              {isUsed ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  Already used
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                  Valid — not yet used
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-1">
              <div className="font-medium">{result.title}</div>
              <div className="text-sm text-muted-foreground">
                Redeemed for {result.points.toLocaleString()} points on{" "}
                {format(new Date(`${result.date}T00:00:00`), "MMMM d, yyyy")}
              </div>
              {isUsed && result.usedAt && (
                <div className="text-sm text-amber-700">
                  Used {format(new Date(result.usedAt), "MMMM d, yyyy 'at' h:mm a")}
                </div>
              )}
            </div>

            {!isUsed && (
              <Button
                className="w-full"
                disabled={markUsed.isPending}
                onClick={() => void handleMarkUsed()}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {markUsed.isPending ? "Updating..." : "Mark as used"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- Services tab ---------- */

type ServiceFormState = {
  name: string;
  category: string;
  description: string;
  durationMinutes: string;
  priceText: string;
};

const emptyServiceForm: ServiceFormState = {
  name: "",
  category: "",
  description: "",
  durationMinutes: "",
  priceText: "",
};

function ServicesTab() {
  const queryClient = useQueryClient();
  const { data: services, isLoading } = useListServices();
  const createService = useAdminCreateService();
  const updateService = useAdminUpdateService();
  const deleteService = useAdminDeleteService();

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<ServiceFormState>(emptyServiceForm);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      category: s.category,
      description: s.description,
      durationMinutes: s.durationMinutes != null ? String(s.durationMinutes) : "",
      priceText: s.priceText ?? "",
    });
  }

  function startNew() {
    setEditingId("new");
    setForm(emptyServiceForm);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim() || !form.description.trim()) {
      toast.error("Name, category, and description are required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
      priceText: form.priceText.trim() || null,
    };
    if (editingId === "new") {
      createService.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast.success("Service added");
            setEditingId(null);
            invalidate();
          },
          onError: () => toast.error("Couldn't add the service"),
        },
      );
    } else if (typeof editingId === "number") {
      updateService.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast.success("Service updated");
            setEditingId(null);
            invalidate();
          },
          onError: () => toast.error("Couldn't update the service"),
        },
      );
    }
  }

  function handleDelete(s: Service) {
    if (!window.confirm(`Remove "${s.name}" from the service menu?`)) return;
    deleteService.mutate(
      { id: s.id },
      {
        onSuccess: () => {
          toast.success("Service removed");
          invalidate();
        },
        onError: () => toast.error("Couldn't remove the service"),
      },
    );
  }

  const saving = createService.isPending || updateService.isPending;

  const formCard = (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {editingId === "new" ? "Add a service" : "Edit service"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Name</Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Botox"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-category">Category</Label>
              <Input
                id="svc-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Injectables"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="svc-desc">Description</Label>
            <Textarea
              id="svc-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="What patients should know about this service"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="svc-duration">Duration (minutes, optional)</Label>
              <Input
                id="svc-duration"
                type="number"
                min={0}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-price">Price text (optional)</Label>
              <Input
                id="svc-price"
                value={form.priceText}
                onChange={(e) => setForm({ ...form, priceText: e.target.value })}
                placeholder="e.g. From $12/unit"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          These services appear on the Book page and power Luxe AI's answers.
        </p>
        <Button size="sm" onClick={startNew}>
          <Plus className="h-4 w-4 mr-1" /> Add service
        </Button>
      </div>

      {editingId !== null && formCard}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading services…</p>
      ) : (
        <div className="space-y-2">
          {(services ?? []).map((s) => (
            <Card key={s.id}>
              <CardContent className="py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="secondary">{s.category}</Badge>
                    {s.priceText && (
                      <span className="text-xs text-muted-foreground">{s.priceText}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(s)} aria-label={`Edit ${s.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(s)}
                    disabled={deleteService.isPending}
                    aria-label={`Delete ${s.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Rewards tab ---------- */

type RewardFormState = {
  title: string;
  description: string;
  points: string;
  sortOrder: string;
};

const emptyRewardForm: RewardFormState = { title: "", description: "", points: "", sortOrder: "0" };

function RewardsTab() {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useAdminListRewardItems();
  const createItem = useAdminCreateRewardItem();
  const updateItem = useAdminUpdateRewardItem();

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<RewardFormState>(emptyRewardForm);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getAdminListRewardItemsQueryKey() });
  }

  function startEdit(item: RewardItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      points: String(item.points),
      sortOrder: String(item.sortOrder),
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const points = Number(form.points);
    if (!form.title.trim() || !form.description.trim() || !Number.isInteger(points) || points < 1) {
      toast.error("Title, description, and a positive point cost are required");
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      points,
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (editingId === "new") {
      createItem.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast.success("Reward added");
            setEditingId(null);
            invalidate();
          },
          onError: () => toast.error("Couldn't add the reward"),
        },
      );
    } else if (typeof editingId === "number") {
      updateItem.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast.success("Reward updated");
            setEditingId(null);
            invalidate();
          },
          onError: () => toast.error("Couldn't update the reward"),
        },
      );
    }
  }

  function toggleActive(item: RewardItem, active: boolean) {
    updateItem.mutate(
      { id: item.id, data: { active } },
      {
        onSuccess: () => {
          toast.success(active ? "Reward is live" : "Reward hidden from patients");
          invalidate();
        },
        onError: () => toast.error("Couldn't update the reward"),
      },
    );
  }

  const saving = createItem.isPending || updateItem.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Patients redeem points for these perks on the Rewards page.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditingId("new");
            setForm(emptyRewardForm);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add reward
        </Button>
      </div>

      {editingId !== null && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editingId === "new" ? "Add a reward" : "Edit reward"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSave}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rw-title">Title</Label>
                  <Input
                    id="rw-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. $25 off any service"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rw-points">Point cost</Label>
                  <Input
                    id="rw-points"
                    type="number"
                    min={1}
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rw-desc">Description</Label>
                <Textarea
                  id="rw-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2 max-w-[180px]">
                <Label htmlFor="rw-sort">Sort order</Label>
                <Input
                  id="rw-sort"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading rewards…</p>
      ) : (
        <div className="space-y-2">
          {(items ?? []).map((item) => (
            <Card key={item.id} className={item.active ? "" : "opacity-60"}>
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Gift className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="secondary">{item.points.toLocaleString()} pts</Badge>
                    {!item.active && <Badge variant="outline">Hidden</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={item.active}
                    onCheckedChange={(checked) => toggleActive(item, checked)}
                    aria-label={`Toggle ${item.title}`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => startEdit(item)} aria-label={`Edit ${item.title}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Redemptions tab ---------- */

function RedemptionsTab() {
  const { data: redemptions, isLoading } = useAdminListRedemptions();

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading redemptions…</p>;
  }

  if (!redemptions || redemptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No rewards have been redeemed yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {redemptions.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="font-mono text-xs tracking-wider">{r.code}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.points.toLocaleString()} pts
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {r.patientName ?? r.patientEmail ?? "—"}
                  {r.patientName && r.patientEmail && (
                    <div className="text-xs text-muted-foreground">{r.patientEmail}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {format(new Date(`${r.date}T00:00:00`), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {r.usedAt ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      Used {format(new Date(r.usedAt), "MMM d")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                      Active
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------- Page ---------- */

export default function StaffVerify() {
  const { data: me, isLoading } = useGetMe();

  if (isLoading) {
    return <p className="text-muted-foreground pt-12 text-center">Loading…</p>;
  }

  if (me && me.role !== "staff") {
    return <StaffAccessGate />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <BadgeCheck className="h-8 w-8" /> Staff Portal
        </h1>
        <p className="text-muted-foreground text-lg">
          Verify patient reward codes and manage what patients see in the app.
        </p>
      </div>

      <Tabs defaultValue="verify">
        <TabsList className="flex-wrap">
          <TabsTrigger value="verify">
            <Ticket className="h-4 w-4 mr-1" /> Verify codes
          </TabsTrigger>
          <TabsTrigger value="services">
            <Sparkles className="h-4 w-4 mr-1" /> Services
          </TabsTrigger>
          <TabsTrigger value="rewards">
            <Gift className="h-4 w-4 mr-1" /> Rewards
          </TabsTrigger>
          <TabsTrigger value="redemptions">
            <Search className="h-4 w-4 mr-1" /> Redemptions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="verify" className="mt-6">
          <VerifyTab />
        </TabsContent>
        <TabsContent value="services" className="mt-6">
          <ServicesTab />
        </TabsContent>
        <TabsContent value="rewards" className="mt-6">
          <RewardsTab />
        </TabsContent>
        <TabsContent value="redemptions" className="mt-6">
          <RedemptionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
