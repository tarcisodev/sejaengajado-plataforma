export interface PlaceAddress {
  logradouro: string;
  cidade: string;
  uf: string;
  cep?: string;
}

export interface PlaceMatch {
  nome: string;
  telefone: string;
  address: PlaceAddress;
}
