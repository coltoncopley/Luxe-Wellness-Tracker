import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  lookupRedemption,
  useMarkRedemptionUsed,
  useGetMe,
  getGetMeQueryKey,
  getGetBillingStatusQueryKey,
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
  useListRestaurants,
  getListRestaurantsQueryKey,
  useListMenuItems,
  getListMenuItemsQueryKey,
  useAdminCreateRestaurant,
  useAdminDeleteRestaurant,
  useAdminCreateMenuItem,
  useAdminDeleteMenuItem,
  useAdminListComps,
  getAdminListCompsQueryKey,
  useAdminGrantComp,
  useAdminRevokeComp,
  useAdminListMembershipCodes,
  getAdminListMembershipCodesQueryKey,
  useAdminCreateMembershipCode,
  useAdminRevokeMembershipCode,
  type MembershipCode,
  useAdminListCommunityPosts,
  getAdminListCommunityPostsQueryKey,
  useModerateCommunityPost,
  useAdminListStaff,
  getAdminListStaffQueryKey,
  useAdminUpdateStaffRole,
  useAdminGetAccessCode,
  getAdminGetAccessCodeQueryKey,
  useAdminUpdateAccessCode,
  useAdminListAnnouncements,
  getAdminListAnnouncementsQueryKey,
  getListAnnouncementsQueryKey,
  useAdminCreateAnnouncement,
  useAdminUpdateAnnouncement,
  useAdminDeleteAnnouncement,
  useAdminGetMetrics,
  useAdminListDoctorTips,
  getAdminListDoctorTipsQueryKey,
  useAdminCreateDoctorTip,
  useAdminGenerateDoctorTips,
  useAdminUpdateDoctorTip,
  useAdminDeleteDoctorTip,
  useAdminSendDoctorTipNow,
  type DoctorTip,
  useAdminListOffers,
  getAdminListOffersQueryKey,
  useAdminCreateOffer,
  useAdminUpdateOffer,
  adminGetOfferClaim,
  useAdminRedeemOfferClaim,
  type AdminOffer,
  type OfferClaimDetails,
  type Announcement,
  type AdminStaffMember,
  type CompAccess,
  type RedemptionDetail,
  type Service,
  type RewardItem,
  type Restaurant,
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
  UtensilsCrossed,
  ChevronDown,
  ChevronUp,
  HeartHandshake,
  Megaphone,
  ShieldCheck,
  Eye,
  EyeOff,
  Bell,
  BarChart3,
  Copy,
  Ban,
  TicketPercent,
  Stethoscope,
  Wand2,
  Send,
  BadgePercent,
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
          void queryClient.invalidateQueries({ queryKey: getGetBillingStatusQueryKey() });
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

/* ---------- Restaurants tab ---------- */

type RestaurantFormState = { name: string; cuisine: string; description: string };
const emptyRestaurantForm: RestaurantFormState = { name: "", cuisine: "", description: "" };

type MenuItemFormState = {
  name: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  isHealthyPick: boolean;
  orderingTip: string;
};
const emptyMenuItemForm: MenuItemFormState = {
  name: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  isHealthyPick: false,
  orderingTip: "",
};

