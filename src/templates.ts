import type { GradeSystem, SchoolType } from './types';

export interface SchoolTypeTemplate {
  label: string;
  categories: { name: string; weight: number }[];
  defaultSystem: GradeSystem;
}

/** Vorlagen je Schulart. Die Gewichte sind Startwerte und pro Fach anpassbar. */
export const SCHOOL_TYPES: Record<SchoolType, SchoolTypeTemplate> = {
  BS: {
    label: 'Berufsschule',
    categories: [
      { name: 'Mündlich', weight: 40 },
      { name: 'Schriftlich', weight: 40 },
      { name: 'Projektkompetenz', weight: 20 },
    ],
    defaultSystem: 'tendency',
  },
  TG: {
    label: 'Technisches Gymnasium',
    categories: [
      { name: 'Mündlich', weight: 50 },
      { name: 'Schriftlich', weight: 50 },
    ],
    defaultSystem: 'points',
  },
  other: {
    label: 'Sonstige',
    categories: [
      { name: 'Mündlich', weight: 50 },
      { name: 'Schriftlich', weight: 50 },
    ],
    defaultSystem: 'tendency',
  },
};
