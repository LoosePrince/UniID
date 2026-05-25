/**
 * Embed iframe 专用 layout：去除 marketing header/footer。
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full">{children}</div>;
}
