import { MonthDetailScreen } from '@/features/projecao/MonthDetailScreen';

export default async function Page({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  return <MonthDetailScreen month={month} />;
}
