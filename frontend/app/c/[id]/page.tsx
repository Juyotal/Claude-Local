import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ChatPane from "@/components/ChatPane";
import NewConversationRedirect from "@/components/NewConversationRedirect";
import { getConversation } from "@/lib/api";

interface Props {
  params: { id: string };
}

export default async function ConversationPage({ params }: Props) {
  if (params.id === "new") {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <NewConversationRedirect />
      </div>
    );
  }

  let conversation;
  try {
    conversation = await getConversation(params.id);
  } catch {
    notFound();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <ChatPane conversation={conversation} />
    </div>
  );
}
