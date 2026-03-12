import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Composer from "@/components/Composer";

vi.mock("@/lib/api", () => ({
  uploadFile: vi.fn(),
  deleteUpload: vi.fn(),
  attachmentUrl: (id: string) => `/api/attachments/${id}`,
}));

import { uploadFile, deleteUpload } from "@/lib/api";

const RESOLVED_ATTACHMENT = {
  id: "att-1",
  filename: "report.pdf",
  media_type: "application/pdf",
  size_bytes: 2048,
};

function renderComposer(overrides: Partial<Parameters<typeof Composer>[0]> = {}) {
  return render(
    <Composer
      isStreaming={false}
      onSend={vi.fn()}
      onStop={vi.fn()}
      maxUploadBytes={26214400}
      supportedMediaTypes={["application/pdf", "text/plain", "image/png"]}
      {...overrides}
    />
  );
}

describe("Composer upload pill lifecycle", () => {
  beforeEach(() => {
    vi.mocked(uploadFile).mockResolvedValue(RESOLVED_ATTACHMENT);
    vi.mocked(deleteUpload).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a pill when a valid file is selected", async () => {
    renderComposer();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["pdf content"], "report.pdf", { type: "application/pdf" });

    await userEvent.upload(input, file);

    // Pill appears immediately (optimistic "uploading" state)
    await waitFor(() =>
      expect(screen.getByText("report.pdf")).toBeInTheDocument()
    );
  });

  it("removes the pill and calls deleteUpload when x is clicked after upload completes", async () => {
    renderComposer();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "report.pdf", { type: "application/pdf" });

    await userEvent.upload(input, file);
    await waitFor(() => expect(screen.getByText("report.pdf")).toBeInTheDocument());
    await waitFor(() => expect(uploadFile).toHaveBeenCalledOnce());

    await userEvent.click(screen.getByRole("button", { name: /remove report\.pdf/i }));

    await waitFor(() =>
      expect(screen.queryByText("report.pdf")).not.toBeInTheDocument()
    );
    // deleteUpload is deferred via setTimeout(0) to avoid Strict Mode double-fire
    await act(() => Promise.resolve());
    expect(deleteUpload).toHaveBeenCalledWith("att-1");
  });

  it("shows an error pill for files exceeding the size limit without uploading", async () => {
    renderComposer({ maxUploadBytes: 100 });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File(["x".repeat(200)], "huge.pdf", { type: "application/pdf" });

    await userEvent.upload(input, bigFile);

    await waitFor(() => expect(screen.getByText("huge.pdf")).toBeInTheDocument());
    expect(screen.getByText(/exceeds/i)).toBeInTheDocument();
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("shows an error pill for unsupported mime types without uploading", async () => {
    renderComposer();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(["data"], "video.mp4", { type: "video/mp4" });

    await userEvent.upload(input, badFile);

    await waitFor(() => expect(screen.getByText("video.mp4")).toBeInTheDocument());
    expect(screen.getByText(/unsupported/i)).toBeInTheDocument();
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("passes attachment IDs to onSend and clears pills after send", async () => {
    const onSend = vi.fn();
    renderComposer({ onSend });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "report.pdf", { type: "application/pdf" });

    await userEvent.upload(input, file);
    await waitFor(() => expect(uploadFile).toHaveBeenCalledOnce());

    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Summarize this");
    await userEvent.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith("Summarize this", ["att-1"]);
    await waitFor(() =>
      expect(screen.queryByText("report.pdf")).not.toBeInTheDocument()
    );
  });
});
