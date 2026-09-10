import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, HardDrive, Search, ShieldCheck } from "lucide-react";
import { useApp, useUser } from "../context";
import type { Department } from "../types";
import type { StorageStatus } from "../types/storage";
import { formatFileSize, getSystemStorage } from "../lib/storage";
import { Empty, PageHeading } from "../components/common";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { StorageMeter } from "../components/storage/storage-meter";
import { QuotaDialog } from "../components/storage/quota-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
export function StoragePage() {
  const { db } = useApp();
  const user = useUser();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [editing, setEditing] = useState<Department | null>(null);
  const system = getSystemStorage(db);
  const departments = system.departments
    .filter(
      (d) =>
        d.department.name.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "All statuses" || d.status === filter),
    )
    .sort(
      (a, b) =>
        b.usedBytes - a.usedBytes ||
        a.department.name.localeCompare(b.department.name),
    );
  const needsAttention = system.departments.filter(
    (d) => d.status !== "Normal",
  ).length;
  return (
    <>
      <PageHeading
        eyebrow="SPACE TO KEEP MOVING"
        title="Storage overview"
        description="Understand your storage, plan capacity, and keep every department moving."
      />
      <Card className="mb-6 bg-gradient-to-br from-white to-emerald-50/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="department-icon green">
              <HardDrive size={22} />
            </span>
            <div>
              <h2>System storage</h2>
              <p className="muted">Across all departments and folders</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-3xl font-semibold tracking-tight">
                {formatFileSize(system.usedBytes)}{" "}
                <span className="text-lg font-normal text-slate-400">
                  / {formatFileSize(system.capacityBytes)}
                </span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Used / total configured capacity
              </p>
            </div>
            <div>
              <strong className="text-xl">
                {formatFileSize(system.remainingBytes)}
              </strong>
              <p className="mt-1 text-xs text-slate-500">Available storage</p>
            </div>
          </div>
          <StorageMeter usage={system} label="Total system storage usage" />
        </CardContent>
      </Card>
      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        {[
          [
            "Total files",
            system.fileCount.toLocaleString(),
            "Across the entire workspace",
          ],
          [
            "Largest department",
            system.largestDepartment?.department.name ?? "No files yet",
            system.largestDepartment
              ? `${formatFileSize(system.largestDepartment.usedBytes)} used`
              : "Upload files to get started",
          ],
          [
            "Departments needing attention",
            `${needsAttention} of ${system.departments.length}`,
            "Warning, critical, or full",
          ],
        ].map(([label, value, note]) => (
          <Card key={label}>
            <CardHeader>
              <p className="text-xs text-slate-500">{label}</p>
              <strong className="text-lg">{value}</strong>
              <p className="text-xs text-slate-500">{note}</p>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2>Storage by department</h2>
              <p className="muted">
                Calculated from the files in each department.
              </p>
            </div>
            {user.role === "Executive" && (
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck size={15} />
                Read-only access
              </span>
            )}
          </div>
        </CardHeader>
        <div className="table-tools">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search department storage"
              placeholder="Find a department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44" aria-label="Filter storage status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All statuses">All statuses</SelectItem>
              {(
                [
                  "Normal",
                  "Warning",
                  "Critical",
                  "Full",
                ] satisfies StorageStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {departments.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Usage & status</TableHead>
                <TableHead>Files</TableHead>
                {user.role === "Admin" && (
                  <TableHead>Quota management</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.department.id}>
                  <TableCell>
                    <Link
                      to={`/departments/${d.department.id}`}
                      className="inline-flex items-center gap-2 font-medium text-slate-700"
                    >
                      {d.department.name}
                      <ArrowUpRight size={14} />
                    </Link>
                  </TableCell>
                  <TableCell>{formatFileSize(d.usedBytes)}</TableCell>
                  <TableCell>{formatFileSize(d.capacityBytes)}</TableCell>
                  <TableCell>{formatFileSize(d.remainingBytes)}</TableCell>
                  <TableCell>
                    <div className="min-w-36">
                      <StorageMeter
                        usage={d}
                        label={`${d.department.name} storage usage`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{d.fileCount}</TableCell>
                  {user.role === "Admin" && (
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Edit quota for ${d.department.name}`}
                        onClick={() => setEditing(d.department)}
                      >
                        Edit quota
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty
            title="No departments found"
            description="Try a different search or storage status."
          />
        )}
        <div className="border-t p-5 text-xs leading-6 text-slate-500">
          <p>
            Normal: under 80% · Warning: 80–94.99% · Critical: 95–99.99% · Full:
            100% or more.
          </p>
          <p>
            Allocated department limits:{" "}
            {formatFileSize(system.allocatedQuotaBytes)}. Quotas share the
            system capacity and do not reserve space.
            {system.allocatedQuotaBytes > system.capacityBytes &&
              " Combined quotas exceed system capacity; available system space also limits uploads."}
          </p>
        </div>
      </Card>
      {editing && (
        <QuotaDialog
          key={editing.id}
          department={
            db.departments.find((d) => d.id === editing.id) ?? editing
          }
          close={() => setEditing(null)}
        />
      )}
    </>
  );
}
