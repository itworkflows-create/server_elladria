import { useApp, useUser } from "../../context";
import { getChildFolders, getDescendantIds } from "../../lib/folders";

export function FolderPicker({
  departmentId,
  value,
  onChange,
  excludeFolderId,
  disabled = false,
}: {
  departmentId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  excludeFolderId?: string;
  disabled?: boolean;
}) {
  const { db } = useApp();
  const user = useUser();
  const excluded = excludeFolderId
    ? getDescendantIds(db, excludeFolderId)
    : new Set<string>();
  const options: { id: string; name: string; depth: number; path: string }[] =
    [];
  const visited = new Set<string>();
  function walk(parentId: string | null, depth: number, path: string) {
    for (const folder of getChildFolders(db, user, departmentId, parentId)) {
      if (excluded.has(folder.id) || visited.has(folder.id)) continue;
      visited.add(folder.id);
      const nextPath = path ? `${path} / ${folder.name}` : folder.name;
      options.push({ id: folder.id, name: folder.name, depth, path: nextPath });
      walk(folder.id, depth + 1, nextPath);
    }
  }
  walk(null, 0, "");
  return (
    <label className="block">
      Destination folder
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
        className="mt-2 w-full"
      >
        <option value="">Department root</option>
        {options.map((folder) => (
          <option key={folder.id} value={folder.id} title={folder.path}>
            {"\u00a0\u00a0".repeat(folder.depth)}
            {folder.depth ? "↳ " : ""}
            {folder.path}
          </option>
        ))}
      </select>
    </label>
  );
}
