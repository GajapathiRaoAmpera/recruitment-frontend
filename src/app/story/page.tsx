import type { Metadata } from "next";
import { StoryBoard } from "@/features/story/story-board";

// Public on purpose: no (staff)/(student) guard, so anyone can watch how a drive runs.
export const metadata: Metadata = { title: "How a drive runs" };

export default function StoryPage() {
  return <StoryBoard />;
}
