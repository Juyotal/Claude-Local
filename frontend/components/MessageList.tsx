import type { MessageOut } from "@/types/api";

interface Props {
  messages: MessageOut[];
}

export default function MessageList({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No messages yet. Start a conversation below.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col gap-1 max-w-3xl ${
            msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
          }`}
        >
          <span className="text-xs text-muted-foreground capitalize px-1">
            {msg.role === "user" ? "You" : "Claude"}
          </span>
          <div
            className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {msg.content}
          </div>
          {msg.citations.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1 px-1">
              {msg.citations.map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <span className="truncate max-w-xs">{c.title ?? c.url}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
