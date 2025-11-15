import React, { useEffect, useRef, useState } from "react";
import "../styles/chat.css";

type Message = {
  id: string | number;
  author: "me" | "them";
  text: string;
  time?: string;
};

type ChatScreenProps = {
  messages: Message[];
  onSend: (text: string) => void;
  title?: string;
};

export default function ChatScreen({ messages, onSend, title = "Chat" }: ChatScreenProps) {
  const [text, setText] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) {
      // keep scroll pinned to bottom when messages change
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className="chat-root">
      <header className="chat-header">
        <div className="chat-title">{title}</div>
      </header>

      <div className="chat-messages" ref={messagesRef} role="log" aria-live="polite">
        <div className="chat-inner">
          {messages.map((m) => (
            <div key={m.id} className={`message-row ${m.author === "me" ? "me" : "them"}`}> 
              <div className={`message-bubble ${m.author === "me" ? "me-bubble" : "them-bubble"}`}> 
                <div className="message-text">{m.text}</div>
                {m.time && <div className="message-time">{m.time}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form className="chat-input" onSubmit={submit}> 
        <textarea
          aria-label="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          className="chat-textarea"
        />
        <button type="submit" className="chat-send-btn" aria-label="Send message">
          Send
        </button>
      </form>
    </div>
  );
}