
export interface Tile {
  id: string;
  modelNumber: string; // Full model number, e.g., "12345-L" or "12345" or "L"
  width: number;
  height: number;
  quantity: number;
  createdAt?: Date; 
}

export interface TileVariant {
  id: string; // Firestore document ID for this variant
  typeSuffix: string; // e.g., "L", "HL-1", or "" if no suffix or it's the base model
  quantity: number;
  createdAt?: Date;
}

export interface GroupedDisplayTile {
  groupKey: string; // e.g., "12345_12x24" (modelPrefix_widthxheight)
  modelNumberPrefix: string; // e.g., "12345" or "N/A"
  width: number;
  height: number;
  variants: TileVariant[];
  groupCreatedAt?: Date; // Earliest createdAt among variants for sorting groups
}

    