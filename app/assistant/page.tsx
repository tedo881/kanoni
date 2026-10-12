import type { Metadata } from "next";
import Chat from "@/components/Chat";

export const metadata: Metadata = { title: "AI ასისტენტი" };

export default function Assistant() {
  return (
    <>
      <h1 className="reader-title">AI ასისტენტი</h1>
      <p className="lead" style={{ marginTop: 0, textAlign: "center", marginInline: "auto" }}>
        დასვით კითხვა თქვენი სიტყვებით. ასისტენტი პოულობს შესაბამის კანონებს და ნიკოდიმოსის განმარტებებს და მხოლოდ მათზე დაყრდნობით გიპასუხებთ, წყაროების მითითებით.
      </p>
      <Chat />
    </>
  );
}
