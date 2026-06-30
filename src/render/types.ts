import type { Role } from '@elecxarium/creature';

export interface RenderAnimal {
  id: string;
  speciesId: string;
  role: Role;
  x: number;
  y: number;
  energy: number;
  energyMax: number;
  defending: boolean;
  age: number;
}

export interface RenderDot {
  id: string;
  x: number;
  y: number;
  energy: number;
}

export interface RenderFrame {
  tick: number;
  animals: RenderAnimal[];
  plants: RenderDot[];
  carcasses: RenderDot[];
}
