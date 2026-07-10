import { Badge } from "@/components/ui/badge";

export default function PaymentBadge({
  status, amountPaid, price,
}: {
  status: string | null | undefined;
  amountPaid: number | null | undefined;
  price: number | null | undefined;
}) {
  if (!status) return null;
  if (status === "PAID") return <Badge variant="success">Paid</Badge>;
  if (status === "PARTIAL")
    return <Badge variant="warning">Partial{price ? ` · $${amountPaid ?? 0} / $${price}` : ""}</Badge>;
  return <Badge variant="destructive">Unpaid</Badge>;
}
