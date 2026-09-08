export const SOUND_ON_KEY = "marblescape.sound";

/** Sound defaults to on; corrupt storage is forgiven as on. */
export function isSoundOn(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(SOUND_ON_KEY) !== "off";
}

export function setSoundOn(on: boolean, storage: Pick<Storage, "setItem" | "getItem">): void {
  storage.setItem(SOUND_ON_KEY, on ? "on" : "off");
}
