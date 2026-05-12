"use client";
import { useEffect } from "react";
import { useBackButtonContext } from "@/components/BackButtonProvider";

export default function HideBackButton() {
  const ctx = useBackButtonContext();

  useEffect(() => {
    if (!ctx) return;
    ctx.setHidden(true);
    return () => ctx.setHidden(false);
  }, [ctx]);

  return null;
}
