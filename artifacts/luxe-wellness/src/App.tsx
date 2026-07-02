import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/dashboard";
import Book from "@/pages/book";
import Weight from "@/pages/weight";
import Food from "@/pages/food";
import Restaurants from "@/pages/restaurants";
import LuxeAI from "@/pages/luxe-ai";
import Glow from "@/pages/glow";
import Rewards from "@/pages/rewards";
import StaffVerify from "@/pages/staff-verify";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/book" component={Book} />
        <Route path="/weight" component={Weight} />
        <Route path="/food" component={Food} />
        <Route path="/restaurants" component={Restaurants} />
        <Route path="/luxe-ai" component={LuxeAI} />
        <Route path="/glow" component={Glow} />
        <Route path="/rewards" component={Rewards} />
        <Route path="/staff" component={StaffVerify} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <SonnerToaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
