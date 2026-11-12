"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PrototypeState } from "@/features/papers/components/prototype-state";
import { BankList } from "@/features/qbank/components/bank-list";
import { UploadDialog } from "@/features/qbank/components/upload-dialog";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/mock/store";

export default function QuestionBanksPage() {
  useBreadcrumbs([{ label: "PDF question banks" }]);
  const { state } = useStore();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState(0);
  const uploaderName = (id: string) => (id === (state.session?.staff?.id ?? state.session?.userId) ? "you" : (state.staff.find((u) => u.id === id)?.name ?? `${id.slice(0, 8)}…`));

  return (
    <>
      <PageHeader
        title="PDF question banks"
        description="Upload MCQ PDFs, check what was read, and approve the questions IT papers may use for their Technical section."
        actions={
          supabase && (
            <Button onClick={() => setUploading(true)}>
              <Upload aria-hidden size={16} style={{ marginRight: 6 }} /> Upload PDF
            </Button>
          )
        }
      />
      {supabase ? <BankList uploaderName={uploaderName} version={version} onUpload={() => setUploading(true)} /> : <PrototypeState feature="PDF question banks" />}
      {uploading && (
        <UploadDialog
          onClose={() => setUploading(false)}
          onUploaded={(b) => {
            toast({ tone: "success", title: `${b.name} uploaded`, description: `${b.questionCount} questions read. Review and approve them.` });
            setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
