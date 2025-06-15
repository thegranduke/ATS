export interface Location {
  id: number;
  name: string;
  streetAddress: string;
  city: string;
  county: string;
  state: string;
  zipCode: string;
  companyId: number;
}

export type LocationFormData = Omit<Location, 'id' | 'companyId'>;