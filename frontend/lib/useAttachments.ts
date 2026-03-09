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

export function useAttachments(maxBytes: number, supportedTypes: string[]) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);

  const validate = useCallback(
    (file: File): string | null => {
      if (file.size > maxBytes) {
        const mb = (maxBytes / 1024 / 1024).toFixed(0);
        return `File exceeds ${mb} MB limit`;
      }
      const mt = file.type || "application/octet-stream";
      const ok =
        supportedTypes.includes(mt) ||
        mt.startsWith("text/") ||
        (mt === "application/octet-stream" &&
          supportedTypes.some((t) => t.startsWith("text/")));
      if (!ok) return `Unsupported file type: ${mt}`;
      return null;
    },
    [maxBytes, supportedTypes]
  );

  const uploadOne = useCallback(
    async (uid: string, file: File) => {
      const progressTimer = setInterval(() => {
        setPending((prev) =>
          prev.map((p) =>
            p.uid === uid && p.status === "uploading" && p.progress < 80
              ? { ...p, progress: p.progress + 20 }
              : p
          )
        );
      }, 150);

      try {
        const attachment = await uploadFile(file);
        setPending((prev) =>
          prev.map((p) =>
            p.uid === uid ? { ...p, status: "done", progress: 100, attachment } : p
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setPending((prev) =>
          prev.map((p) =>
            p.uid === uid ? { ...p, status: "error", progress: 0, errorMsg: msg } : p
          )
        );
      } finally {
        clearInterval(progressTimer);
      }
    },
    []
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const toUpload: { uid: string; file: File }[] = [];

      const newItems: PendingAttachment[] = arr.map((file) => {
        const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const validationError = validate(file);
        if (validationError) {
          return { uid, file, status: "error" as const, progress: 0, errorMsg: validationError };
        }
        toUpload.push({ uid, file });
        return { uid, file, status: "uploading" as const, progress: 0 };
      });

      setPending((prev) => [...prev, ...newItems]);

      // Kick off all valid uploads concurrently
      for (const { uid, file } of toUpload) {
        void uploadOne(uid, file);
      }
    },
    [validate, uploadOne]
  );

  const remove = useCallback((uid: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.uid === uid);
      // Hoist the side-effect out of the updater to avoid double-fire in Strict Mode
      if (target?.attachment) {
        setTimeout(() => void deleteUpload(target.attachment!.id), 0);
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
