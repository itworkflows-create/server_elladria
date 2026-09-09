import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApp, useUser } from "../../context";
import type { Department } from "../../types";
import {
  formatFileSize,
  GB,
  MB,
  getDepartmentStorage,
} from "../../lib/storage";
import { Modal } from "../ui/dialog";
import { Button } from "../ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";
const schema = z
  .object({
    quota: z.coerce.number().positive("Enter a quota greater than zero."),
    unit: z.enum(["MB", "GB"]),
  })
  .superRefine((values, ctx) => {
    if (!Number.isSafeInteger(values.quota * (values.unit === "GB" ? GB : MB)))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quota"],
        message: "Quota must resolve to a safe whole number of bytes.",
      });
  });
export function QuotaDialog({
  department,
  close,
}: {
  department: Department;
  close: () => void;
}) {
  const { db, run, pending } = useApp();
  const user = useUser();
  const unit = department.storageQuotaBytes >= GB ? "GB" : "MB";
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      quota: department.storageQuotaBytes / (unit === "GB" ? GB : MB),
      unit,
    },
  });
  const usage = getDepartmentStorage(db, department.id);
  const values = watch();
  const nextBytes = Number(values.quota) * (values.unit === "GB" ? GB : MB);
  if (user.role !== "Admin") return null;
  return (
    <Modal
      open
      onOpenChange={close}
      title="Edit storage quota"
      description={`Set the storage limit for ${department.name}.`}
    >
      <form
        className="form-stack"
        onSubmit={handleSubmit(async (values) => {
          if (
            await run({
              kind: "quota",
              departmentId: department.id,
              storageQuotaBytes:
                values.quota * (values.unit === "GB" ? GB : MB),
            })
          )
            close();
        })}
      >
        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          Currently using <strong>{formatFileSize(usage.usedBytes)}</strong>{" "}
          across {usage.fileCount} files.
        </div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <label>
            Storage quota
            <input
              type="number"
              step="any"
              {...register("quota")}
              aria-invalid={!!errors.quota}
              aria-describedby={errors.quota ? "quota-error" : undefined}
            />
          </label>
          <label htmlFor="quota-unit">
            Unit
            <Controller
              name="unit"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="quota-unit"
                    className="mt-2"
                    ref={field.ref}
                    onBlur={field.onBlur}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GB">GB</SelectItem>
                    <SelectItem value="MB">MB</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </label>
        </div>
        {errors.quota && (
          <p id="quota-error" className="error" role="alert">
            {errors.quota.message}
          </p>
        )}
        {nextBytes > 0 && nextBytes < usage.usedBytes && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            This quota is below current usage. Existing files stay available,
            but new uploads will be blocked until space is freed or the quota is
            increased.
          </p>
        )}
        <p className="text-xs leading-5 text-slate-500">
          Quotas are individual limits, not reserved storage. The system has{" "}
          {formatFileSize(db.storage.totalCapacityBytes)} of shared capacity. 1
          GB = 1,000 MB.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={pending}>
            {pending ? "Saving…" : "Save quota"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
