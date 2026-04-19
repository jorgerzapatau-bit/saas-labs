// types.ts

export interface ResumenSucursal {
  id: string;
  nombre: string;
  serie_prefix: string;
  total_ingresos: number;
  total_gastos: number;
  utilidad_bruta: number;
  num_transacciones: number;
  efectivo_sin_depositar: number;
}

export interface ResumenMensual {
  mes: string;
  total_ingresos: number;
  total_gastos: number;
  utilidad: number;
}

export interface FormaPago {
  forma: string;
  total: number;
  porcentaje: number;
}

export interface TopProveedor {
  nombre: string;
  total: number;
}

export interface DashboardData {
  gran_total_ingresos: number;
  gran_total_gastos: number;
  utilidad_neta: number;
  sucursales: ResumenSucursal[];
  resumen_mensual: ResumenMensual[];
  formas_pago: FormaPago[];
  top_proveedores: TopProveedor[];
  efectivo_sin_depositar: number;
  periodo: string;
}