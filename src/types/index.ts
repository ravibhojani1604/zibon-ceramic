
import type { Timestamp } from 'firebase/firestore';

// Represents the structure of a tile document in Firestore
export interface FirebaseTileDoc {
  id: string; // Firestore document ID
  modelNumberPrefix: string; // e.g., "1001" or "N/A" if no prefix
  typeSuffix: string; // e.g., "L", "D", "HL1", or "" for base model
  width: number;
  height: number;
  quantity: number;
  createdAt: Timestamp; // Firestore Timestamp for creation
  updatedAt: Timestamp; // Firestore Timestamp for last update
}

// Represents a tile variant for display purposes within a group
export interface TileVariantDisplay {
  id: string; // Firestore document ID for this variant
  typeSuffix: string; // Display string for type, e.g., "L", "HL-1", "Base"
  quantity: number;
  createdAt?: Date; // Converted from Timestamp for easier use in UI
}

// Represents a group of tiles (same model prefix, width, height) for display
export interface GroupedDisplayTile {
  groupKey: string; // Unique key for the group, e.g., "1001_12x24"
  modelNumberPrefix: string; // The common model number prefix, "N/A" if none
  width: number;
  height: number;
  variants: TileVariantDisplay[]; // List of variants within this group
  groupCreatedAt?: Date; // Earliest createdAt timestamp among variants, for sorting groups
}
