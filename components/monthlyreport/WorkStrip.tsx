import { REPORT_COLORS as C } from "@/lib/reportTheme";

function WorkStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div style={{ font: "400 24px/1 var(--font-dm-serif)", color: C.darkTeal }}>{value}</div>
      <div
        style={{
          font: "600 9.5px/1.3 var(--font-dm-sans)",
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: C.muted,
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function WorkStrip({
  issuesFixed,
  pagesOptimised,
  newPages,
  backlinksBuilt,
  blogPosts,
  gbpPosts,
}: {
  issuesFixed: number;
  pagesOptimised: number;
  newPages: number;
  backlinksBuilt: number;
  blogPosts: number;
  gbpPosts: number;
}) {
  return (
    <div
      className="avoid-break"
      style={{
        padding: "22px 44px",
        background: C.subtleBg,
        borderBottom: `1px solid ${C.border}`,
        display: "grid",
        gridTemplateColumns: "repeat(6,1fr)",
        gap: 14,
      }}
    >
      <WorkStat value={issuesFixed} label="Issues fixed" />
      <WorkStat value={pagesOptimised} label="Pages optimised" />
      <WorkStat value={newPages} label="New pages" />
      <WorkStat value={backlinksBuilt} label="Backlinks built" />
      <WorkStat value={blogPosts} label="Blog posts" />
      <WorkStat value={gbpPosts} label="GBP posts" />
    </div>
  );
}
