import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApp } from "../context";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
const schema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
  description: z
    .string()
    .trim()
    .min(5, "Add a short description (at least 5 characters).")
    .max(200),
});
export function CreateResource({
  open,
  close,
}: {
  open: boolean;
  close: () => void;
}) {
  const { run, pending } = useApp();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Create department"
      description="Create a home for your team and their knowledge."
    >
      <form
        className="form-stack"
        onSubmit={handleSubmit(async (values) => {
          if (await run({ kind: "department", ...values })) {
            reset();
            close();
          }
        })}
      >
        <label>
          Name
          <input {...register("name")} placeholder="e.g. Customer Success" />
          {errors.name && <span className="error">{errors.name.message}</span>}
        </label>
        <label>
          Description
          <textarea
            {...register("description")}
            rows={3}
            placeholder="What belongs here?"
          />
          {errors.description && (
            <span className="error">{errors.description.message}</span>
          )}
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={close}>
            Cancel
          </Button>
          <Button disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}
