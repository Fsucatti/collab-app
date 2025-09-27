// lib/identity.ts
const ID_KEY = "collab:userId";
const NAME_KEY = "collab:displayName";

function randomId() {
  return `u-${Math.random().toString(36).slice(2, 8)}`;
}
function defaultName(id: string) {
  return `User-${id.slice(-4)}`;
}

export function getIdentity() {
  if (typeof window === "undefined") {
    // SSR safety, return deterministic placeholders
    const id = "u-ssr";
    return { userId: id, name: defaultName(id) };
  }
  let userId = localStorage.getItem(ID_KEY);
  if (!userId) {
    userId = randomId();
    localStorage.setItem(ID_KEY, userId);
  }
  let name = localStorage.getItem(NAME_KEY) || defaultName(userId);
  // (Optional) expose a setter later to rename
  return { userId, name };
}
