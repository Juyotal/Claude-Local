"use client";

import { useState, useCallback } from "react";
import { uploadFile, deleteUpload } from "@/lib/api";
import type { AttachmentOut } from "@/types/api";

export interface PendingAttachment {
  uid: string;
  file: File;
  status: "uploading" | "done" | "error";
  progress: number;
  errorMsg?: string;
  attachment?: AttachmentOut;
}

export function useAttachments(
  maxBytes: number,
  supportedTypes: string[]
) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);

  const validate = useCallback(
    (file: File): string | null => {
      if (file.size > maxBytes) {
        const mb = (maxBytes / 1024 / 1024).toFixed(0);
        return `File exceeds ${mb} MB limit`;
      }
      // Accept if media type matches or if text/* fallback
      const mt = file.type || "application/octet-stream";
      const ok =
        supportedTypes.includes(mt) ||
        mt.startsWith("text/") ||
        supportedTypes.some((t) => t.startsWith("text/") && mt === "application/octet-stream");
      if (!ok) return `Unsupported file type: ${mt}`;
      return null;
    },
    [maxBytes, supportedTypes]
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      for (const file of arr) {
        const validationError = validate(file);
        const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        if (validationError) {
          setPending((prev) => [
            ...prev,
            { uid, file, status: "error", progress: 0, errorMsg: validationError },
          ]);
          continue;
        }

        setPending((prev) => [
          ...prev,
          { uid, file, status: "uploading", progress: 0 },
        ]);

        try {
          // Simulate incremental progress since fetch doesn't expose it
          const progressTimer = setInterval(() => {
            setPending((prev) =>
              prev.map((p) =>
                p.uid === uid && p.status === "uploading" && p.progress < 80
                  ? { ...p, progress: p.progress + 20 }
                  : p
              )
            );
          }, 150);

          const attachment = await uploadFile(file);
          clearInterval(progressTimer);

          setPending((prev) =>
            prev.map((p) =>
              p.uid === uid
                ? { ...p, status: "done", progress: 100, attachment }
                : p
            )
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          setPending((prev) =>
            prev.map((p) =>
              p.uid === uid
                ? { ...p, status: "error", progress: 0, errorMsg: msg }
                : p
            )
          );
        }
      }
    },
    [validate]
  );

  const remove = useCallback(async (uid: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.uid === uid);
      if (target?.attachment) {
        void deleteUpload(target.attachment.id);
      }
      return prev.filter((p) => p.uid !== uid);
    });
  }, []);

  const clear = useCallback(() => {
    setPending([]);
  }, []);

  const readyIds = pending
    .filter((p) => p.status === "done" && p.attachment)
    .map((p) => p.attachment!.id);

  const isUploading = pending.some((p) => p.status === "uploading");

  return { pending, addFiles, remove, clear, readyIds, isUploading };
}
