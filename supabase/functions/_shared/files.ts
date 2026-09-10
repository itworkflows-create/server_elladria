const mimeTypes: Record<string,string[]> = {
  pdf: ["application/pdf"], doc: ["application/msword","application/vnd.ms-word"], docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  jpg: ["image/jpeg","image/jpg"], jpeg: ["image/jpeg","image/jpg"], png: ["image/png"],
  mp3: ["audio/mpeg","audio/mp3"], wav: ["audio/wav","audio/x-wav","audio/wave","audio/vnd.wave"], m4a: ["audio/mp4","audio/m4a","audio/x-m4a"], aac: ["audio/aac","audio/x-aac","audio/aacp"],
  mp4: ["video/mp4"], mov: ["video/quicktime"], webm: ["video/webm"], xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};
export function validateIncomingFile(file: { name: string; size: number; type: string }) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const types = mimeTypes[extension];
  const mime = file.type.toLowerCase().split(";")[0].trim();
  if (!types || !file.name.trim() || file.name.length>180 || /[\\/]/.test(file.name) || [...file.name].some(c=>c.charCodeAt(0)<32) || !Number.isSafeInteger(file.size) || file.size<1 || file.size>2000000 || (mime && mime!=="application/octet-stream" && !types.includes(mime))) throw new Error("APP_FILE_VALIDATION");
  return types[0];
}
