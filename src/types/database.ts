export interface ClienteRow {
  idcli: number;
  dni: number;
  nomc: string;
  tel: string;
  saldo: number;
  created_at?: string;
}

export interface TransacPuntosRow {
  idtrans: number;
  idcli: number;
  montop: number;
  tipo: 'suma' | 'resta';
  motivo: string;
  fecha: string;
  created_by?: string | null;
  staff_email?: string | null;
}

export interface RegistrarTransaccionResult {
  mensaje: string;
  id_transaccion: number;
  fecha_registro: string;
  cliente: string;
  dni: number;
  saldo_anterior: number;
  nuevo_saldo: number;
  staff_email: string;
}
