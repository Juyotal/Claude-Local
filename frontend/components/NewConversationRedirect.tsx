"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createConversation } from "@/lib/api";

export default function NewConversationRedirect() {
  const router = useRouter();

  useEffect(() => {
    createConversation()
      .then((conv) => router.replace(`/c/${conv.id}`))
      .catch(() => {
        // Backend not available — stay on the "new" page and show placeholder
      });
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Creating conversation…
    </div>
  );
}
