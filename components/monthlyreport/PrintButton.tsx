"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button size="sm" variant="secondary" className="print:hidden" onClick={() => window.print()}>
      Print / Export PDF
    </Button>
  );
}
