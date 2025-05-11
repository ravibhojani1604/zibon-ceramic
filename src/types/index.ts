
export interface Tile {
  id: string;
  modelNumber: string;
  width: number;
  height: number;
  quantity: number;
  createdAt?: Date; // Optional: for sorting or tracking creation time
}
