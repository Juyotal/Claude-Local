import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

// Mock CodeBlock to avoid react-syntax-highlighter complexity in tests
vi.mock("@/components/CodeBlock", () => ({
  default: ({
    children,
    language,
  }: {
    children: string;
    language: string;
  }) => (
    <div data-testid="code-block" data-language={language}>
      <button aria-label="Copy code">Copy</button>
      <code>{children}</code>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MarkdownRenderer", () => {
  it("renders plain paragraph text", () => {
    render(<MarkdownRenderer content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders bold text via double asterisks", () => {
    render(<MarkdownRenderer content="**bold**" />);
    const el = document.querySelector("strong");
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe("bold");
  });

  it("renders a fenced code block with Copy button", () => {
    render(
      <MarkdownRenderer content={"```js\nconsole.log('hello')\n```"} />
    );
    expect(screen.getByTestId("code-block")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("passes the language to CodeBlock", () => {
    render(<MarkdownRenderer content={"```python\nprint('hi')\n```"} />);
    const block = screen.getByTestId("code-block");
    expect(block).toHaveAttribute("data-language", "python");
  });

  it("renders a fenced code block without a language label", () => {
    render(<MarkdownRenderer content={"```\nplain code\n```"} />);
    expect(screen.getByTestId("code-block")).toBeInTheDocument();
  });

  it("renders inline code with a <code> element", () => {
    render(<MarkdownRenderer content="Use `npm install` to install" />);
    const inline = document.querySelector("code");
    expect(inline).toBeTruthy();
    expect(inline?.textContent).toBe("npm install");
  });

  it("renders a GFM table", () => {
    const table = "| Name | Age |\n|------|-----|\n| Alice | 30 |";
    render(<MarkdownRenderer content={table} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders a GFM task list", () => {
    render(
      <MarkdownRenderer content={"- [x] Done\n- [ ] Todo"} />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("renders headings with correct hierarchy", () => {
    render(<MarkdownRenderer content={"# H1\n\n## H2\n\n### H3"} />);
    expect(document.querySelector("h1")).toBeTruthy();
    expect(document.querySelector("h2")).toBeTruthy();
    expect(document.querySelector("h3")).toBeTruthy();
  });
});
