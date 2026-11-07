const OBJECT_ID = /^[a-f\d]{24}$/i;

export function isObjectId(value: string): boolean {
  return OBJECT_ID.test(value);
}