function RestaurantMenuManager({ restaurant }: { restaurant: Restaurant }) {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useListMenuItems(restaurant.id);
  const createItem = useAdminCreateMenuItem();
  const deleteItem = useAdminDeleteMenuItem();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<MenuItemFormState>(emptyMenuItemForm);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey(restaurant.id) });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const calories = Number(form.calories);
    if (!form.name.trim() || !Number.isFinite(calories) || form.calories === "") {
      toast.error("Item name and calories are required");
      return;
    }
    createItem.mutate(
      {
        id: restaurant.id,
        data: {
          name: form.name.trim(),
          calories: Math.round(calories),
          ...(form.proteinG !== "" ? { proteinG: Number(form.proteinG) } : {}),
          ...(form.carbsG !== "" ? { carbsG: Number(form.carbsG) } : {}),
          ...(form.fatG !== "" ? { fatG: Number(form.fatG) } : {}),
          isHealthyPick: form.isHealthyPick,
          ...(form.orderingTip.trim() ? { orderingTip: form.orderingTip.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success("Menu item added");
          setForm(emptyMenuItemForm);
          setAdding(false);
          invalidate();
        },
        onError: () => toast.error("Couldn't add the menu item"),
      },
    );
  }

  function handleDelete(itemId: number, name: string) {
    if (!window.confirm(`Remove "${name}" from ${restaurant.name}?`)) return;
    deleteItem.mutate(
      { id: itemId },
      {
        onSuccess: () => {
          toast.success("Menu item removed");
          invalidate();
        },
        onError: () => toast.error("Couldn't remove the menu item"),
      },
    );
  }

  return (
    <div className="border-t border-border mt-3 pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Menu items</p>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Add item
        </Button>
      </div>

      {adding && (
        <form className="space-y-3 rounded-xl border border-primary/30 p-3" onSubmit={handleAdd}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`mi-name-${restaurant.id}`}>Item name</Label>
              <Input
                id={`mi-name-${restaurant.id}`}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Grilled Chicken Salad"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`mi-cal-${restaurant.id}`}>Calories</Label>
              <Input
                id={`mi-cal-${restaurant.id}`}
                type="number"
                min={0}
                value={form.calories}
                onChange={(e) => setForm({ ...form, calories: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`mi-protein-${restaurant.id}`}>Protein (g)</Label>
              <Input
                id={`mi-protein-${restaurant.id}`}
                type="number"
                min={0}
                value={form.proteinG}
                onChange={(e) => setForm({ ...form, proteinG: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`mi-carbs-${restaurant.id}`}>Carbs (g)</Label>
              <Input
                id={`mi-carbs-${restaurant.id}`}
                type="number"
                min={0}
                value={form.carbsG}
                onChange={(e) => setForm({ ...form, carbsG: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`mi-fat-${restaurant.id}`}>Fat (g)</Label>
              <Input
                id={`mi-fat-${restaurant.id}`}
                type="number"
                min={0}
                value={form.fatG}
                onChange={(e) => setForm({ ...form, fatG: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`mi-tip-${restaurant.id}`}>Ordering tip (optional)</Label>
            <Input
              id={`mi-tip-${restaurant.id}`}
              value={form.orderingTip}
              onChange={(e) => setForm({ ...form, orderingTip: e.target.value })}
              placeholder="e.g. Dressing on the side saves ~120 calories"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id={`mi-healthy-${restaurant.id}`}
                checked={form.isHealthyPick}
                onCheckedChange={(v) => setForm({ ...form, isHealthyPick: v })}
              />
              <Label htmlFor={`mi-healthy-${restaurant.id}`}>Healthy pick</Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={createItem.isPending}>
                {createItem.isPending ? "Saving..." : "Save item"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading menu…</p>
      ) : (items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No menu items yet.</p>
      ) : (
        <div className="space-y-1">
          {(items ?? []).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.isHealthyPick && (
                    <Badge variant="secondary" className="text-emerald-700 bg-emerald-50">
                      Healthy pick
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.calories} cal
                  {item.proteinG != null && ` · ${item.proteinG}g protein`}
                  {item.carbsG != null && ` · ${item.carbsG}g carbs`}
                  {item.fatG != null && ` · ${item.fatG}g fat`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(item.id, item.name)}
                disabled={deleteItem.isPending}
                aria-label={`Delete ${item.name}`}
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RestaurantsTab() {
  const queryClient = useQueryClient();
  const { data: restaurants, isLoading } = useListRestaurants();
  const createRestaurant = useAdminCreateRestaurant();
  const deleteRestaurant = useAdminDeleteRestaurant();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<RestaurantFormState>(emptyRestaurantForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getListRestaurantsQueryKey() });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.cuisine.trim()) {
      toast.error("Name and cuisine are required");
      return;
    }
    createRestaurant.mutate(
      {
        data: {
          name: form.name.trim(),
          cuisine: form.cuisine.trim(),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
        },
      },
      {
        onSuccess: (created) => {
          toast.success("Restaurant added — now add its menu items");
          setForm(emptyRestaurantForm);
          setAdding(false);
          setExpandedId(created.id);
          invalidate();
        },
        onError: () => toast.error("Couldn't add the restaurant"),
      },
    );
  }

  function handleDelete(r: Restaurant) {
    if (!window.confirm(`Remove "${r.name}" and all of its menu items?`)) return;
    deleteRestaurant.mutate(
      { id: r.id },
      {
        onSuccess: () => {
          toast.success("Restaurant removed");
          if (expandedId === r.id) setExpandedId(null);
          invalidate();
        },
        onError: () => toast.error("Couldn't remove the restaurant"),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          These restaurants and menus appear on the patient Restaurants page and in menu search.
        </p>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Add restaurant
        </Button>
      </div>

      {adding && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add a restaurant</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleAdd}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rest-name">Name</Label>
                  <Input
                    id="rest-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Longhorn Steakhouse"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rest-cuisine">Cuisine</Label>
                  <Input
                    id="rest-cuisine"
                    value={form.cuisine}
                    onChange={(e) => setForm({ ...form, cuisine: e.target.value })}
                    placeholder="e.g. Steakhouse"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rest-desc">Description (optional)</Label>
                <Input
                  id="rest-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description patients will see"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createRestaurant.isPending}>
                  {createRestaurant.isPending ? "Saving..." : "Save"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading restaurants…</p>
      ) : (
        <div className="space-y-2">
          {(restaurants ?? []).map((r) => (
            <Card key={r.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="secondary">{r.cuisine}</Badge>
                    </div>
                    {r.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      aria-label={`${expandedId === r.id ? "Hide" : "Manage"} menu for ${r.name}`}
                    >
                      {expandedId === r.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(r)}
                      disabled={deleteRestaurant.isPending}
                      aria-label={`Delete ${r.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
                {expandedId === r.id && <RestaurantMenuManager restaurant={r} />}
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

/* ---------- Free access tab ---------- */

function FreeAccessTab() {
  const queryClient = useQueryClient();
  const { data: comps, isLoading } = useAdminListComps();
  const grant = useAdminGrantComp();
  const revoke = useAdminRevokeComp();

  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState("1");

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getAdminListCompsQueryKey() });
  }

  function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const lifetime = duration === "lifetime";
    grant.mutate(
      {
        data: {
          email: email.trim(),
          ...(lifetime ? { lifetime: true } : { months: Number(duration) as 1 | 3 | 6 | 12 }),
        },
      },
      {
        onSuccess: (c) => {
          toast.success(
            c.lifetime
              ? `${c.email ?? "Patient"} now has free access for life`
              : `${c.email ?? "Patient"} has free access until ${
                  c.until ? format(new Date(c.until), "MMM d, yyyy") : "—"
                }`,
          );
          setEmail("");
          refresh();
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          toast.error(
            status === 404
              ? "No account found with that email. The patient must sign up in the app first."
              : "Couldn't grant free access. Please try again.",
          );
        },
      },
    );
  }

  function handleRevoke(c: CompAccess) {
    revoke.mutate(
      { userId: c.userId },
      {
        onSuccess: () => {
          toast.success(`Free access removed for ${c.email ?? "patient"}`);
          refresh();
        },
        onError: () => toast.error("Couldn't remove free access. Please try again."),
      },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-primary" /> Give a patient free access
          </CardTitle>
          <CardDescription>
            The patient must already have an account (they can sign up free — no card needed).
            While free access is active they skip the $4.99/mo membership entirely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={handleGrant}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patient@email.com"
              className="flex-1"
            />
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="1">1 month</option>
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">1 year</option>
              <option value="lifetime">Lifetime</option>
            </select>
            <Button type="submit" disabled={grant.isPending || !email.trim()}>
              {grant.isPending ? "Granting..." : "Grant free access"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !comps || comps.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No patients have free access right now.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Patients with free access</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Free until</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comps.map((c) => (
                  <TableRow key={c.userId}>
                    <TableCell>
                      <div className="font-medium">{c.firstName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.email ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      {c.lifetime ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          Lifetime
                        </Badge>
                      ) : c.until ? (
                        <span className="text-sm whitespace-nowrap">
                          {format(new Date(c.until), "MMM d, yyyy")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={revoke.isPending}
                        onClick={() => handleRevoke(c)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- Membership codes tab ---------- */

const CODE_STATUS_BADGE: Record<
  MembershipCode["status"],
  { label: string; className: string }
> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
  redeemed: { label: "Redeemed", className: "bg-blue-100 text-blue-800" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
  revoked: { label: "Revoked", className: "bg-red-100 text-red-800" },
};

function MembershipCodesTab({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { data: codes, isLoading } = useAdminListMembershipCodes({
    query: { queryKey: getAdminListMembershipCodesQueryKey() },
  });
  const create = useAdminCreateMembershipCode();
  const revoke = useAdminRevokeMembershipCode();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getAdminListMembershipCodesQueryKey() });
  }

  function handleCreate(kind: "six_month" | "unlimited") {
    create.mutate(
      { data: { kind } },
      {
        onSuccess: (c) => {
          void navigator.clipboard?.writeText(c.code).catch(() => {});
          toast.success(`Code ${c.code} created and copied to clipboard`);
          refresh();
        },
        onError: () => toast.error("Couldn't create the code. Please try again."),
      },
    );
  }

  function handleCopy(code: string) {
    void navigator.clipboard?.writeText(code).then(
      () => toast.success("Code copied"),
      () => toast.error("Couldn't copy — select and copy it manually"),
    );
  }

  function handleRevoke(c: MembershipCode) {
    if (
      !window.confirm(
        c.status === "redeemed"
          ? "Revoke this code? The patient who used it will lose their free access."
          : "Revoke this code so it can never be used?",
      )
    ) {
      return;
    }
    revoke.mutate(
      { id: c.id },
      {
        onSuccess: () => {
          toast.success("Code revoked");
          refresh();
        },
        onError: () => toast.error("Couldn't revoke the code. Please try again."),
      },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TicketPercent className="h-5 w-5 text-primary" /> Membership access codes
          </CardTitle>
          <CardDescription>
            Each code works exactly once. Give it to a patient — they enter it on the membership
            screen and get free access without paying. 6-month codes expire on their own
            {isAdmin ? "; unlimited codes give free access for life" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => handleCreate("six_month")} disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            {create.isPending ? "Creating..." : "New 6-month code"}
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => handleCreate("unlimited")}
              disabled={create.isPending}
            >
              <Plus className="h-4 w-4 mr-1" /> New unlimited code
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !codes || codes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No codes yet — create one above.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All codes</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Used by</TableHead>
                  <TableHead>Free until</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => {
                  const badge = CODE_STATUS_BADGE[c.status];
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleCopy(c.code)}
                          className="font-mono text-sm inline-flex items-center gap-1.5 hover:text-primary"
                          title="Copy code"
                        >
                          {c.code}
                          <Copy className="h-3.5 w-3.5 opacity-50" />
                        </button>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(c.createdAt), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {c.kind === "unlimited" ? "Unlimited" : "6 months"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{c.createdByName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.createdByEmail ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        {c.redeemedByName || c.redeemedByEmail ? (
                          <>
                            <div className="text-sm">{c.redeemedByName ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.redeemedByEmail ?? ""}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {c.kind === "unlimited" && c.status === "redeemed"
                          ? "Lifetime"
                          : c.accessUntil
                            ? format(new Date(c.accessUntil), "MMM d, yyyy")
                            : "—"}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {c.status === "active" || c.status === "redeemed" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={revoke.isPending}
                              onClick={() => handleRevoke(c)}
                            >
                              <Ban className="h-4 w-4 mr-1" /> Revoke
                            </Button>
                          ) : null}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- Page ---------- */

function CommunityModerationTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminListCommunityPosts({
    query: { queryKey: getAdminListCommunityPostsQueryKey() },
  });
  const posts = data?.posts ?? [];
  const moderate = useModerateCommunityPost();

  const setHidden = (id: number, hidden: boolean) => {
    moderate.mutate(
      { id, data: { hidden } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getAdminListCommunityPostsQueryKey() });
          toast.success(hidden ? "Post hidden from patients." : "Post restored.");
        },
        onError: () => toast.error("Couldn't update the post. Please try again."),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Community moderation</CardTitle>
        <CardDescription>
          Anonymous community posts. You can hide anything inappropriate — authors are never shown,
          even to staff.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No community posts yet.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className={`rounded-lg border p-3 ${post.hidden ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {post.category.replace("_", " ")}
                      </Badge>
                      {post.hidden && (
                        <Badge variant="destructive" className="text-xs">
                          Hidden
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(post.createdAt).toLocaleDateString()} · {post.heartCount} hearts
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{post.body}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={post.hidden ? "outline" : "destructive"}
                    className="shrink-0"
                    disabled={moderate.isPending}
                    onClick={() => setHidden(post.id, !post.hidden)}
                  >
                    {post.hidden ? "Restore" : "Hide"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Announcements tab ---------- */

function AnnouncementsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminListAnnouncements();
  const createAnnouncement = useAdminCreateAnnouncement();
  const updateAnnouncement = useAdminUpdateAnnouncement();
  const deleteAnnouncement = useAdminDeleteAnnouncement();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getAdminListAnnouncementsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
  }

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || body.trim().length < 10) {
      toast.error("Title needs at least 3 characters and the message at least 10");
      return;
    }
    createAnnouncement.mutate(
      { data: { title: title.trim(), body: body.trim() } },
      {
        onSuccess: () => {
          toast.success("Announcement posted — patients will see it on their home page");
          setTitle("");
          setBody("");
          invalidate();
        },
        onError: () => toast.error("Couldn't post the announcement"),
      },
    );
  }

  function toggleActive(a: Announcement, active: boolean) {
    updateAnnouncement.mutate(
      { id: a.id, data: { active } },
      {
        onSuccess: () => {
          toast.success(active ? "Announcement is live" : "Announcement hidden");
          invalidate();
        },
        onError: () => toast.error("Couldn't update the announcement"),
      },
    );
  }

  function handleDelete(a: Announcement) {
    if (!window.confirm(`Delete "${a.title}"? This can't be undone.`)) return;
    deleteAnnouncement.mutate(
      { id: a.id },
      {
        onSuccess: () => {
          toast.success("Announcement deleted");
          invalidate();
        },
        onError: () => toast.error("Couldn't delete the announcement"),
      },
    );
  }

  const announcements = data?.announcements ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Post an update</CardTitle>
          <CardDescription>
            Patients see the 3 most recent live announcements on their home page — specials, new
            services, events, hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePost} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="announcement-title">Title</Label>
              <Input
                id="announcement-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="September special: 20% off HydraFacials"
                data-testid="input-announcement-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="announcement-body">Message</Label>
              <Textarea
                id="announcement-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Book this month and enjoy 20% off any HydraFacial treatment…"
                data-testid="input-announcement-body"
              />
            </div>
            <Button
              type="submit"
              disabled={createAnnouncement.isPending}
              data-testid="button-post-announcement"
            >
              <Plus className="h-4 w-4 mr-1" /> Post announcement
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : announcements.length === 0 ? (
        <p className="text-muted-foreground text-sm">No announcements yet.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className={a.active ? "" : "opacity-60"}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{a.title}</h3>
                    {!a.active && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{a.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(a.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={a.active}
                    onCheckedChange={(checked) => toggleActive(a, checked)}
                    aria-label={a.active ? "Hide announcement" : "Show announcement"}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(a)}
                    aria-label="Delete announcement"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
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

/* ---------- Insights tab (admin only) ---------- */

function MetricCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-serif mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function InsightsTab() {
  const { data: metrics, isLoading } = useAdminGetMetrics();

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!metrics) return <p className="text-muted-foreground text-sm">Couldn't load metrics.</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Business totals only — individual patient health data is never included here.
      </p>

      <div>
        <h3 className="text-lg mb-3">Membership</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Paying members" value={metrics.membership.activeMembers} />
          <MetricCard label="On free trial" value={metrics.membership.trialing} />
          <MetricCard label="Payment issues" value={metrics.membership.pastDue} />
          <MetricCard label="Free access (comps)" value={metrics.membership.activeComps} />
        </div>
      </div>

      <div>
        <h3 className="text-lg mb-3">Patients</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total sign-ups" value={metrics.patients.totalPatients} />
          <MetricCard label="New in last 30 days" value={metrics.patients.newLast30Days} />
          <MetricCard
            label="Active in last 7 days"
            value={metrics.engagement.activeUsersLast7Days}
            hint="Patients earning points this week"
          />
          <MetricCard label="Community posts" value={metrics.engagement.communityPosts} />
        </div>
      </div>

      <div>
        <h3 className="text-lg mb-3">Rewards</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Points earned" value={metrics.rewards.pointsEarned} />
          <MetricCard label="Points redeemed" value={metrics.rewards.pointsRedeemed} />
          <MetricCard label="Rewards claimed" value={metrics.rewards.redemptionsTotal} />
          <MetricCard label="Redeemed in office" value={metrics.rewards.redemptionsUsed} />
        </div>
      </div>

      {metrics.rewards.topRewards.length > 0 && (
        <div>
          <h3 className="text-lg mb-3">Most popular rewards</h3>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reward</TableHead>
                  <TableHead className="text-right">Times claimed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.rewards.topRewards.map((r) => (
                  <TableRow key={r.title}>
                    <TableCell>{r.title}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------- Admin tab (admin only) ---------- */

function roleBadge(role: AdminStaffMember["role"]) {
  if (role === "admin") return <Badge>Admin</Badge>;
  return <Badge variant="secondary">Staff</Badge>;
}

function AdminTab({ myUserId }: { myUserId: string }) {
  const queryClient = useQueryClient();

  const { data: accessCode } = useAdminGetAccessCode({
    query: { queryKey: getAdminGetAccessCodeQueryKey() },
  });
  const { data: staffList, isLoading: staffLoading } = useAdminListStaff({
    query: { queryKey: getAdminListStaffQueryKey() },
  });

  const [showCode, setShowCode] = useState(false);
  const [newCode, setNewCode] = useState("");

  const updateCode = useAdminUpdateAccessCode();
  const updateRole = useAdminUpdateStaffRole();

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newCode.trim();
    if (!/^[A-Za-z0-9]{4,20}$/.test(trimmed)) {
      toast.error("The code must be 4-20 letters or numbers (no spaces)");
      return;
    }
    updateCode.mutate(
      { data: { code: trimmed } },
      {
        onSuccess: (result) => {
          toast.success(`Access code changed to ${result.code}`);
          setNewCode("");
          void queryClient.invalidateQueries({ queryKey: getAdminGetAccessCodeQueryKey() });
        },
        onError: () => toast.error("Couldn't change the code — try again"),
      },
    );
  }

  function changeRole(member: AdminStaffMember, role: AdminStaffMember["role"], label: string) {
    if (!window.confirm(label)) return;
    updateRole.mutate(
      { userId: member.id, data: { role } },
      {
        onSuccess: () => {
          toast.success("Updated");
          void queryClient.invalidateQueries({ queryKey: getAdminListStaffQueryKey() });
        },
        onError: (err) => {
          const status = (err as { status?: number }).status;
          toast.error(
            status === 400 ? "That change isn't allowed" : "Couldn't update — try again",
          );
        },
      },
    );
  }

  const members = staffList ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Staff access code
          </CardTitle>
          <CardDescription>
            Team members enter this code once on the Staff Portal page to unlock staff access.
            Change it any time — people who already unlocked access keep it (remove them below if
            needed).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Current code:</span>
            <code
              className="font-mono text-lg tracking-widest"
              data-testid="text-current-access-code"
            >
              {showCode ? (accessCode?.code ?? "…") : "••••••"}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCode((v) => !v)}
              data-testid="button-toggle-code-visibility"
            >
              {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <form onSubmit={handleCodeSubmit} className="flex gap-2 max-w-sm">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="New code (4-20 letters/numbers)"
              data-testid="input-new-access-code"
            />
            <Button
              type="submit"
              disabled={updateCode.isPending || !newCode.trim()}
              data-testid="button-save-access-code"
            >
              {updateCode.isPending ? "Saving…" : "Change code"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Staff members
          </CardTitle>
          <CardDescription>
            Everyone with Staff Portal access. Admins can also change the access code and manage
            this list. Removing someone turns their account back into a regular patient account —
            it does not delete anything.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {staffLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No staff members yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const isSelf = m.id === myUserId;
                  return (
                    <TableRow key={m.id} data-testid={`row-staff-${m.id}`}>
                      <TableCell>
                        {m.firstName ?? "—"}
                        {isSelf && (
                          <span className="text-muted-foreground text-xs ml-1">(you)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                      <TableCell>{roleBadge(m.role)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {isSelf ? (
                          <span className="text-muted-foreground text-xs">
                            You can't change your own role
                          </span>
                        ) : (
                          <>
                            {m.role === "staff" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updateRole.isPending}
                                onClick={() =>
                                  changeRole(
                                    m,
                                    "admin",
                                    `Make ${m.firstName ?? m.email ?? "this person"} an admin? They'll be able to change the access code and manage staff.`,
                                  )
                                }
                                data-testid={`button-make-admin-${m.id}`}
                              >
                                Make admin
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updateRole.isPending}
                                onClick={() =>
                                  changeRole(
                                    m,
                                    "staff",
                                    `Remove admin privileges from ${m.firstName ?? m.email ?? "this person"}? They'll stay staff.`,
                                  )
                                }
                                data-testid={`button-remove-admin-${m.id}`}
                              >
                                Remove admin
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={updateRole.isPending}
                              onClick={() =>
                                changeRole(
                                  m,
                                  "patient",
                                  `Remove ${m.firstName ?? m.email ?? "this person"} from staff? Their account becomes a regular patient account.`,
                                )
                              }
                              data-testid={`button-remove-staff-${m.id}`}
                            >
                              Remove staff
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Weekly tips tab (admin only) ---------- */

function tipStatusBadge(status: DoctorTip["status"]) {
  if (status === "sent")
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Published</Badge>;
  if (status === "approved")
    return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Approved — queued</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function TipsTab() {
  const queryClient = useQueryClient();
  const { data: tipsData, isLoading } = useAdminListDoctorTips({
    query: { queryKey: getAdminListDoctorTipsQueryKey() },
  });
  const createTip = useAdminCreateDoctorTip();
  const generateTips = useAdminGenerateDoctorTips();
  const updateTip = useAdminUpdateDoctorTip();
  const deleteTip = useAdminDeleteDoctorTip();
  const sendNow = useAdminSendDoctorTipNow();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getAdminListDoctorTipsQueryKey() });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createTip.mutate(
      { data: { title: title.trim(), body: body.trim() } },
      {
        onSuccess: () => {
          toast.success("Tip added to the queue as a draft");
          setTitle("");
          setBody("");
          refresh();
        },
        onError: () => toast.error("Couldn't save the tip. Please try again."),
      },
    );
  }

  function handleGenerate() {
    generateTips.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`${result.tips.length} tip ideas drafted — review and approve the ones you like`);
        refresh();
      },
      onError: () => toast.error("Couldn't draft ideas right now. Please try again."),
    });
  }

  function startEdit(t: DoctorTip) {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditBody(t.body);
  }

  function saveEdit(id: number) {
    updateTip.mutate(
      { id, data: { title: editTitle.trim(), body: editBody.trim() } },
      {
        onSuccess: () => {
          toast.success("Tip updated");
          setEditingId(null);
          refresh();
        },
        onError: () => toast.error("Couldn't update the tip."),
      },
    );
  }

  function setStatus(t: DoctorTip, status: "draft" | "approved") {
    updateTip.mutate(
      { id: t.id, data: { status } },
      {
        onSuccess: () => {
          toast.success(status === "approved" ? "Tip approved — it'll go out on a Monday" : "Moved back to drafts");
          refresh();
        },
        onError: () => toast.error("Couldn't update the tip."),
      },
    );
  }

  function handleSendNow(t: DoctorTip) {
    if (!window.confirm(`Publish "${t.title}" to every patient's home page right now?`)) return;
    sendNow.mutate(
      { id: t.id },
      {
        onSuccess: () => {
          toast.success("Tip published — patients will see it on their home page");
          refresh();
        },
        onError: () => toast.error("Couldn't publish the tip."),
      },
    );
  }

  function handleDelete(t: DoctorTip) {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    deleteTip.mutate(
      { id: t.id },
      {
        onSuccess: () => {
          toast.success("Tip deleted");
          refresh();
        },
        onError: () => toast.error("Couldn't delete the tip."),
      },
    );
  }

  const tips = tipsData?.tips ?? [];
  const drafts = tips.filter((t) => t.status === "draft");
  const approved = tips.filter((t) => t.status === "approved");
  const sent = tips.filter((t) => t.status === "sent");

  function tipRow(t: DoctorTip) {
    const busy = updateTip.isPending || deleteTip.isPending || sendNow.isPending;
    return (
      <div key={t.id} className="rounded-xl border border-border p-4 space-y-2">
        {editingId === t.id ? (
          <div className="space-y-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={100}
            />
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              maxLength={1000}
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || editTitle.trim().length < 3 || editBody.trim().length < 10}
                onClick={() => saveEdit(t.id)}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">{t.title}</div>
              <div className="flex items-center gap-1.5 shrink-0">
                {t.source === "ai" && (
                  <Badge variant="outline" className="text-xs">
                    AI idea
                  </Badge>
                )}
                {tipStatusBadge(t.status)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{t.body}</p>
            {t.status === "sent" ? (
              <p className="text-xs text-muted-foreground">
                Published {t.sentAt ? format(new Date(t.sentAt), "MMM d, yyyy") : ""}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(t)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                {t.status === "draft" ? (
                  <Button size="sm" disabled={busy} onClick={() => setStatus(t, "approved")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                  </Button>
                ) : (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => handleSendNow(t)}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Publish now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setStatus(t, "draft")}
                    >
                      Back to draft
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleDelete(t)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weekly tip from Dr. Copley</CardTitle>
          <CardDescription>
            Approved tips go out automatically every Monday morning, one per week (oldest approved
            first). Patients see the latest published tip on their home page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            disabled={generateTips.isPending}
            onClick={handleGenerate}
            data-testid="button-generate-tips"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            {generateTips.isPending ? "Drafting ideas..." : "Draft 5 ideas with AI"}
          </Button>
          <form onSubmit={handleCreate} className="space-y-2">
            <Label>Or write your own</Label>
            <Input
              placeholder="Tip title"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-tip-title"
            />
            <Textarea
              placeholder="A few friendly sentences of wellness guidance..."
              value={body}
              maxLength={1000}
              rows={3}
              onChange={(e) => setBody(e.target.value)}
              data-testid="input-tip-body"
            />
            <Button
              type="submit"
              disabled={createTip.isPending || title.trim().length < 3 || body.trim().length < 10}
              data-testid="button-add-tip"
            >
              <Plus className="h-4 w-4 mr-1" /> Add draft
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading tips…</p>
      ) : (
        <>
          {drafts.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Awaiting approval ({drafts.length})</h3>
              {drafts.map(tipRow)}
            </div>
          )}
          {approved.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Approved — queued for Mondays ({approved.length})</h3>
              {approved.map(tipRow)}
            </div>
          )}
          {sent.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Published ({sent.length})</h3>
              {sent.map(tipRow)}
            </div>
          )}
          {tips.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No tips yet — draft some ideas with AI or write your own above.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Limited-time offers tab ---------- */

function toDateTimeLocalEndOfDay(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59`).toISOString();
}

function OffersTab() {
  const queryClient = useQueryClient();
  const { data: offersData, isLoading } = useAdminListOffers({
    query: { queryKey: getAdminListOffersQueryKey() },
  });
  const createOffer = useAdminCreateOffer();
  const updateOffer = useAdminUpdateOffer();
  const redeemClaim = useAdminRedeemOfferClaim();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endsOn, setEndsOn] = useState("");

  const [claimInput, setClaimInput] = useState("");
  const [claimResult, setClaimResult] = useState<OfferClaimDetails | null>(null);
  const [claimNotFound, setClaimNotFound] = useState(false);
  const [claimLooking, setClaimLooking] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getAdminListOffersQueryKey() });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createOffer.mutate(
      {
        data: {
          title: title.trim(),
          description: description.trim(),
          endsAt: toDateTimeLocalEndOfDay(endsOn),
        },
      },
      {
        onSuccess: () => {
          toast.success("Offer is live — patients will see it on their home page");
          setTitle("");
          setDescription("");
          setEndsOn("");
          refresh();
        },
        onError: () => toast.error("Couldn't create the offer. Check the end date and try again."),
      },
    );
  }

  function toggleActive(o: AdminOffer, active: boolean) {
    updateOffer.mutate(
      { id: o.id, data: { active } },
      {
        onSuccess: () => {
          toast.success(active ? "Offer turned on" : "Offer hidden from patients");
          refresh();
        },
        onError: () => toast.error("Couldn't update the offer."),
      },
    );
  }

  async function handleClaimLookup() {
    const raw = claimInput.trim();
    if (!raw) return;
    setClaimLooking(true);
    setClaimResult(null);
    setClaimNotFound(false);
    try {
      const detail = await adminGetOfferClaim(encodeURIComponent(raw));
      setClaimResult(detail);
    } catch {
      setClaimNotFound(true);
    } finally {
      setClaimLooking(false);
    }
  }

  function handleRedeemClaim() {
    if (!claimResult) return;
    redeemClaim.mutate(
      { code: encodeURIComponent(claimResult.code) },
      {
        onSuccess: (updated) => {
          setClaimResult(updated);
          toast.success("Offer code marked as used");
          refresh();
        },
        onError: () => toast.error("Couldn't mark it used — it may already be used."),
      },
    );
  }

  const offers = offersData?.offers ?? [];
  const claimUsed = claimResult?.redeemedAt != null;
  const claimExpired = claimResult ? new Date(claimResult.offerEndsAt) < new Date() : false;
  const minEndsOn = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Verify an offer code</CardTitle>
          <CardDescription>Codes look like OFR-K4TP-9WM2</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleClaimLookup();
            }}
          >
            <Input
              value={claimInput}
              onChange={(e) => setClaimInput(e.target.value.toUpperCase())}
              placeholder="OFR-XXXX-XXXX"
              className="font-mono tracking-widest uppercase"
              data-testid="input-offer-claim-code"
            />
            <Button type="submit" disabled={claimLooking || !claimInput.trim()}>
              <Search className="w-4 h-4 mr-2" />
              {claimLooking ? "Checking..." : "Verify"}
            </Button>
          </form>
          {claimNotFound && (
            <p className="text-sm text-rose-600 mt-3 flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Code not found — double-check it with the patient.
            </p>
          )}
          {claimResult && (
            <div
              className={`mt-4 rounded-xl border p-4 space-y-2 ${
                claimUsed || claimExpired ? "border-amber-300" : "border-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono tracking-widest">{claimResult.code}</span>
                {claimUsed ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    Already used
                  </Badge>
                ) : claimExpired ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    Offer expired
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                    Valid — not yet used
                  </Badge>
                )}
              </div>
              <div>
                <div className="font-medium">{claimResult.offerTitle}</div>
                <div className="text-sm text-muted-foreground">{claimResult.offerDescription}</div>
              </div>
              <div className="text-sm text-muted-foreground">
                Claimed by {claimResult.patientName ?? "a patient"}
                {claimResult.patientEmail ? ` (${claimResult.patientEmail})` : ""} on{" "}
                {format(new Date(claimResult.claimedAt), "MMM d, yyyy")}
              </div>
              {claimUsed && claimResult.redeemedAt && (
                <div className="text-sm text-amber-700">
                  Used {format(new Date(claimResult.redeemedAt), "MMM d, yyyy 'at' h:mm a")}
                </div>
              )}
              {!claimUsed && (
                <Button
                  className="w-full"
                  disabled={redeemClaim.isPending}
                  onClick={handleRedeemClaim}
                  data-testid="button-redeem-offer-claim"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {redeemClaim.isPending ? "Updating..." : "Mark as used"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create a limited-time offer</CardTitle>
          <CardDescription>
            Shows on every patient's home page until the end date. Each patient can claim one code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-2">
            <Input
              placeholder='Offer title, e.g. "20% off HydraFacial this week"'
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-offer-title"
            />
            <Textarea
              placeholder="Details patients should know — what's included, how to book..."
              value={description}
              maxLength={1000}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-offer-description"
            />
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="offer-ends">Last day of the offer</Label>
                <Input
                  id="offer-ends"
                  type="date"
                  value={endsOn}
                  min={minEndsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                  data-testid="input-offer-ends"
                />
              </div>
              <Button
                type="submit"
                disabled={
                  createOffer.isPending ||
                  title.trim().length < 3 ||
                  description.trim().length < 10 ||
                  !endsOn
                }
                data-testid="button-create-offer"
              >
                <Plus className="h-4 w-4 mr-1" /> Launch offer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading offers…</p>
      ) : offers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No offers yet.</p>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => {
            const expired = new Date(o.endsAt) < new Date();
            return (
              <div key={o.id} className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{o.title}</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {o.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {expired ? (
                      <Badge variant="secondary">Ended</Badge>
                    ) : o.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Hidden</Badge>
                    )}
                    <Switch
                      checked={o.active}
                      disabled={updateOffer.isPending}
                      onCheckedChange={(checked) => toggleActive(o, checked)}
                      data-testid={`switch-offer-active-${o.id}`}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ends {format(new Date(o.endsAt), "MMM d, yyyy")} · {o.claimCount} claimed ·{" "}
                  {o.redeemedCount} used
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StaffVerify() {
  const { data: me, isLoading } = useGetMe();

  if (isLoading) {
    return <p className="text-muted-foreground pt-12 text-center">Loading…</p>;
  }

  if (me && me.role !== "staff" && me.role !== "admin") {
    return <StaffAccessGate />;
  }

  const isAdmin = me?.role === "admin";

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
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="verify">
            <Ticket className="h-4 w-4 mr-1" /> Verify codes
          </TabsTrigger>
          <TabsTrigger value="services">
            <Sparkles className="h-4 w-4 mr-1" /> Services
          </TabsTrigger>
          <TabsTrigger value="restaurants">
            <UtensilsCrossed className="h-4 w-4 mr-1" /> Restaurants
          </TabsTrigger>
          <TabsTrigger value="rewards">
            <Gift className="h-4 w-4 mr-1" /> Rewards
          </TabsTrigger>
          <TabsTrigger value="redemptions">
            <Search className="h-4 w-4 mr-1" /> Redemptions
          </TabsTrigger>
          <TabsTrigger value="freeaccess">
            <HeartHandshake className="h-4 w-4 mr-1" /> Free access
          </TabsTrigger>
          <TabsTrigger value="codes">
            <TicketPercent className="h-4 w-4 mr-1" /> Codes
          </TabsTrigger>
          <TabsTrigger value="community">
            <Megaphone className="h-4 w-4 mr-1" /> Community
          </TabsTrigger>
          <TabsTrigger value="announcements">
            <Bell className="h-4 w-4 mr-1" /> Announcements
          </TabsTrigger>
          <TabsTrigger value="offers">
            <BadgePercent className="h-4 w-4 mr-1" /> Offers
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="tips">
              <Stethoscope className="h-4 w-4 mr-1" /> Weekly tips
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="insights">
              <BarChart3 className="h-4 w-4 mr-1" /> Insights
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="admin">
              <ShieldCheck className="h-4 w-4 mr-1" /> Admin
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="verify" className="mt-6">
          <VerifyTab />
        </TabsContent>
        <TabsContent value="services" className="mt-6">
          <ServicesTab />
        </TabsContent>
        <TabsContent value="restaurants" className="mt-6">
          <RestaurantsTab />
        </TabsContent>
        <TabsContent value="rewards" className="mt-6">
          <RewardsTab />
        </TabsContent>
        <TabsContent value="redemptions" className="mt-6">
          <RedemptionsTab />
        </TabsContent>
        <TabsContent value="freeaccess" className="mt-6">
          <FreeAccessTab />
        </TabsContent>
        <TabsContent value="codes" className="mt-6">
          <MembershipCodesTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="community" className="mt-6">
          <CommunityModerationTab />
        </TabsContent>
        <TabsContent value="announcements" className="mt-6">
          <AnnouncementsTab />
        </TabsContent>
        <TabsContent value="offers" className="mt-6">
          <OffersTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="tips" className="mt-6">
            <TipsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="insights" className="mt-6">
            <InsightsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="admin" className="mt-6">
            <AdminTab myUserId={me?.id ?? ""} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
