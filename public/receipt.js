// Printable sale receipt. Pure render; printing uses window.print() with the
// print stylesheet that reveals only #receipt-print. Money is integer Rupiah.
const rp = value => 'Rp' + Number(value || 0).toLocaleString('id-ID');
export const PAYMENT_LABELS = { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer Bank', ewallet: 'E-Wallet' };
export function receiptHTML(sale, e) {
  const when = new Date(sale.created_at || Date.now());
  const items = (sale.items || []).map(i => `<tr><td>${i.qty} ${e(i.name)}<small>@ ${rp(i.unitPrice)}</small></td><td>${rp((i.unitPrice || 0) * i.qty)}</td></tr>`).join('');
  const fee = sale.fee != null ? sale.fee : 0;
  return `<div class="receipt" id="receipt-print">
    <div class="receipt-head"><span class="receipt-mark">🧾</span><strong>${e(sale.businessName || 'Gerai Kita')}</strong><span class="small muted">Struk pembayaran</span></div>
    <div class="receipt-meta"><span>${when.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span><span>Kode #${e(String(sale.id || '').slice(0, 8).toUpperCase())}</span>${sale.label ? `<span>${e(sale.label)}</span>` : ''}${sale.cashier ? `<span>Kasir: ${e(sale.cashier)}</span>` : ''}</div>
    <table class="receipt-items"><tbody>${items}</tbody></table>
    <div class="receipt-total"><span>Total</span><strong>${rp(sale.total)}</strong></div>
    <div class="receipt-pay"><span>Metode</span><span>${e(PAYMENT_LABELS[sale.paymentMethod] || 'Tunai')}</span></div>
    ${fee ? `<div class="receipt-fee small muted"><span>Biaya aplikasi (10%)</span><span>${rp(fee)}</span></div>` : ''}
    <p class="receipt-thanks">Terima kasih telah berbelanja 🙏</p>
  </div>`;
}
