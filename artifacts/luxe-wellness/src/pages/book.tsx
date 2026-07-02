import { useListServices, useListStaff, useListAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment, getListAppointmentsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, User, Clock, Check, X, ExternalLink, Plus } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export default function Book() {
  const { data: services, isLoading: isLoadingServices } = useListServices();
  const { data: staff, isLoading: isLoadingStaff } = useListStaff();
  const { data: appointments, isLoading: isLoadingAppointments } = useListAppointments();
  
  const queryClient = useQueryClient();
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();
  const deleteAppointment = useDeleteAppointment();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    serviceName: "",
    providerName: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "09:00",
    notes: ""
  });

  const handleAddAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    createAppointment.mutate({ data: { ...formData, status: "upcoming" } }, {
      onSuccess: () => {
        toast.success("Appointment added");
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setIsAddOpen(false);
        setFormData({ ...formData, serviceName: "", providerName: "", notes: "" });
      }
    });
  };

  const handleCancelAppointment = (id: number) => {
    updateAppointment.mutate({ id, data: { status: "cancelled" } }, {
      onSuccess: () => {
        toast.success("Appointment cancelled");
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
      }
    });
  };

  const handleDeleteAppointment = (id: number) => {
    deleteAppointment.mutate({ id }, {
      onSuccess: () => {
        toast.success("Appointment removed");
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary">Booking & Appointments</h1>
        <p className="text-muted-foreground text-lg">Browse our services or track your upcoming visits.</p>
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="appointments">My Appointments</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="team">Our Team</TabsTrigger>
        </TabsList>
        
        <TabsContent value="appointments" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif text-primary">Your Schedule</h2>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  <Plus className="w-4 h-4 mr-1" /> Add Manual Entry
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Track Appointment</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddAppointment} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="serviceName">Service Name</Label>
                    <Input id="serviceName" required value={formData.serviceName} onChange={e => setFormData({...formData, serviceName: e.target.value})} placeholder="e.g. Botox, Fillers" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="providerName">Provider (Optional)</Label>
                    <Input id="providerName" value={formData.providerName} onChange={e => setFormData({...formData, providerName: e.target.value})} placeholder="e.g. Dr. Copley" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Time</Label>
                      <Input id="time" type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input id="notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                  </div>
                  <Button type="submit" className="w-full mt-4" disabled={createAppointment.isPending}>
                    Save Appointment
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingAppointments ? (
            <div className="py-8 text-center text-muted-foreground">Loading appointments...</div>
          ) : appointments && appointments.length > 0 ? (
            <div className="grid gap-4">
              {appointments.map(apt => (
                <Card key={apt.id} className={`overflow-hidden transition-all ${apt.status === 'cancelled' ? 'opacity-50 grayscale bg-muted/50' : ''}`}>
                  <div className={`h-1 w-full ${apt.status === 'upcoming' ? 'bg-primary' : apt.status === 'completed' ? 'bg-accent' : 'bg-destructive'}`} />
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          apt.status === 'upcoming' ? 'bg-primary/10 text-primary' : 
                          apt.status === 'completed' ? 'bg-accent/20 text-accent-foreground' : 
                          'bg-destructive/10 text-destructive'
                        }`}>
                          {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                        </span>
                        <span className="text-sm text-muted-foreground flex items-center">
                          <Calendar className="w-3 h-3 mr-1" /> {format(new Date(apt.date), "MMM d, yyyy")} 
                          {apt.time && <><Clock className="w-3 h-3 ml-2 mr-1" /> {apt.time}</>}
                        </span>
                      </div>
                      <h3 className="text-xl font-serif text-foreground">{apt.serviceName}</h3>
                      {apt.providerName && <p className="text-sm text-muted-foreground mt-1 flex items-center"><User className="w-3 h-3 mr-1" /> {apt.providerName}</p>}
                      {apt.notes && <p className="text-sm mt-2 italic text-muted-foreground/80">{apt.notes}</p>}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {apt.status === 'upcoming' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => updateAppointment.mutate({ id: apt.id, data: { status: 'completed' } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() }) })}>
                            <Check className="w-4 h-4 mr-1" /> Mark Done
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleCancelAppointment(apt.id)}>
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                        </>
                      )}
                      {(apt.status === 'completed' || apt.status === 'cancelled') && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleDeleteAppointment(apt.id)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center border-dashed">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-foreground">No appointments tracked</h3>
              <p className="text-muted-foreground mb-4">You haven't tracked any upcoming appointments yet.</p>
              <Button variant="outline" onClick={() => setIsAddOpen(true)}>Add Manual Entry</Button>
            </Card>
          )}

          <div className="mt-8 p-6 bg-secondary/30 rounded-2xl text-center border border-border">
            <h3 className="font-serif text-xl mb-2 text-primary">Ready for your next treatment?</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">Book directly through our Aesthetic Record portal to secure your spot with our providers.</p>
            <Button className="rounded-full shadow-md" asChild>
              <a href="https://hklqy.myaestheticrecord.com/online-booking" target="_blank" rel="noreferrer">
                Book on Aesthetic Record <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif text-primary">Our Services</h2>
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <a href="https://hklqy.myaestheticrecord.com/online-booking" target="_blank" rel="noreferrer">
                Book Online <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>

          {isLoadingServices ? (
            <div className="py-8 text-center text-muted-foreground">Loading services...</div>
          ) : services && services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map(service => (
                <Card key={service.id} className="h-full flex flex-col hover:border-primary/30 transition-colors">
                  <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-xs font-semibold text-accent uppercase tracking-wider mb-1 block">{service.category}</span>
                        <CardTitle className="font-serif text-xl">{service.name}</CardTitle>
                      </div>
                      {service.priceText && <span className="bg-secondary text-secondary-foreground text-sm font-medium px-2 py-1 rounded-md whitespace-nowrap">{service.priceText}</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between">
                    <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{service.description}</p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                      <span className="text-sm text-muted-foreground flex items-center">
                        <Clock className="w-4 h-4 mr-1.5" /> {service.durationMinutes ? `~${service.durationMinutes} min` : "Varies"}
                      </span>
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 hover:text-primary" asChild>
                        <a href={service.bookingUrl || "https://hklqy.myaestheticrecord.com/online-booking"} target="_blank" rel="noreferrer">
                          Book <ExternalLink className="w-3 h-3 ml-1.5" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No services found.</div>
          )}
        </TabsContent>

        <TabsContent value="team" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif text-primary">Meet The Team</h2>
          </div>

          {isLoadingStaff ? (
            <div className="py-8 text-center text-muted-foreground">Loading team...</div>
          ) : staff && staff.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {staff.map(member => (
                <Card key={member.id} className="overflow-hidden flex flex-col md:flex-row h-full">
                  <div className="md:w-1/3 bg-muted h-48 md:h-auto shrink-0 relative">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary">
                        <User className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-6 flex flex-col">
                    <h3 className="text-xl font-serif text-primary">{member.name}</h3>
                    <p className="text-sm font-medium text-accent mb-3">{member.title}</p>
                    <p className="text-muted-foreground text-sm line-clamp-4 flex-1">{member.bio}</p>
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <Button variant="outline" size="sm" className="w-full rounded-full" asChild>
                        <a href={member.bookingUrl || "https://hklqy.myaestheticrecord.com/online-booking"} target="_blank" rel="noreferrer">
                          Book with {member.name.split(' ')[0]} <ExternalLink className="w-3 h-3 ml-1.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No staff members found.</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}