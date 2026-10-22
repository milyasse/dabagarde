// Base géographique nationale : types partagés (collecteur et application).
export type LocalityKind = 'city' | 'town' | 'village' | 'district';

export interface GeoProvince {
  id: string; // code ISO 3166-2 (ex. "MA-RAB") ou "osm-r<id>" à défaut
  name: string;
  nameAr: string | null;
  osmId: number | null;
  lat: number | null;
  lon: number | null;
}

export interface GeoRegion {
  id: string; // MA-01 … MA-12
  name: string;
  nameAr: string;
  osmId: number | null;
  provinces: GeoProvince[];
}

export interface GeoLocality {
  id: string; // "<slug>-<province>", stable
  name: string;
  nameAr: string | null;
  kind: LocalityKind;
  provinceId: string;
  regionId: string;
  lat: number;
  lon: number;
  population: number | null;
  osmId: number;
  /** Pour un quartier : la ville de rattachement (la plus proche dans la même province). */
  parentId?: string | null;
  /** Province déduite du centre le plus proche (contour pas encore disponible). */
  provinceApprox?: boolean;
}
