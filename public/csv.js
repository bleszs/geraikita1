// Excel respects the sep directive regardless of the machine's regional delimiter.
// UTF-8 BOM preserves Indonesian names; formula-like text stays literal.
export function csvText(rows){
  const cell=value=>{
    if(typeof value==='number'&&Number.isFinite(value))return String(value).replace('.',',');
    let text=String(value??'');if(/^\s*[=+@-]/u.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return '\uFEFFsep=;\r\n'+rows.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
export function salesRows(transactions){
  return [['Tanggal','Waktu','Menu dan jumlah','Metode pembayaran','Total (Rp)','Biaya aplikasi (Rp)','Bersih (Rp)','Status','ID transaksi'],...transactions.map(t=>[
    t.date,t.time,t.items.map(i=>`${i.qty} ${i.name}`).join(', '),({tunai:'Tunai',cash:'Tunai',qris:'QRIS',transfer:'Transfer',ewallet:'E-Wallet'}[t.payment_method]||t.payment_method||'Tunai'),t.total,t.fee??0,t.net??(t.total-(t.fee??0)),t.cancelled_at?'Dibatalkan':'Tercatat',t.id
  ])];
}
