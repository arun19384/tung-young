export function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(`tueng-yang:v2:${key}`) || "null");
  } catch {
    return null;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(`tueng-yang:v2:${key}`, JSON.stringify(value));
  } catch {
    /* Local preferences are optional. */
  }
}
