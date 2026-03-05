import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Composer from "@/components/Composer";

function renderComposer(props?: Partial<Parameters<typeof Composer>[0]>) {
  const defaults = {
    isStreaming: false,
    onSend: vi.fn(),
    onStop: vi.fn(),
  };
  return render(<Composer {...defaults} {...props} />);
}

describe("Composer", () => {
  it("renders a textarea and send button when not streaming", () => {
    renderComposer();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("sends on Enter and clears the textarea", async () => {
    const onSend = vi.fn();
    renderComposer({ onSend });
    const textarea = screen.getByRole("textbox");

    await userEvent.type(textarea, "Hello world");
    await userEvent.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith("Hello world");
    expect(textarea).toHaveValue("");
  });

  it("inserts a newline on Shift+Enter without calling onSend", async () => {
    const onSend = vi.fn();
    renderComposer({ onSend });
    const textarea = screen.getByRole("textbox");

    await userEvent.type(textarea, "Hello");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("Hello\n");
  });

  it("does not send when textarea is empty", async () => {
    const onSend = vi.fn();
    renderComposer({ onSend });

    await userEvent.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("trims whitespace before sending", async () => {
    const onSend = vi.fn();
    renderComposer({ onSend });
    const textarea = screen.getByRole("textbox");

    await userEvent.type(textarea, "  spaced  ");
    await userEvent.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith("spaced");
  });

  it("shows Stop button instead of Send while streaming", () => {
    renderComposer({ isStreaming: true });
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
  });

  it("calls onStop when Stop button is clicked", async () => {
    const onStop = vi.fn();
    renderComposer({ isStreaming: true, onStop });

    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("does not call onSend while streaming even if Enter is pressed", async () => {
    const onSend = vi.fn();
    renderComposer({ isStreaming: true, onSend });
    const textarea = screen.getByRole("textbox");

    await userEvent.type(textarea, "hello");
    await userEvent.keyboard("{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });
});
