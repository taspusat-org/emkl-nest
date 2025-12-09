export interface FindAllParams {
  search?: string;
  filters?: Record<string, string | number>;
  isLookUp?: boolean;
  exclude?: any;
  exactMatch?: any;
  karyawanId?: number; // Opsional
  pagination?: {
    page?: number; // Opsional
    limit?: number; // Opsional
  };
  sort?: {
    sortBy: string;
    sortDirection: 'asc' | 'desc';
  };
  flag?: string;
}

export interface Ability {
  id: string;
  action: string;
  subject: string;
}
export interface UserRoleAbilities {
  roles: string[];
  abilities: Ability[];
}

export interface Menu {
  id: number;
  title: string;
  url: string;
  icon: string;
  isActive: boolean;
  order: number;
  parentId: number | null;
  items: Menu[];
}
import { z } from 'zod';

export const FindAllSchema = z
  .object({
    search: z.string().optional(),
    page: z.preprocess((val) => {
      const parsed = Number(val);
      return isNaN(parsed) ? 1 : parsed; // Jika tidak valid, set page ke 1
    }, z.number().int().min(1).default(1)),
    limit: z.preprocess((val) => {
      const parsed = Number(val);
      return isNaN(parsed) ? 10 : parsed; // Jika tidak valid, set limit ke 10
    }, z.number().int().default(10)),
    sortBy: z.string().optional(),
    isLookUp: z.string().optional(),
    exclude: z.string().optional(),
    exactMatch: z.string().optional(),
    sortDirection: z.enum(['asc', 'desc']).default('asc'),
  })
  .superRefine((val) => {
    console.log('val', val);
  });

export type FindAllDto = z.infer<typeof FindAllSchema>;
