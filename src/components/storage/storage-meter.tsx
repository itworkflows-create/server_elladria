import type { StorageStatus, StorageUsage } from "../../types/storage";
import { formatFileSize } from "../../lib/storage";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
const colors: Record<StorageStatus, string> = {
  Normal: "bg-emerald-600",
  Warning: "bg-amber-500",
  Critical: "bg-orange-600",
  Full: "bg-red-600",
};
export function StorageStatusBadge({ status }: { status: StorageStatus }) {
  return (
    <Badge
      variant={
        (
          {
            Normal: "default",
            Warning: "warning",
            Critical: "critical",
            Full: "destructive",
          } as const
        )[status]
      }
    >
      {status}
    </Badge>
  );
}
export function StorageMeter({
  usage,
  label,
}: {
  usage: StorageUsage;
  label: string;
}) {
  // Keep rounded display below the next threshold so 94.999% isn't labeled 95% Warning.
  const percentage = Math.floor(usage.usagePercentage * 100) / 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">
          {percentage.toLocaleString("en-US", { maximumFractionDigits: 2 })}%
          used
        </span>
        <StorageStatusBadge status={usage.status} />
      </div>
      <Progress
        value={usage.usagePercentage}
        aria-label={label}
        getValueLabel={() =>
          `${percentage}% used. ${formatFileSize(usage.remainingBytes)} remaining.`
        }
        indicatorClassName={colors[usage.status]}
      />
    </div>
  );
}
