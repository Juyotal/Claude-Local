import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MessageList from "@/components/MessageList";
import type { DisplayMessage } from "@/lib/useChat";

vi.mock("@/lib/api", () => ({
  attachmentUrl: (id: string) => `/api/attachments/${id}`,
}));

// Render content as-is so we can inspect injected footnote markers
vi.mock("@/components/MarkdownRenderer", () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

function makeMsg(overrides: Partial<DisplayMessage> = {}): DisplayMessage {
  return {
    id: "msg-1",
    role: "assistant",
    content: "Paris is the capital of France.",
    isStreaming: false,
    error: null,
    citations: [],
    attachments: [],
    searchStatus: "idle",
    ...overrides,
  };
}

describe("Citations display", () => {
  it("renders a Sources section when citations are present", () => {
    const msg = makeMsg({
      citations: [
        {
          id: "c1",
          url: "https://en.wikipedia.org/wiki/Paris",
          title: "Paris – Wikipedia",
          cited_text: "Paris is the capital of France.",
          start_index: null,
          end_index: null,
        },
      ],
    });

    render(<MessageList messages={[msg]} />);

    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Paris – Wikipedia")).toBeInTheDocument();
  });

  it("shows the domain when citation title is null", () => {
    const msg = makeMsg({
      citations: [
        {
          id: "c1",
          url: "https://news.bbc.co.uk/article",
          title: null,
          cited_text: null,
          start_index: null,
          end_index: null,
        },
      ],
    });

    render(<MessageList messages={[msg]} />);
    expect(screen.getByText("news.bbc.co.uk")).toBeInTheDocument();
  });

  it("injects [^n] footnote markers at citation end positions", () => {
    const content = "Paris is beautiful.";
    const msg = makeMsg({
      content,
      citations: [
        {
          id: "c1",
          url: "https://example.com",
          title: "Example",
          cited_text: "Paris",
          start_index: 0,
          end_index: 5,
        },
      ],
    });

    render(<MessageList messages={[msg]} />);

    const md = screen.getByTestId("markdown");
    expect(md.textContent).toContain("[^1]");
  });

  it("handles multiple citations with markers in correct order", () => {
    const content = "Paris is beautiful. France is lovely.";
    const msg = makeMsg({
      content,
      citations: [
        {
          id: "c1",
          url: "https://a.com",
          title: "Source A",
          cited_text: "Paris",
          start_index: 0,
          end_index: 5,
        },
        {
          id: "c2",
          url: "https://b.com",
          title: "Source B",
          cited_text: "France",
          start_index: 20,
          end_index: 26,
        },
      ],
    });

    render(<MessageList messages={[msg]} />);

    const md = screen.getByTestId("markdown");
    expect(md.textContent).toContain("[^1]");
    expect(md.textContent).toContain("[^2]");
    expect(screen.getByText("Source A")).toBeInTheDocument();
    expect(screen.getByText("Source B")).toBeInTheDocument();
  });

  it("shows 'Searching the web…' indicator when searchStatus is searching", () => {
    const msg = makeMsg({ isStreaming: true, searchStatus: "searching" });

    render(<MessageList messages={[msg]} />);
    expect(screen.getByText(/searching the web/i)).toBeInTheDocument();
  });

  it("shows read result count when searchStatus is read", () => {
    const msg = makeMsg({ searchStatus: "read", searchResultCount: 4 });

    render(<MessageList messages={[msg]} />);
    expect(screen.getByText(/read 4 results/i)).toBeInTheDocument();
  });

  it("uses singular 'result' for count of 1", () => {
    const msg = makeMsg({ searchStatus: "read", searchResultCount: 1 });

    render(<MessageList messages={[msg]} />);
    expect(screen.getByText(/read 1 result$/i)).toBeInTheDocument();
  });

  it("does not render Sources section when no citations", () => {
    const msg = makeMsg({ citations: [] });
    render(<MessageList messages={[msg]} />);
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
  });

  it("renders attachment pills above user message text", () => {
    const userMsg: DisplayMessage = {
      id: "u1",
      role: "user",
      content: "Here is my file.",
      isStreaming: false,
      error: null,
      citations: [],
      attachments: [
        { id: "a1", filename: "notes.txt", media_type: "text/plain", size_bytes: 512 },
      ],
      searchStatus: "idle",
    };

    render(<MessageList messages={[userMsg]} />);

    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /notes\.txt/i });
    expect(link).toHaveAttribute("href", "/api/attachments/a1");
  });
});
