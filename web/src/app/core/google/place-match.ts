import { SiteAddress } from '../models/domain';

export interface PlaceMatch {
  nome: string;
  telefone: string;
  address: SiteAddress;
}
