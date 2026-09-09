import { lazy, Suspense, useState } from "react";
import { HardDrive, SlidersHorizontal } from "lucide-react";
import { useApp, useUser } from "../../context";
import { formatFileSize, getDepartmentStorage } from "../../lib/storage";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { StorageMeter } from "./storage-meter";
const QuotaDialog = lazy(() =>
  import("./quota-dialog").then((module) => ({ default: module.QuotaDialog })),
);
export function DepartmentStorage({ departmentId }: { departmentId: string }) {
  const { db } = useApp();
  const user = useUser();
  const [editing, setEditing] = useState(false);
  const usage = getDepartmentStorage(db, departmentId);
  return (
    <Card className="mb-7">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2">
            <HardDrive size={18} className="text-primary" />
            Department storage
          </h2>
          {user.role === "Admin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <SlidersHorizontal size={14} />
              Edit quota
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="mb-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {[
            ["Used", formatFileSize(usage.usedBytes)],
            ["Storage quota", formatFileSize(usage.capacityBytes)],
            ["Remaining", formatFileSize(usage.remainingBytes)],
            ["Total files", usage.fileCount.toLocaleString()],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-1 text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <StorageMeter
          usage={usage}
          label={`${usage.department.name} storage usage`}
        />
      </CardContent>
      {editing && (
        <Suspense
          fallback={
            <p role="status" className="p-4 text-sm text-slate-500">
              Loading quota editor…
            </p>
          }
        >
          <QuotaDialog
            department={usage.department}
            close={() => setEditing(false)}
          />
        </Suspense>
      )}
    </Card>
  );
}
