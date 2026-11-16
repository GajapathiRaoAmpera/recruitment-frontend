"use client";

import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DemoNote, hire as h } from "@/components/hire/ui";
import { MAX_TAB_SWITCHES, useStore } from "@/mock/store";
import type { AiPrompt } from "@/mock/types";

export function AiSettingsScreen() {
  useBreadcrumbs([{ label: "AI settings" }]);
  const { state } = useStore();
  return (
    <div className={h.stack}>
      <PageHeader title="AI settings & prompts" description="Only Super Admins can see or change prompts. Every change creates a new version and is audited." />
      <div className={h.grid2}>
        <section className={h.card}>
          <h2 className={h.cardTitle} style={{ marginBottom: 16 }}>
            Models
          </h2>
          <div className={h.stackSm}>
            <Field label="Interview model" hint="Gemini Live API (free tier). The browser gets a short-lived token, never the key.">
              <Select defaultValue="gemini-live">
                <option value="gemini-live">Gemini Live (free tier)</option>
              </Select>
            </Field>
            <Field label="Question generation model">
              <Select defaultValue="gemini-flash">
                <option value="gemini-flash">Gemini Flash</option>
              </Select>
            </Field>
            <Field label="Max questions per generation">
              <Input type="number" defaultValue={20} min={1} max={50} />
            </Field>
          </div>
        </section>
        <section className={h.card}>
          <h2 className={h.cardTitle} style={{ marginBottom: 16 }}>
            Test integrity & resume analyser
          </h2>
          <ul className={h.list}>
            <li className={h.listItem}>
              <span>Tab switches before a test closes</span>
              <Badge tone="primary">{MAX_TAB_SWITCHES}</Badge>
            </li>
            <li className={h.listItem}>
              <span>Full screen required</span>
              <Badge tone="success">On</Badge>
            </li>
            <li className={h.listItem}>
              <span>Location + terms before every round</span>
              <Badge tone="success">On</Badge>
            </li>
            <li className={h.listItem}>
              <span>Resume analyser</span>
              <Badge>Local OCR/PDF · no AI</Badge>
            </li>
          </ul>
        </section>
      </div>
      <h2 className={h.cardTitle}>Prompts</h2>
      {state.prompts.map((p) => (
        <PromptEditor key={p.key} prompt={p} />
      ))}
      <DemoNote>Prototype: settings fields are not saved; prompt edits are kept for this session.</DemoNote>
    </div>
  );
}

function PromptEditor({ prompt }: { prompt: AiPrompt }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [body, setBody] = useState(prompt.body);
  return (
    <section className={h.card}>
      <div className={h.cardHead}>
        <div>
          <p style={{ fontWeight: 500 }}>{prompt.label}</p>
          <p className={h.mono}>{prompt.key}</p>
        </div>
        <Badge>v{prompt.version}</Badge>
      </div>
      <Field label="Prompt">
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <Button
        size="sm"
        style={{ marginTop: 12 }}
        disabled={body === prompt.body}
        onClick={() => {
          dispatch({ type: "updatePrompt", key: prompt.key, body });
          toast({ tone: "success", title: `Saved ${prompt.key} v${prompt.version + 1}` });
        }}
      >
        Save new version
      </Button>
    </section>
  );
}
