export interface RoleListItem {
  id: number;
  name: string;
}

export interface FacultyListItem {
  id: number;
  name: string;
}

export interface MajorListItem {
  id: number;
  name: string;
  faculty: number;
}

export interface RoomTypeListItem {
  id: number;
  type: string;
}

export interface ResourceTypeListItem {
  id: number;
  type: string;
  icon_file: string | null;
}
