import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from "react-native";

import { getBarcodeProduct } from "@workspace/api-client-react";
import type { BarcodeProduct } from "@workspace/api-client-react";

import { Card, LuxeButton, LuxeInput } from "@/components/ui";
import { NutritionFactsLabel } from "@/components/NutritionFactsLabel";
import { useColors } from "@/hooks/useColors";
import { useLogMenuItem } from "@/hooks/useLogMenuItem";
import { Alert } from "@/lib/alert";

type Status = "idle" | "looking" | "found" | "notfound" | "unavailable";

/**
 * Scan a packaged food's barcode (camera on native, typed entry everywhere)
 * → Open Food Facts nutrition → log via the shared meal-type chooser.
 */
export function BarcodeScanCard() {
  const c = useColors();
  const { promptLog, isPending } = useLogMenuItem();
  const [permission, requestPermission] = useCameraPermissions();

  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [manualCode, setManualCode] = useState("");
  const scanLock = useRef(false);

  const canUseCamera = Platform.OS !== "web";

  const lookup = async (code: string) => {
    setStatus("looking");
    setProduct(null);
    try {
      const p = await getBarcodeProduct(code);
      setProduct(p);
      setStatus("found");
    } catch (e) {
      const httpStatus =
        typeof e === "object" && e !== null && "status" in e
          ? (e as { status?: unknown }).status
          : null;
      setStatus(httpStatus === 404 || httpStatus === 400 ? "notfound" : "unavailable");
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          "Camera access needed",
          "Allow camera access in Settings to scan barcodes, or type the barcode number instead.",
        );
        return;
      }
    }
    scanLock.current = false;
    setCameraOpen(true);
  };

  const handleScanned = (data: string) => {
    if (scanLock.current) return;
    const digits = data.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 14) return;
    scanLock.current = true;
    setCameraOpen(false);
    void lookup(digits);
  };

  const handleManualLookup = () => {
    const digits = manualCode.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 14) {
      setStatus("notfound");
      return;
    }
    void lookup(digits);
  };

  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
        Scan a packaged food's barcode to log it with nutrition from Open Food Facts.
      </Text>

      {canUseCamera ? (
        <LuxeButton label="Scan barcode" onPress={() => void openCamera()} />
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <LuxeInput
            placeholder="Barcode number, e.g. 049000006346"
            keyboardType="number-pad"
            value={manualCode}
            onChangeText={setManualCode}
            onSubmitEditing={handleManualLookup}
            returnKeyType="search"
          />
        </View>
        <Pressable
          onPress={handleManualLookup}
          disabled={manualCode.replace(/\D/g, "").length < 6}
          hitSlop={8}
          style={{
            backgroundColor: c.secondary,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            opacity: manualCode.replace(/\D/g, "").length < 6 ? 0.5 : 1,
          }}
        >
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
            Look up
          </Text>
        </Pressable>
      </View>

      {status === "looking" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
          <ActivityIndicator size="small" color={c.tint} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            Looking up product…
          </Text>
        </View>
      ) : null}

      {status === "notfound" || status === "unavailable" ? (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: c.mutedForeground,
            textAlign: "center",
            paddingVertical: 4,
          }}
        >
          {status === "notfound"
            ? "We couldn't find that barcode. Try again or add the food manually above."
            : "The barcode database is temporarily unavailable. Please try again in a moment."}
        </Text>
      ) : null}

      {status === "found" && product ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="check-circle" size={16} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                {product.name}
              </Text>
              {product.brand ? (
                <Text
                  style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}
                >
                  {product.brand}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
            Nutrition from Open Food Facts ·{" "}
            {product.perServing
              ? `per serving${product.servingSize ? ` (${product.servingSize})` : ""}`
              : "per 100 g"}
          </Text>
          <NutritionFactsLabel
            servingLabel={
              product.perServing
                ? `Per serving${product.servingSize ? ` · ${product.servingSize}` : ""}`
                : "Per 100 g"
            }
            values={{
              calories: product.calories,
              proteinG: product.proteinG,
              carbsG: product.carbsG,
              fatG: product.fatG,
              satFatG: product.satFatG,
              fiberG: product.fiberG,
              sugarG: product.sugarG,
              sodiumMg: product.sodiumMg,
              cholesterolMg: null,
            }}
          />
          <LuxeButton
            label="Log this food"
            loading={isPending}
            onPress={() =>
              promptLog({
                name: product.name,
                restaurantName: product.brand ?? undefined,
                calories: product.calories,
                proteinG: product.proteinG,
                carbsG: product.carbsG,
                fatG: product.fatG,
                satFatG: product.satFatG,
                fiberG: product.fiberG,
                sugarG: product.sugarG,
                sodiumMg: product.sodiumMg,
                servingSize: product.servingSize,
              })
            }
          />
        </View>
      ) : null}

      {canUseCamera ? (
        <Modal
          visible={cameraOpen}
          animationType="slide"
          onRequestClose={() => setCameraOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
              onBarcodeScanned={({ data }) => handleScanned(data)}
            />
            <View
              style={{
                position: "absolute",
                top: 60,
                left: 0,
                right: 0,
                alignItems: "center",
                paddingHorizontal: 24,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                  color: "#FFFFFF",
                  textAlign: "center",
                }}
              >
                Point your camera at the barcode
              </Text>
            </View>
            <View style={{ position: "absolute", bottom: 48, left: 0, right: 0, alignItems: "center" }}>
              <Pressable
                onPress={() => setCameraOpen(false)}
                hitSlop={8}
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 999,
                }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#FFFFFF" }}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </Card>
  );
}
