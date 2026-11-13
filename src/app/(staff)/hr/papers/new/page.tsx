"use client";

import type { ComponentProps } from "react";
import { NewPaperScreen } from "@/features/papers/new-paper-screen";

export default function NewPaperPage(props: ComponentProps<typeof NewPaperScreen>) {
  return <NewPaperScreen {...props} />;
}
