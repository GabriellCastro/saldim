/** Tipos de imprevisto que o usuário escolhe ao marcar um gasto (fonte única para API e web via GET /categories/unexpected). */
export interface UnexpectedType {
  id: string;
  label: string;
}

export const UNEXPECTED_TYPES: UnexpectedType[] = [
  { id: 'saude', label: 'Saúde e remédio' },
  { id: 'veiculo', label: 'Conserto do carro ou moto' },
  { id: 'casa', label: 'Conserto ou manutenção da casa' },
  { id: 'eletronico', label: 'Celular ou eletrônico quebrou' },
  { id: 'familia', label: 'Ajuda pra família' },
  { id: 'pet', label: 'Pet' },
  { id: 'multa', label: 'Multa, taxa ou imposto' },
  { id: 'viagem', label: 'Viagem urgente' },
  { id: 'trabalho', label: 'Trabalho ou estudo' },
  { id: 'outro', label: 'Outro' },
];

export const UNEXPECTED_BY_ID = new Map(UNEXPECTED_TYPES.map((u) => [u.id, u]));
