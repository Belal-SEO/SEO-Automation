import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/crawler/EmptyState";
import type { GscTopItem } from "@/lib/googleReporting";

export function GscTopTable({ items, labelHeader }: { items: GscTopItem[]; labelHeader: string }) {
  if (items.length === 0) {
    return <EmptyState title="No data yet" description="Nothing recorded for this period." />;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>{labelHeader}</Th>
          <Th>Clicks</Th>
          <Th>Impressions</Th>
          <Th>CTR</Th>
          <Th>Avg. position</Th>
        </Tr>
      </Thead>
      <Tbody>
        {items.map((item) => (
          <Tr key={item.label}>
            <Td className="max-w-sm truncate" title={item.label}>
              {item.label}
            </Td>
            <Td>{item.clicks}</Td>
            <Td>{item.impressions}</Td>
            <Td>{(item.ctr * 100).toFixed(1)}%</Td>
            <Td>{item.position.toFixed(1)}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
