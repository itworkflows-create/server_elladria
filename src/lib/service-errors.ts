const messages: Record<string, string> = {
  APP_SESSION: "Your session has expired. Please sign in again.",
  APP_PERMISSION: "You do not have permission to perform this action.",
  APP_NOT_FOUND: "This item is unavailable or you no longer have access.",
  APP_QUOTA: "This upload would exceed the department storage quota.",
  APP_SYSTEM_QUOTA: "This upload would exceed the total system storage capacity.",
  APP_DEPARTMENT_LIMIT: "You already belong to a department or cannot create one.",
  APP_SELF_ADMIN: "You cannot remove yourself or change your own administrator role.",
  APP_LAST_ADMIN: "The last administrator cannot be removed.",
  APP_FOLDER_DESTINATION: "Choose a folder in the same department.",
  APP_FOLDER_CYCLE: "Cannot move a folder into itself or a descendant.",
  APP_FILE_EXTENSION: "Keep the original file extension when renaming.",
  APP_FILE_VALIDATION: "Choose a supported, nonempty file of 2 MB or smaller with a valid name and matching file type.",
  APP_UPLOAD_INCOMPLETE: "The upload did not finish. Please try again.",
  APP_UPLOAD_PENDING: "An upload is in progress in this department. Finish it or clean up the pending upload before deleting.",
  APP_CLEANUP_PENDING: "Cleanup could not finish. Use the pending-operation controls to retry.",
  APP_DELETION_PENDING: "A deletion is pending in this department. Retry it before making further changes.",
  APP_CONFIRM_DELETE: "Confirm deletion of this folder and all nested files and subfolders.",
  APP_PERMISSION_TARGET: "Choose a department member and another department.",
  APP_INVALID_COMMAND: "This operation is not supported.",
  APP_USER_INPUT: "Provide a valid name, email, role, and password of at least 12 characters.",
  APP_USER_CREATE: "The user could not be created. Check whether that email already has an account.",
  APP_USER_DELETE: "The user could not be removed. Please try again.",
};
export function publicError(error: unknown): Error {
  const value = error as { message?: string; code?: string } | null;
  const message = value?.message ?? "";
  const match = Object.keys(messages).find((key) => message === key || message.includes(key + " "));
  if (match) return new Error(messages[match]);
  if (value?.code === "23505") return new Error("That name or account already exists in this location.");
  if (value?.code === "23514" || value?.code === "22P02") return new Error("Check the supplied values and try again.");
  if (value?.code === "42501") return new Error(messages.APP_PERMISSION);
  return new Error("Unable to complete the request. Check your connection and try again.");
}
export async function edgeError(error: unknown): Promise<Error> {
  const context = (error as { context?: Response })?.context;
  if (context instanceof Response) {
    try { const body = await context.clone().json(); return publicError({ message: body.error, code: body.code }); } catch { /* Safe generic error below. */ }
  }
  return publicError(error);
}
