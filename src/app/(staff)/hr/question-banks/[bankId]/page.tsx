"use client";

import { useParams } from "next/navigation";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PrototypeState } from "@/features/papers/components/prototype-state";
import { BankDetail } from "@/features/qbank/components/bank-detail";
import { supabase } from "@/lib/supabase";

export default function QuestionBankPage() {
  const { bankId } = useParams<{ bankId: string }>();
  useBreadcrumbs([{ label: "PDF question banks", href: "/hr/question-banks" }, { label: "Bank" }]);
  return supabase ? <BankDetail id={bankId} /> : <PrototypeState feature="PDF question banks" />;
}
