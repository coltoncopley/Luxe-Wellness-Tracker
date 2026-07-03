import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { FoodTab } from "@/components/track/FoodTab";
import { GlowTab } from "@/components/track/GlowTab";
import { WeightTab } from "@/components/track/WeightTab";
import { Screen, Segmented } from "@/components/ui";

export default function TrackScreen() {
  const [tab, setTab] = useState("weight");
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };

  return (
    <Screen title="Track" subtitle="Your daily wellness log" refreshing={refreshing} onRefresh={onRefresh}>
      <Segmented
        options={[
          { key: "weight", label: "Weight" },
          { key: "glow", label: "Glow" },
          { key: "food", label: "Food" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "weight" ? <WeightTab /> : tab === "glow" ? <GlowTab /> : <FoodTab />}
    </Screen>
  );
}
