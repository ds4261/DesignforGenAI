import type { ReactNode } from "react";

export default function Easel({ children }: { children: ReactNode }) {
  return <div className="studio-easel compact-easel">
    <div className="easel-crown" aria-hidden="true" />
    <div className="easel-canvas">{children}</div>
    <div className="easel-ledge" aria-hidden="true" />
    <div className="easel-legs" aria-hidden="true"><span /><span /></div>
  </div>;
}
