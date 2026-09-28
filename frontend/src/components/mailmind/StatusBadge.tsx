import type { Priority, Category, SpamStatus } from "@/types/mailmind";

export function PriorityBadge({ value }: { value: Priority }) {
  return <span className={`status-badge priority-${value.toLowerCase()}`} data-testid={`priority-badge-${value.toLowerCase()}`}>{value}</span>;
}

export function CategoryBadge({ value }: { value: Category }) {
  return <span className="status-badge category-badge" data-testid={`category-badge-${value.toLowerCase()}`}>{value}</span>;
}

export function SpamBadge({ value }: { value: SpamStatus }) {
  return <span className={`status-badge spam-${value.toLowerCase()}`} data-testid={`spam-badge-${value.toLowerCase()}`}>{value}</span>;
}