'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { Account, Alert, Import, Payslip } from '@/features/dashboard/types';

/** Dados leves do shell: alertas (badge), conta (sincronização), último extrato e holerite. */
export function useShellData(enabled: boolean) {
  const alerts = useSWR<Alert[]>(enabled ? '/assistant/alerts' : null, fetcher);
  const accounts = useSWR<Account[]>(enabled ? '/accounts' : null, fetcher);
  const payslip = useSWR<Payslip | null>(enabled ? '/payslips/latest' : null, fetcher);
  const imports = useSWR<Import[]>(enabled ? '/imports' : null, fetcher);
  const account = accounts.data?.find((a) => a.lastSyncAt) ?? accounts.data?.[0];
  /** último extrato importado com período (lista vem mais recente primeiro) */
  const done = imports.data?.filter((i) => i.kind.toUpperCase() === 'EXTRATO' && i.periodEnd && i.status.toUpperCase() === 'DONE') ?? [];
  // reimportação só com duplicados vem com count 0: prefere a última que trouxe lançamentos
  const extrato = done.find((i) => i.count > 0) ?? done[0];
  return {
    alertsCount: alerts.data?.length ?? 0,
    account,
    /** "Itaú · ag. 0001" -> "Itaú" */
    bankName: account ? account.label.split(' · ')[0] || account.bank : 'Banco',
    extrato,
    payslip: payslip.data ?? null,
  };
}
