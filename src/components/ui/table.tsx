import type {
  HTMLAttributes,
  TableHTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";
export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}
export const TableHeader = (props: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead {...props} />
);
export const TableBody = (props: HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
);
export const TableRow = (props: HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...props} />
);
export const TableHead = (props: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th {...props} />
);
export const TableCell = (props: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...props} />
);
