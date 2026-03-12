import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "@/components/Sidebar";
import type { ConversationOut } from "@/types/api";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: "conv-1" }),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  updateConversation: vi.fn(),
}));

import {
  listConversations,
  deleteConversation,
  updateConversation,
} from "@/lib/api";

const CONVERSATIONS: ConversationOut[] = [
  {
    id: "conv-1",
    title: "First conversation",
    model: "claude-sonnet-4-6",
    system_prompt: null,
    web_search_enabled: false,
    updated_at: new Date().toISOString(),
    message_count: 2,
  },
  {
    id: "conv-2",
    title: "Second conversation",
    model: "claude-sonnet-4-6",
    system_prompt: null,
    web_search_enabled: false,
    updated_at: new Date().toISOString(),
    message_count: 0,
  },
];

describe("Sidebar conversation management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listConversations).mockResolvedValue(CONVERSATIONS);
    vi.mocked(deleteConversation).mockResolvedValue(undefined);
    vi.mocked(updateConversation).mockResolvedValue(CONVERSATIONS[0]);
  });

  it("renders conversations loaded from the API", async () => {
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("First conversation")).toBeInTheDocument();
      expect(screen.getByText("Second conversation")).toBeInTheDocument();
    });
  });

  it("filters conversation list by search query", async () => {
    render(<Sidebar />);
    await waitFor(() => screen.getByText("First conversation"));

    await userEvent.type(
      screen.getByRole("textbox", { name: /search/i }),
      "Second"
    );

    expect(screen.queryByText("First conversation")).not.toBeInTheDocument();
    expect(screen.getByText("Second conversation")).toBeInTheDocument();
  });

  it("shows no-match message when search has no results", async () => {
    render(<Sidebar />);
    await waitFor(() => screen.getByText("First conversation"));

    await userEvent.type(
      screen.getByRole("textbox", { name: /search/i }),
      "zzznomatch"
    );

    expect(screen.getByText(/no conversations match/i)).toBeInTheDocument();
  });

  it("shows rename input pre-filled with current title on Rename click", async () => {
    render(<Sidebar />);
    await waitFor(() => screen.getByText("First conversation"));

    const [menuBtn] = screen.getAllByRole("button", { name: /conversation options/i });
    await userEvent.click(menuBtn);
    await userEvent.click(screen.getByText("Rename"));

    expect(screen.getByDisplayValue("First conversation")).toBeInTheDocument();
  });

  it("commits rename optimistically and calls updateConversation", async () => {
    render(<Sidebar />);
    await waitFor(() => screen.getByText("First conversation"));

    const [menuBtn] = screen.getAllByRole("button", { name: /conversation options/i });
    await userEvent.click(menuBtn);
    await userEvent.click(screen.getByText("Rename"));

    const input = screen.getByDisplayValue("First conversation");
    await userEvent.clear(input);
    await userEvent.type(input, "My New Title");
    await userEvent.keyboard("{Enter}");

    // Optimistic update visible immediately
    expect(screen.getByText("My New Title")).toBeInTheDocument();
    expect(updateConversation).toHaveBeenCalledWith("conv-1", {
      title: "My New Title",
    });
  });

  it("rolls back rename on API error", async () => {
    vi.mocked(updateConversation).mockRejectedValue(new Error("Network error"));

    render(<Sidebar />);
    await waitFor(() => screen.getByText("First conversation"));

    const [menuBtn] = screen.getAllByRole("button", { name: /conversation options/i });
    await userEvent.click(menuBtn);
    await userEvent.click(screen.getByText("Rename"));

    const input = screen.getByDisplayValue("First conversation");
    await userEvent.clear(input);
    await userEvent.type(input, "Bad Title");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("First conversation")).toBeInTheDocument();
    });
  });

  it("shows a confirmation dialog when Delete is clicked", async () => {
    render(<Sidebar />);
    await waitFor(() => screen.getByText("First conversation"));

    const [menuBtn] = screen.getAllByRole("button", { name: /conversation options/i });
    await userEvent.click(menuBtn);
    await userEvent.click(screen.getByText("Delete"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();
  });

  it("removes the conversation after confirming delete", async () => {
    render(<Sidebar />);
    await waitFor(() => screen.getByText("First conversation"));

    const [menuBtn] = screen.getAllByRole("button", { name: /conversation options/i });
    await userEvent.click(menuBtn);
    await userEvent.click(screen.getByText("Delete"));

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(deleteConversation).toHaveBeenCalledWith("conv-1");
    await waitFor(() => {
      expect(screen.queryByText("First conversation")).not.toBeInTheDocument();
    });
  });

  it("cancels delete when Cancel is clicked in dialog", async () => {
    render(<Sidebar />);
    await waitFor(() => screen.getByText("First conversation"));

    const [menuBtn] = screen.getAllByRole("button", { name: /conversation options/i });
    await userEvent.click(menuBtn);
    await userEvent.click(screen.getByText("Delete"));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(deleteConversation).not.toHaveBeenCalled();
    expect(screen.getByText("First conversation")).toBeInTheDocument();
  });
});
