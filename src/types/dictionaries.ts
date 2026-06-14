/** Елемент списку ролей користувачів. */
export interface RoleListItem {
  id: number;
  name: string;
}

/** Елемент списку факультетів. */
export interface FacultyListItem {
  id: number;
  name: string;
}

/** Елемент списку спеціальностей. */
export interface MajorListItem {
  id: number;
  name: string;
  faculty: number;
}

/** Елемент списку типів кімнат. */
export interface RoomTypeListItem {
  id: number;
  type: string;
}

/** Елемент списку типів ресурсів спільного користування. */
export interface ResourceTypeListItem {
  id: number;
  type: string;
  icon_file: string | null;
}
